/**
 * SafeVault 零知识底层加密引擎
 * 严格遵循 security-guardian 规范：
 * - Web Crypto API (SubtleCrypto)
 * - PBKDF2-SHA256 (新金库 600,000 轮；兼容旧金库最低 100,000 轮)
 * - AES-GCM-256 (每次使用 12 字节强伪随机 IV)
 * - 绝不明文输出敏感信息
 */

import {
  VaultMeta,
  EncryptedVaultItem,
  DecryptedVaultItem,
  EncryptedPayload,
  PasswordGeneratorOptions
} from '../types/vault';

const LEGACY_PBKDF2_ITERATIONS = 100000;
export const CURRENT_PBKDF2_ITERATIONS = 600000;
const MAX_PBKDF2_ITERATIONS = 2_000_000;
const TEST_TOKEN_CONST = 'SAFEVAULT_AUTH_VERIFIED_TOKEN';
const VAULT_META_VERSION = '2.0';
const ITEM_ENCRYPTION_VERSION = 3 as const;
const VAULT_KEY_WRAP_AAD = 'SafeVault:VaultKey:Wrap:v2';
const VAULT_TEST_AAD = 'SafeVault:VaultMeta:Test:v2';

function getLegacyVaultItemAssociatedData(item: {
  id: string; title: string; category: string; website?: string;
  isFavorite?: boolean; tags?: string[]; isDeleted?: boolean; deletedAt?: string;
  createdAt: string; updatedAt: string;
}): Uint8Array {
  return textEncoder.encode(JSON.stringify({
    id: item.id,
    title: item.title,
    category: item.category,
    website: item.website || '',
    isFavorite: !!item.isFavorite,
    tags: item.tags || [],
    isDeleted: !!item.isDeleted,
    deletedAt: item.deletedAt || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}

function getVaultItemAssociatedDataV3(id: string): Uint8Array {
  return textEncoder.encode(`SafeVault:VaultItem:v3:${id}`);
}

function getRandomBytes(length: number): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(length));
}

async function importVaultDataKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function createVaultDataKey(): Promise<{ key: CryptoKey; raw: Uint8Array }> {
  const raw = getRandomBytes(32);
  return { key: await importVaultDataKey(raw), raw };
}

async function wrapVaultDataKey(kek: CryptoKey, rawVaultKey: Uint8Array): Promise<{ ciphertext: string; iv: string }> {
  const iv = getRandomBytes(12);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: textEncoder.encode(VAULT_KEY_WRAP_AAD) },
    kek,
    rawVaultKey as BufferSource
  );
  return { ciphertext: bufferToBase64(new Uint8Array(ciphertext)), iv: bufferToBase64(iv) };
}

async function unwrapVaultDataKey(kek: CryptoKey, wrappedVaultKey: string, wrappedVaultKeyIv: string): Promise<CryptoKey> {
  const raw = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBuffer(wrappedVaultKeyIv) as BufferSource,
      additionalData: textEncoder.encode(VAULT_KEY_WRAP_AAD)
    },
    kek,
    base64ToBuffer(wrappedVaultKey) as BufferSource
  );
  const rawBytes = new Uint8Array(raw);
  try {
    return await importVaultDataKey(rawBytes);
  } finally {
    rawBytes.fill(0);
  }
}

// Uint8Array 与 Base64 互转
export function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 文本与 Buffer 互转
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * 基于主密码与盐值，通过 PBKDF2 派生 AES-GCM 256 位 CryptoKey
 */
export async function deriveKeyFromMasterPassword(
  masterPassword: string,
  salt: Uint8Array,
  iterations = CURRENT_PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  if (!Number.isInteger(iterations) || iterations < LEGACY_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error('金库 KDF 参数无效');
  }
  const passwordBuffer = textEncoder.encode(masterPassword);

  try {
    // 导入原始密码为 key_material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // 派生 AES-GCM 密钥
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // 不可导出，保护内存
      ['encrypt', 'decrypt']
    );
  } finally {
    passwordBuffer.fill(0);
  }
}

/**
 * 首次初始化金库：主密码只派生 KEK，用于包裹随机生成的金库数据密钥。
 * 数据密钥与主密码解耦，改主密码时可以重新包裹/重建金库而不让服务器接触明文。
 */
export async function initializeVaultMeta(
  masterPassword: string
): Promise<{ meta: VaultMeta; masterKey: CryptoKey }> {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKeyFromMasterPassword(masterPassword, salt, CURRENT_PBKDF2_ITERATIONS);
    const { key: vaultKey, raw: rawVaultKey } = await createVaultDataKey();
    const wrapped = await wrapVaultDataKey(kek, rawVaultKey);
    rawVaultKey.fill(0);

    // 使用金库数据密钥加密测试常量；没有主密码就无法先解包数据密钥。
    const testIv = getRandomBytes(12);
    const tokenBuffer = textEncoder.encode(TEST_TOKEN_CONST);
    const testCipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: testIv as BufferSource, additionalData: textEncoder.encode(VAULT_TEST_AAD) },
      vaultKey,
      tokenBuffer
    );
    tokenBuffer.fill(0);

    const now = new Date().toISOString();
    const meta: VaultMeta = {
      version: VAULT_META_VERSION,
      salt: bufferToBase64(salt),
      testCipher: bufferToBase64(new Uint8Array(testCipherBuffer)),
      testIv: bufferToBase64(testIv),
      kdfIterations: CURRENT_PBKDF2_ITERATIONS,
      keyEnvelopeVersion: 2,
      wrappedVaultKey: wrapped.ciphertext,
      wrappedVaultKeyIv: wrapped.iv,
      lockTimeoutMinutes: 3,
      createdAt: now,
      updatedAt: now
    };

    return { meta, masterKey: vaultKey };
  } catch (error) {
    console.error('金库元数据初始化失败:', error);
    throw new Error('初始化金库加密环境异常');
  }
}

/**
 * 验证用户输入的主密码是否正确
 */
export async function verifyMasterPassword(
  masterPassword: string,
  meta: VaultMeta
): Promise<{ success: boolean; masterKey: CryptoKey | null }> {
  try {
    const salt = base64ToBuffer(meta.salt);
    const kek = await deriveKeyFromMasterPassword(masterPassword, salt, meta.kdfIterations || LEGACY_PBKDF2_ITERATIONS);
    let masterKey: CryptoKey;

    if (meta.keyEnvelopeVersion === 2 && meta.wrappedVaultKey && meta.wrappedVaultKeyIv) {
      masterKey = await unwrapVaultDataKey(kek, meta.wrappedVaultKey, meta.wrappedVaultKeyIv);
    } else {
      // 兼容 v1：旧版直接用主密码派生的 AES-GCM 密钥加密条目。
      masterKey = kek;
    }

    const testIv = base64ToBuffer(meta.testIv);
    const testCipher = base64ToBuffer(meta.testCipher);

    // 尝试解密测试 Token
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: testIv as BufferSource,
        ...(meta.keyEnvelopeVersion === 2 ? { additionalData: textEncoder.encode(VAULT_TEST_AAD) } : {})
      },
      masterKey,
      testCipher as BufferSource
    );

    const decryptedText = textDecoder.decode(decryptedBuffer);
    if (decryptedText === TEST_TOKEN_CONST) {
      return { success: true, masterKey };
    }
    return { success: false, masterKey: null };
  } catch (_e) {
    // 密码错误时 AES-GCM Tag 校验不匹配，底层直接抛出 OperationError
    return { success: false, masterKey: null };
  }
}

/**
 * 在线无损修改主密码：
 * 1. 严格核验原主密码是否正确
 * 2. 生成全新的主密码盐值与随机金库数据密钥
 * 3. 用新主密码重新包裹金库数据密钥
 * 4. 重新加密测试 Token
 * 5. 使用新数据密钥逐条重新加密当前所有凭据
 * 6. 返回全新 Meta、新 CryptoKey 以及新密文条目数组
 */
export async function changeMasterPasswordAndReEncryptVault(
  oldPassword: string,
  newPassword: string,
  currentMeta: VaultMeta,
  currentItems: DecryptedVaultItem[]
): Promise<{
  newMeta: VaultMeta;
  newMasterKey: CryptoKey;
  newEncryptedItems: EncryptedVaultItem[];
}> {
  // 1. 核验旧密码
  const authCheck = await verifyMasterPassword(oldPassword, currentMeta);
  if (!authCheck.success) {
    throw new Error('当前主密码验证失败，无法修改主密码');
  }

  // 2. 生成新的金库元数据与数据密钥。
  const initialized = await initializeVaultMeta(newPassword);
  const newMasterKey = initialized.masterKey;
  const now = new Date().toISOString();
  const newMeta: VaultMeta = {
    ...initialized.meta,
    lockTimeoutMinutes: currentMeta.lockTimeoutMinutes,
    hasSecondaryPassword: currentMeta.hasSecondaryPassword,
    secondarySalt: currentMeta.secondarySalt,
    secondaryTestCipher: currentMeta.secondaryTestCipher,
    secondaryTestIv: currentMeta.secondaryTestIv,
    secondaryKdfIterations: currentMeta.secondaryKdfIterations,
    createdAt: currentMeta.createdAt || now,
    updatedAt: now
  };

  // 3. initializeVaultMeta 已经用新数据密钥生成了测试 Token。
  /*
   * 注意：这里不尝试保留旧的 testCipher 或 wrappedVaultKey。
   * 遗失旧主密码时，旧金库数据密钥仍不可恢复；只有已经解锁的设备可以主动重加密。
   */

  // 4. 使用新密钥逐条重新加密所有条目
  const newEncryptedItems: EncryptedVaultItem[] = [];
  for (const item of currentItems) {
    const reEncrypted = await encryptVaultItem(newMasterKey, item, item.id);
    newEncryptedItems.push(reEncrypted);
  }

  return {
    newMeta,
    newMasterKey,
    newEncryptedItems
  };
}

const SECONDARY_TOKEN_CONST = 'SAFEVAULT_SECONDARY_AUTH_VERIFIED_TOKEN';

/**
 * 设置/开启二级安全密码：生成独立随机盐值与特征校验密文
 */
export async function setupSecondaryPassword(
  secondaryPassword: string
): Promise<{ secondarySalt: string; secondaryTestCipher: string; secondaryTestIv: string; secondaryKdfIterations: number }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromMasterPassword(secondaryPassword, salt, CURRENT_PBKDF2_ITERATIONS);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const tokenBytes = textEncoder.encode(SECONDARY_TOKEN_CONST);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    tokenBytes
  );

  return {
    secondarySalt: bufferToBase64(salt),
    secondaryTestCipher: bufferToBase64(new Uint8Array(cipherBuffer)),
    secondaryTestIv: bufferToBase64(iv),
    secondaryKdfIterations: CURRENT_PBKDF2_ITERATIONS
  };
}

/**
 * 校验二级安全密码是否正确
 */
export async function verifySecondaryPassword(
  secondaryPassword: string,
  meta: VaultMeta
): Promise<boolean> {
  if (!meta.hasSecondaryPassword || !meta.secondarySalt || !meta.secondaryTestCipher || !meta.secondaryTestIv) {
    return true; // 未启用二级密码时默认无需校验
  }

  try {
    const salt = base64ToBuffer(meta.secondarySalt);
    const testIv = base64ToBuffer(meta.secondaryTestIv);
    const testCipher = base64ToBuffer(meta.secondaryTestCipher);

    const key = await deriveKeyFromMasterPassword(secondaryPassword, salt, meta.secondaryKdfIterations || LEGACY_PBKDF2_ITERATIONS);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: testIv as BufferSource },
      key,
      testCipher as BufferSource
    );

    const decryptedText = textDecoder.decode(decryptedBuffer);
    return decryptedText === SECONDARY_TOKEN_CONST;
  } catch (_err) {
    return false;
  }
}

type VaultItemEncryptionInput =
  Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>
  & Partial<Pick<DecryptedVaultItem, 'createdAt' | 'updatedAt'>>;

/**
 * 加密单个密码条目。
 * v3 将标题、分类、网址、标签、删除状态、时间戳以及敏感字段统一放进
 * AES-GCM 密文；服务器只能看到随机 id、IV 和不可读密文。
 */
export async function encryptVaultItem(
  masterKey: CryptoKey,
  item: VaultItemEncryptionInput,
  existingId?: string
): Promise<EncryptedVaultItem> {
  try {
    const now = new Date().toISOString();
    const id = existingId || (crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    const createdAt = item.createdAt || now;
    const updatedAt = item.updatedAt || now;
    const payload: EncryptedPayload = {
      id,
      title: item.title,
      category: item.category,
      username: item.username,
      password: item.password,
      notes: item.notes || '',
      website: item.website || '',
      isFavorite: !!item.isFavorite,
      tags: item.tags || [],
      isDeleted: !!item.isDeleted,
      deletedAt: item.deletedAt,
      totpSecret: item.totpSecret || '',
      customFields: item.customFields || [],
      passwordHistory: item.passwordHistory || [],
      createdAt,
      updatedAt
    };

    const payloadBytes = textEncoder.encode(JSON.stringify(payload));
    const iv = getRandomBytes(12);
    const associatedData = getVaultItemAssociatedDataV3(id);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: associatedData as BufferSource },
      masterKey,
      payloadBytes
    );
    payloadBytes.fill(0);

    return {
      encryptionVersion: ITEM_ENCRYPTION_VERSION,
      id,
      encryptedPayload: bufferToBase64(new Uint8Array(cipherBuffer)),
      iv: bufferToBase64(iv)
    };
  } catch (err) {
    console.error('密码条目加密失败:', err);
    throw new Error('加密密码条目失败');
  }
}

/**
 * 解密单个密码条目
 */
export async function decryptVaultItem(
  masterKey: CryptoKey,
  encryptedItem: EncryptedVaultItem
): Promise<DecryptedVaultItem> {
  try {
    const iv = base64ToBuffer(encryptedItem.iv);
    const cipherBytes = base64ToBuffer(encryptedItem.encryptedPayload);

    const isV3 = encryptedItem.encryptionVersion === ITEM_ENCRYPTION_VERSION;
    let decryptedBuffer: ArrayBuffer;
    if (isV3) {
      decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource, additionalData: getVaultItemAssociatedDataV3(encryptedItem.id) as BufferSource },
        masterKey,
        cipherBytes as BufferSource
      );
    } else {
      const legacyItem = encryptedItem as Required<Pick<EncryptedVaultItem, 'id' | 'title' | 'category' | 'createdAt' | 'updatedAt'>> & EncryptedVaultItem;
      try {
        decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as BufferSource, additionalData: getLegacyVaultItemAssociatedData(legacyItem) as BufferSource },
          masterKey,
          cipherBytes as BufferSource
        );
      } catch (legacyAadError) {
        // 仅兼容最早的无 AAD 格式；v2 有 AAD 的条目不允许静默降级。
        if (encryptedItem.encryptionVersion === 2) throw legacyAadError;
        decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as BufferSource },
          masterKey,
          cipherBytes as BufferSource
        );
      }
    }

    const jsonText = textDecoder.decode(decryptedBuffer);
    const payload: EncryptedPayload = JSON.parse(jsonText);

    if (isV3) {
      if (payload.id !== encryptedItem.id) throw new Error('条目标识校验失败');
      return {
        id: encryptedItem.id,
        title: payload.title,
        category: payload.category,
        website: payload.website,
        isFavorite: !!payload.isFavorite,
        tags: payload.tags || [],
        isDeleted: !!payload.isDeleted,
        deletedAt: payload.deletedAt,
        username: payload.username,
        password: payload.password,
        notes: payload.notes,
        totpSecret: payload.totpSecret,
        customFields: payload.customFields || [],
        passwordHistory: payload.passwordHistory || [],
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt
      };
    }

    return {
      id: encryptedItem.id,
      title: encryptedItem.title || '',
      category: encryptedItem.category || 'other',
      website: encryptedItem.website,
      isFavorite: encryptedItem.isFavorite || false,
      tags: encryptedItem.tags || [],
      isDeleted: encryptedItem.isDeleted || false,
      deletedAt: encryptedItem.deletedAt,
      username: payload.username,
      password: payload.password,
      notes: payload.notes,
      totpSecret: payload.totpSecret,
      customFields: payload.customFields || [],
      passwordHistory: payload.passwordHistory || [],
      createdAt: encryptedItem.createdAt || new Date(0).toISOString(),
      updatedAt: encryptedItem.updatedAt || new Date(0).toISOString()
    };
  } catch (err) {
    console.error('解密条目失败：密文完整性校验未通过');
    throw new Error('金库密文完整性校验失败，已拒绝加载该数据');
  }
}

/**
 * 批量解密条目列表
 */
export async function decryptAllVaultItems(
  masterKey: CryptoKey,
  items: EncryptedVaultItem[]
): Promise<DecryptedVaultItem[]> {
  const results: DecryptedVaultItem[] = [];
  for (const item of items) {
    try {
      const decrypted = await decryptVaultItem(masterKey, item);
      results.push(decrypted);
    } catch (_err) {
      // 安全策略：不展示部分解密结果，也不把篡改数据伪装成可用条目。
      // 调用方收到异常后必须停止同步/加载并提示用户恢复可信备份。
      throw new Error('金库中存在无法验证的密文条目，已停止加载以防止数据混合或覆盖');
    }
  }
  return results;
}

/**
 * 高强度密码发生器（遵循密码学 CSPRNG）
 */
export function generateSecurePassword(options: PasswordGeneratorOptions): string {
  let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let lower = 'abcdefghijklmnopqrstuvwxyz';
  let numbers = '0123456789';
  let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (options.excludeAmbiguous) {
    upper = upper.replace(/[IO]/g, '');
    lower = lower.replace(/[lo]/g, '');
    numbers = numbers.replace(/[01]/g, '');
  }

  let pool = '';
  const mandatoryChars: string[] = [];

  if (options.useUppercase && upper.length > 0) {
    pool += upper;
    mandatoryChars.push(getRandomCharFrom(upper));
  }
  if (options.useLowercase && lower.length > 0) {
    pool += lower;
    mandatoryChars.push(getRandomCharFrom(lower));
  }
  if (options.useNumbers && numbers.length > 0) {
    pool += numbers;
    mandatoryChars.push(getRandomCharFrom(numbers));
  }
  if (options.useSymbols && symbols.length > 0) {
    pool += symbols;
    mandatoryChars.push(getRandomCharFrom(symbols));
  }

  // 兜底：若全未勾选，默认使用小写加数字
  if (pool.length === 0) {
    pool = lower + numbers;
  }

  const length = Math.max(options.length, mandatoryChars.length);
  const resultChars: string[] = [...mandatoryChars];

  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  for (let i = resultChars.length; i < length; i++) {
    const randomIndex = randomValues[i] % pool.length;
    resultChars.push(pool[randomIndex]);
  }

  // 洗牌打乱顺序 (Fisher-Yates)
  for (let i = resultChars.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    const temp = resultChars[i];
    resultChars[i] = resultChars[j];
    resultChars[j] = temp;
  }

  return resultChars.join('');
}

function getRandomCharFrom(str: string): string {
  const randArr = new Uint32Array(1);
  window.crypto.getRandomValues(randArr);
  return str[randArr[0] % str.length];
}

/**
 * 密码强度实时评分 (0 ~ 100)
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  label: '非常弱' | '较弱' | '中等' | '较强' | '极强';
  colorClass: string;
} {
  if (!password) {
    return { score: 0, label: '非常弱', colorClass: 'bg-slate-700' };
  }

  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 15;

  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  score = Math.min(100, score);

  if (score < 35) {
    return { score, label: '非常弱', colorClass: 'bg-rose-500' };
  } else if (score < 55) {
    return { score, label: '较弱', colorClass: 'bg-amber-500' };
  } else if (score < 75) {
    return { score, label: '中等', colorClass: 'bg-yellow-500' };
  } else if (score < 90) {
    return { score, label: '较强', colorClass: 'bg-emerald-500' };
  } else {
    return { score, label: '极强', colorClass: 'bg-cyan-400' };
  }
}
