/**
 * 个人私密密码数据库 SafeVault 类型定义契约
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
  kdfIterations?: number;      // 新金库 600000；旧数据缺省按兼容下限 100000
  keyEnvelopeVersion?: 2;      // 2.0：主密码只负责解包随机生成的金库数据密钥
  wrappedVaultKey?: string;    // AES-GCM 包裹后的随机金库数据密钥
  wrappedVaultKeyIv?: string;  // 包裹金库数据密钥使用的独立 12 字节 IV
  lockTimeoutMinutes: number;  // 自动锁屏时长 (默认 3 分钟)
  hasSecondaryPassword?: boolean;    // 是否开启二级安全密码
  secondarySalt?: string;            // 二级密码 PBKDF2 独立盐值 (Base64)
  secondaryTestCipher?: string;      // 二级密码校验密文 (Base64)
  secondaryTestIv?: string;          // 二级密码校验 IV (Base64)
  secondaryKdfIterations?: number;   // 二级密码 PBKDF2 轮数
  createdAt: string;           // ISO 8601 时间戳
  updatedAt: string;           // 最后修改时间戳
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
  isProtected?: boolean; // 是否隐藏掩码保护
}

export interface PasswordHistoryEntry {
  password: string;
  changedAt: string;     // ISO 8601
}

export interface EncryptedPayload {
  id: string;
  title: string;
  category: CategoryType;
  username: string;
  password: string;
  notes?: string;
  website?: string;
  isFavorite?: boolean;
  tags?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
  totpSecret?: string;         // TOTP 2FA 密钥 (加密存放)
  customFields?: CustomField[]; // 自定义扩展安全字段 (加密存放)
  passwordHistory?: PasswordHistoryEntry[]; // 密码修改历史 (加密存放)
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedVaultItem {
  encryptionVersion?: 2 | 3;  // 2 为兼容旧格式；3 为整条记录零知识密文
  id: string;                  // UUID；仅保留不可读的随机标识用于同步去重
  encryptedPayload: string;    // Base64：整条记录（含标题/网址/分类）的 AES-GCM 密文
  iv: string;                  // Base64：每次加密生成的独立 12 字节 IV

  // 以下字段仅用于读取 v2 历史数据，新 v3 条目不会写入这些明文外壳字段。
  title?: string;
  category?: CategoryType;
  website?: string;
  isFavorite?: boolean;
  tags?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  isDeleted?: boolean;         // 是否移入废纸篓 (软删除)
  deletedAt?: string;          // 移入废纸篓时间戳
  customFields?: CustomField[];
  passwordHistory?: PasswordHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type VaultItem = DecryptedVaultItem;

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

export interface EncryptedVaultBackupFile {
  app: 'SafeVault';
  backupVersion: '2.0';
  encryptionVersion?: 2;  // 2：AES-GCM 备份密文绑定版本 AAD；缺省兼容旧版无 AAD 备份
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
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
