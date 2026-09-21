/**
 * 个人私密密码保险箱 SafeVault 类型定义契约
 * 严格遵照 SPEC.md 与 code-guardian 强类型规范
 */

export type CategoryType = 'website' | 'work' | 'finance' | 'social' | 'game' | 'other';

export interface CategoryMeta {
  key: CategoryType;
  label: string;
  code: string;
  iconName: string;
  colorClass: string;
  bgClass: string;
}

export interface VaultMeta {
  version: string;             // 规格版本号，例如 '1.0'
  salt: string;                // Base64 编码的 16 字节随机盐值 (用于 PBKDF2)
  testCipher: string;          // 验证主密码正确性的特征密文 (AES-GCM 加密已知常量 "SAFEVAULT_TOKEN")
  testIv: string;              // 验证密文的 12 字节随机 IV (Base64)
  lockTimeoutMinutes: number;  // 自动锁屏时长 (默认 3 分钟)
  createdAt: string;           // ISO 8601 时间戳
  updatedAt: string;           // 最后修改时间戳
}

export interface EncryptedPayload {
  username: string;
  password: string;
  notes?: string;
  totpSecret?: string;         // TOTP 2FA 密钥 (加密存放)
}

export interface EncryptedVaultItem {
  id: string;                  // UUID
  title: string;               // 平台/应用名称 (明文索引)
  category: CategoryType;      // 分类
  website?: string;            // 网站登录链接 (可选)
  isFavorite?: boolean;        // 是否核心置顶凭据
  tags?: string[];             // 标签
  encryptedPayload: string;    // Base64: 经 AES-GCM-256 加密后的 EncryptedPayload JSON
  iv: string;                  // Base64: 每次加密生成的 12 字节随机 IV
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}

export interface DecryptedVaultItem {
  id: string;
  title: string;
  category: CategoryType;
  username: string;
  password: string;
  website?: string;
  notes?: string;
  totpSecret?: string;         // TOTP 2FA 密钥
  isFavorite?: boolean;        // 是否核心置顶凭据
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultSecurityAudit {
  totalItems: number;
  favoriteCount: number;
  weakCount: number;
  reusedCount: number;
  healthScore: number;
  riskyItemIds: string[];
}

export type SortOption = 'updated_desc' | 'title_asc' | 'strength_asc' | 'favorites_first';

export interface VaultBackupFile {
  app: 'SafeVault';
  exportVersion: '1.0';
  exportedAt: string;
  meta: VaultMeta;
  items: EncryptedVaultItem[];
}

export interface PasswordGeneratorOptions {
  length: number;
  useUppercase: boolean;
  useLowercase: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  excludeAmbiguous: boolean; // 排除 0, O, 1, l, I 等
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  durationMs?: number;
}
