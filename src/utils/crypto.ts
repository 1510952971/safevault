/**
 * SafeVault 零知识底层加密引擎
 * 严格遵循 security-guardian 规范：
 * - Web Crypto API (SubtleCrypto)
 * - PBKDF2-SHA256 (100,000 轮哈希迭代)
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

const PBKDF2_ITERATIONS = 100000;
const TEST_TOKEN_CONST = 'SAFEVAULT_AUTH_VERIFIED_TOKEN';

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
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordBuffer = textEncoder.encode(masterPassword);

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
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // 不可导出，保护内存
    ['encrypt', 'decrypt']
  );
}

/**
 * 首次初始化金库：生成随机盐值、派生密钥并生成测试校验密文
 */
export async function initializeVaultMeta(
  masterPassword: string
): Promise<{ meta: VaultMeta; masterKey: CryptoKey }> {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const masterKey = await deriveKeyFromMasterPassword(masterPassword, salt);

    // 加密测试已知常量
    const testIv = window.crypto.getRandomValues(new Uint8Array(12));
    const tokenBuffer = textEncoder.encode(TEST_TOKEN_CONST);
    const testCipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: testIv },
      masterKey,
      tokenBuffer
    );

    const now = new Date().toISOString();
    const meta: VaultMeta = {
      version: '1.0',
      salt: bufferToBase64(salt),
      testCipher: bufferToBase64(new Uint8Array(testCipherBuffer)),
      testIv: bufferToBase64(testIv),
      lockTimeoutMinutes: 3,
      createdAt: now,
      updatedAt: now
    };

    return { meta, masterKey };
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
    const testIv = base64ToBuffer(meta.testIv);
    const testCipher = base64ToBuffer(meta.testCipher);

    const masterKey = await deriveKeyFromMasterPassword(masterPassword, salt);

    // 尝试解密测试 Token
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: testIv },
      masterKey,
      testCipher
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

const SECONDARY_TOKEN_CONST = 'SAFEVAULT_SECONDARY_AUTH_VERIFIED_TOKEN';

/**
 * 设置/开启二级安全密码：生成独立随机盐值与特征校验密文
 */
export async function setupSecondaryPassword(
  secondaryPassword: string
): Promise<{ secondarySalt: string; secondaryTestCipher: string; secondaryTestIv: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromMasterPassword(secondaryPassword, salt);

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
    secondaryTestIv: bufferToBase64(iv)
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

    const key = await deriveKeyFromMasterPassword(secondaryPassword, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: testIv },
      key,
      testCipher
    );

    const decryptedText = textDecoder.decode(decryptedBuffer);
    return decryptedText === SECONDARY_TOKEN_CONST;
  } catch (_err) {
    return false;
  }
}

/**
 * 加密单个密码条目（仅对敏感字段 username, password, notes 进行加密）
 */
export async function encryptVaultItem(
  masterKey: CryptoKey,
  item: Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<EncryptedVaultItem> {
  try {
    const payload: EncryptedPayload = {
      username: item.username,
      password: item.password,
      notes: item.notes || '',
      totpSecret: item.totpSecret || ''
    };

    const payloadBytes = textEncoder.encode(JSON.stringify(payload));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      payloadBytes
    );

    const now = new Date().toISOString();

    return {
      id: existingId || (crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
      title: item.title,
      category: item.category,
      website: item.website || '',
      isFavorite: !!item.isFavorite,
      tags: item.tags || [],
      encryptedPayload: bufferToBase64(new Uint8Array(cipherBuffer)),
      iv: bufferToBase64(iv),
      createdAt: now,
      updatedAt: now
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

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      cipherBytes
    );

    const jsonText = textDecoder.decode(decryptedBuffer);
    const payload: EncryptedPayload = JSON.parse(jsonText);

    return {
      id: encryptedItem.id,
      title: encryptedItem.title,
      category: encryptedItem.category,
      website: encryptedItem.website,
      isFavorite: encryptedItem.isFavorite || false,
      tags: encryptedItem.tags || [],
      username: payload.username,
      password: payload.password,
      notes: payload.notes,
      totpSecret: payload.totpSecret,
      createdAt: encryptedItem.createdAt,
      updatedAt: encryptedItem.updatedAt
    };
  } catch (err) {
    console.error('解密条目失败 (可能数据已损坏):', err);
    throw new Error(`条目 [${encryptedItem.title}] 解密失败`);
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
      // 容错处理：单个条目损坏不影响其他数据展示
      results.push({
        id: item.id,
        title: `${item.title} (解密异常)`,
        category: item.category,
        username: '***',
        password: '***',
        website: item.website,
        notes: '数据可能遭到篡改或密钥不匹配',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
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
