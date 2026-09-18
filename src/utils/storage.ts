/**
 * SafeVault 本地持久化与安全交互存储层
 * 严格遵循 SPEC-First 规范：
 * - 存储介质内 100% 为密文，杜绝任何明文持久化
 * - 剪贴板安全自动清理机制
 * - 备份导出与校验导入
 */

import { VaultMeta, EncryptedVaultItem, VaultBackupFile, CategoryType, CategoryMeta } from '../types/vault';

const STORAGE_KEY_META = 'safevault_meta_v1';
const STORAGE_KEY_ITEMS = 'safevault_encrypted_items_v1';

export const CATEGORIES: CategoryMeta[] = [
  { key: 'website', label: '网站账号', code: '01', iconName: 'Globe', colorClass: 'text-slate-800', bgClass: 'bg-slate-100 border-slate-300' },
  { key: 'work', label: '工作办公', code: '02', iconName: 'Briefcase', colorClass: 'text-slate-800', bgClass: 'bg-slate-100 border-slate-300' },
  { key: 'finance', label: '银行金融', code: '03', iconName: 'CreditCard', colorClass: 'text-slate-800', bgClass: 'bg-slate-100 border-slate-300' },
  { key: 'social', label: '社交媒体', code: '04', iconName: 'MessageCircle', colorClass: 'text-slate-800', bgClass: 'bg-slate-100 border-slate-300' },
  { key: 'game', label: '游戏娱乐', code: '05', iconName: 'Gamepad2', colorClass: 'text-slate-800', bgClass: 'bg-slate-100 border-slate-300' },
  { key: 'other', label: '其他保密', code: '06', iconName: 'Key', colorClass: 'text-slate-800', bgClass: 'bg-slate-100 border-slate-300' },
];

export function getCategoryMeta(key: CategoryType): CategoryMeta {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[5];
}

/**
 * 读取本地存储的金库元数据
 */
export function loadStoredVaultMeta(): VaultMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (!raw) return null;
    return JSON.parse(raw) as VaultMeta;
  } catch (error) {
    console.error('读取金库元数据异常:', error);
    return null;
  }
}

/**
 * 保存金库元数据
 */
export function saveStoredVaultMeta(meta: VaultMeta): void {
  try {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  } catch (error) {
    console.error('持久化金库元数据异常:', error);
  }
}

/**
 * 读取所有加密条目
 */
export function loadStoredEncryptedItems(): EncryptedVaultItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (!raw) return [];
    return JSON.parse(raw) as EncryptedVaultItem[];
  } catch (error) {
    console.error('读取加密条目列表异常:', error);
    return [];
  }
}

/**
 * 保存所有加密条目
 */
export function saveStoredEncryptedItems(items: EncryptedVaultItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
  } catch (error) {
    console.error('持久化加密条目列表异常:', error);
  }
}

/**
 * 清空重置金库全部本地数据 (恢复出厂状态)
 */
export function resetEntireVault(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_META);
    localStorage.removeItem(STORAGE_KEY_ITEMS);
  } catch (error) {
    console.error('重置金库异常:', error);
  }
}

/**
 * 导出离线备份文件 (.safevault.json)
 */
export function exportVaultBackup(): void {
  const meta = loadStoredVaultMeta();
  const items = loadStoredEncryptedItems();

  if (!meta) {
    throw new Error('未初始化的金库无法导出备份');
  }

  const backupData: VaultBackupFile = {
    app: 'SafeVault',
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    meta,
    items
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `SafeVault_Backup_${dateStr}.safevault.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * 校验并导入离线备份文件
 */
export function parseAndValidateBackup(jsonText: string): VaultBackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_e) {
    throw new Error('备份文件非有效的 JSON 格式');
  }

  const file = parsed as Partial<VaultBackupFile>;
  if (file.app !== 'SafeVault') {
    throw new Error('无效的备份文件：非 SafeVault 备份体系');
  }
  if (!file.meta || !file.meta.salt || !file.meta.testCipher || !file.meta.testIv) {
    throw new Error('备份文件元数据损坏，缺少关键加密凭证');
  }
  if (!Array.isArray(file.items)) {
    throw new Error('条目数据列表格式异常');
  }

  return file as VaultBackupFile;
}

// 剪贴板自动清理计时器引用
let clipboardClearTimer: number | null = null;

/**
 * 安全复制到剪贴板，并在指定秒数后自动清空
 */
export async function secureCopyToClipboard(
  text: string,
  autoClearSeconds: number = 30
): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // 降级 fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    // 清除旧的定时器
    if (clipboardClearTimer !== null) {
      window.clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }

    // 设置 30 秒安全清空
    clipboardClearTimer = window.setTimeout(async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          // 仅当剪贴板仍为此内容或覆盖为空字符串
          await navigator.clipboard.writeText('');
        }
      } catch (_e) {
        // 静默忽略清空失败
      }
      clipboardClearTimer = null;
    }, autoClearSeconds * 1000);

    return true;
  } catch (err) {
    console.error('剪贴板复制失败:', err);
    return false;
  }
}
