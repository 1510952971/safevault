/**
 * SafeVault 客户端零知识（Zero-Knowledge）极空间 NAS 同步引擎
 * 
 * 核心安全保障：
 * 1. 认证派生摘要（AuthHash）：基于主密码 + 用户专属盐值派生，主密码永远不发送至服务器；
 * 2. 密文传输：传输的全部为经过 AES-GCM 强加密后的密文载荷，极空间服务器无权也无能力解密；
 * 3. 离线优先：断网或脱机时使用本地存储，联机时一键双向安全同步。
 */

import { VaultMeta, EncryptedVaultItem, VaultItem } from '../types/vault';

export interface NasSyncConfig {
  serverUrl: string;       // 极空间 NAS 网址（当前激活连接的网址）
  localUrl?: string;       // 备用：局域网内网地址 (例如 http://192.168.1.100:8088)
  remoteUrl?: string;      // 备用：远程外网地址 (例如 https://xxx.zspace.cn:8088)
  username: string;        // 同步账号
  token: string;           // 兼容旧版本；新版本实际使用 HttpOnly Cookie
  salt: string;            // 客户端账户盐值
  lastSyncTime: string | null; // 最后一次成功同步的时间戳
  autoSync: boolean;       // 是否开启启动/解锁时自动同步
}

const NAS_CONFIG_KEY = 'safevault_nas_sync_config';

/**
 * 从本地持久化读取 NAS 同步配置
 */
export function loadNasSyncConfig(): NasSyncConfig | null {
  try {
    const raw = localStorage.getItem(NAS_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('读取 NAS 同步配置失败:', e);
    return null;
  }
}

/**
 * 保存 NAS 同步配置到本地
 */
export function saveNasSyncConfig(config: NasSyncConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(NAS_CONFIG_KEY);
    } else {
      localStorage.setItem(NAS_CONFIG_KEY, JSON.stringify(config));
    }
  } catch (e) {
    console.error('保存 NAS 同步配置失败:', e);
  }
}

/**
 * 格式化标准化服务端网址 (无参数或空串时自动使用当前浏览器 origin，完全免疫域名变动)
 */
export function normalizeServerUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) {
    return '';
  }
  let url = rawUrl.trim();
  if (url.startsWith('/')) {
    return '';
  }
  if (typeof window !== 'undefined' && window.location) {
    if (url === window.location.origin || url === window.location.host) {
      return '';
    }
  }
  if (!/^https?:\/\//i.test(url)) {
    const protocol = (typeof window !== 'undefined' && window.location?.protocol) || 'http:';
    url = `${protocol}//${url}`;
  }
  // 公网同步禁止明文 HTTP；localhost 和 RFC1918 局域网地址保留，方便本机/NAS 内网部署。
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isPrivate = host === 'localhost' || host === '127.0.0.1' || host === '::1'
      || /^10\./.test(host) || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    if (parsed.protocol === 'http:' && !isPrivate && host !== window.location.hostname) {
      throw new Error('远程同步必须使用 HTTPS；HTTP 仅允许本机或局域网地址');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('必须使用 HTTPS')) throw error;
  }
  return url.replace(/\/+$/, '');
}

/**
 * 零知识认证哈希计算
 * 使用 Web Crypto API 进行 PBKDF2 派生 + SHA-256 哈希
 * 确保即使极空间数据库失窃，攻击者也绝对无法逆向推导出主密码！
 */
export async function deriveAuthHash(
  username: string,
  masterPassword: string,
  saltHex: string
): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(masterPassword);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const authSaltBuffer = encoder.encode(`safevault:nas:auth:${username.toLowerCase()}:${saltHex}`);

  // 10,000 轮 PBKDF2 计算专门用于向服务器鉴权的 AuthHash
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: authSaltBuffer,
      iterations: 10000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  // 转为 16 进制字符串
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 生成 16 字节真随机盐值 Hex
 */
export function generateRandomSaltHex(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 获取设备标识（区分手机/桌面端）
 */
export function getDeviceIdentifier(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android-Mobile-App';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS-Mobile-App';
  if (/Macintosh/i.test(ua)) return 'macOS-Desktop';
  if (/Windows/i.test(ua)) return 'Windows-PC';
  return 'Web-Client';
}

/**
 * 检测极空间 NAS 服务连通性与版本
 */
export async function checkNasHealth(serverUrl: string): Promise<{
  success: boolean;
  name?: string;
  version?: string;
  userCount?: number;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanUrl}/api/version`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, message: `服务响应错误 (HTTP ${res.status})` };
    }
    const data = await res.json();
    return {
      success: true,
      name: data.name,
      version: data.version,
      userCount: data.userCount
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '连接超时或网络不可达';
    return { success: false, message: `无法连接到极空间 NAS (${errorMsg})` };
  }
}

/**
 * 获取用户注册时记录的公开盐值（多端登录必需）
 */
export async function getNasSalt(serverUrl: string, username: string): Promise<{
  success: boolean;
  salt?: string;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const res = await fetch(`${cleanUrl}/api/auth/salt?username=${encodeURIComponent(username.trim())}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || '获取账号特征失败' };
    }
    return { success: true, salt: data.salt };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '请求异常' };
  }
}

async function createChallengeResponse(authHash: string, challenge: string): Promise<string> {
  const key = await window.crypto.subtle.importKey(
    'raw', new TextEncoder().encode(authHash), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(challenge));
  return bufferToHex(new Uint8Array(signature));
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 注册极空间同步账号
 */
export async function registerNasAccount(
  serverUrl: string,
  username: string,
  masterPassword: string
): Promise<{
  success: boolean;
  token?: string;
  salt?: string;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const cleanUser = username.trim().toLowerCase();
    const salt = generateRandomSaltHex();
    const authHash = await deriveAuthHash(cleanUser, masterPassword, salt);

    const res = await fetch(`${cleanUrl}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        authHash,
        salt
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || '注册失败' };
    }

    return {
      success: true,
      salt,
      message: '极空间同步账号注册成功'
    };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '网络连接失败' };
  }
}

/**
 * 登录极空间同步账号
 */
export async function loginNasAccount(
  serverUrl: string,
  username: string,
  masterPassword: string
): Promise<{
  success: boolean;
  token?: string;
  salt?: string;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const cleanUser = username.trim().toLowerCase();

    // 1. 获取盐值
    const saltRes = await getNasSalt(cleanUrl, cleanUser);
    if (!saltRes.success || !saltRes.salt) {
      return { success: false, message: saltRes.message || '获取账号盐值失败' };
    }

    // 2. 本地计算 AuthHash
    const authHash = await deriveAuthHash(cleanUser, masterPassword, saltRes.salt);

    const challengeRes = await fetch(`${cleanUrl}/api/auth/challenge?username=${encodeURIComponent(cleanUser)}`, { credentials: 'include' });
    const challengeData = await challengeRes.json();
    if (!challengeRes.ok || !challengeData.success || !challengeData.challenge) {
      return { success: false, message: challengeData.message || '获取登录挑战失败' };
    }
    const challengeResponse = await createChallengeResponse(authHash, challengeData.challenge);

    // 3. 请求登录
    const res = await fetch(`${cleanUrl}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        challenge: challengeData.challenge,
        challengeResponse
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || '账号或主密码认证摘要错误' };
    }

    return {
      success: true,
      salt: saltRes.salt,
      message: '极空间登录成功'
    };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '网络请求失败' };
  }
}

export async function logoutNasAccount(serverUrl: string, token = ''): Promise<void> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    await fetch(`${cleanUrl}/api/auth/logout`, {
      method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    // 本地退出仍然继续，网络异常不应阻塞用户退出。
  }
}

/**
 * 查询同步状态与云端版本
 */
export async function getNasSyncStatus(
  serverUrl: string,
  token: string
): Promise<{
  success: boolean;
  version?: number;
  updatedAt?: string;
  hasData?: boolean;
  itemsCount?: number;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const res = await fetch(`${cleanUrl}/api/sync/status`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || '查询同步状态失败' };
    }
    return {
      success: true,
      version: data.version,
      updatedAt: data.updatedAt,
      hasData: data.hasData,
      itemsCount: data.itemsCount
    };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '网络请求失败' };
  }
}

/**
 * 客户端向极空间 NAS 推送加密密文金库（Push）
 */
export async function pushVaultToNas(
  serverUrl: string,
  token: string,
  vaultMeta: VaultMeta,
  encryptedItems: EncryptedVaultItem[],
  deviceName?: string
): Promise<{
  success: boolean;
  version?: number;
  updatedAt?: string;
  itemsCount?: number;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const device = deviceName || getDeviceIdentifier();

    const res = await fetch(`${cleanUrl}/api/sync/push`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        vaultMeta,
        encryptedItems,
        deviceName: device
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || '数据推送失败' };
    }

    return {
      success: true,
      version: data.version,
      updatedAt: data.updatedAt,
      itemsCount: data.itemsCount,
      message: '密文数据已安全推送至极空间 NAS'
    };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '网络通信异常' };
  }
}

/**
 * 客户端从极空间 NAS 拉取最新加密密文金库（Pull）
 */
export async function pullVaultFromNas(
  serverUrl: string,
  token: string
): Promise<{
  success: boolean;
  vaultMeta?: VaultMeta;
  encryptedItems?: EncryptedVaultItem[];
  version?: number;
  updatedAt?: string;
  message?: string;
}> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const res = await fetch(`${cleanUrl}/api/sync/pull`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || '数据拉取失败' };
    }

    return {
      success: true,
      vaultMeta: data.vaultMeta,
      encryptedItems: data.encryptedItems || [],
      version: data.version,
      updatedAt: data.updatedAt
    };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '网络通信异常' };
  }
}

/**
 * 智能双向合并本地与云端密码凭据（Smart Two-Way Merge）
 * 核心安全规则：
 * 1. 绝不盲目覆盖或物理抹除：本地独有或云端独有的条目 100% 全部并入；
 * 2. 相同条目 (按 id 匹配)：以最后更新时间 (updatedAt) 较新者为准保留最新修改；
 * 3. 彻底杜绝“数据少的设备推送导致数据多的云端被覆盖删除”的问题。
 */
export function mergeVaultItems(
  localItems: VaultItem[],
  remoteItems: VaultItem[]
): {
  mergedItems: VaultItem[];
  addedFromRemote: number;
  updatedFromRemote: number;
  retainedLocalOnly: number;
} {
  const itemMap = new Map<string, VaultItem>();
  let addedFromRemote = 0;
  let updatedFromRemote = 0;

  // 1. 先载入本地所有条目
  for (const item of localItems) {
    if (item && item.id) {
      itemMap.set(item.id, { ...item });
    }
  }

  // 2. 融合云端条目
  for (const remoteItem of remoteItems) {
    if (!remoteItem || !remoteItem.id) continue;

    if (!itemMap.has(remoteItem.id)) {
      // 本地无此条目，属于云端新增 -> 吸收合入
      itemMap.set(remoteItem.id, { ...remoteItem });
      addedFromRemote++;
    } else {
      // 双方都有同一条凭据 -> 比较 updatedAt 时间戳
      const localItem = itemMap.get(remoteItem.id)!;
      const localTime = new Date(localItem.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteItem.updatedAt || 0).getTime();

      if (remoteTime > localTime) {
        // 云端修改版本更新 -> 采用云端最新版本
        itemMap.set(remoteItem.id, { ...remoteItem });
        updatedFromRemote++;
      }
    }
  }

  // 3. 计算本地独有条目数
  const remoteIdSet = new Set(remoteItems.map(r => r.id));
  let retainedLocalOnly = 0;
  for (const localItem of localItems) {
    if (localItem?.id && !remoteIdSet.has(localItem.id)) {
      retainedLocalOnly++;
    }
  }

  return {
    mergedItems: Array.from(itemMap.values()),
    addedFromRemote,
    updatedFromRemote,
    retainedLocalOnly
  };
}

