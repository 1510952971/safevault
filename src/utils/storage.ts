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

/**
 * 简易 CSV 行解析（支持双引号包裹、逗号转义）
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((val) => val.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((val) => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * 解析 Chrome / Edge / Bitwarden / 通用密码 CSV 格式
 */
export function parseCsvPasswords(
  csvContent: string
): Array<Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>> {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) {
    throw new Error('CSV 文件无有效内容或缺少表头');
  }

  const header = rows[0].map((col) => col.toLowerCase().replace(/[\s_-]/g, ''));

  // 字段索引定位
  let titleIdx = header.findIndex((h) => h.includes('name') || h.includes('title') || h.includes('名称'));
  let urlIdx = header.findIndex((h) => h.includes('url') || h.includes('website') || h.includes('网址'));
  let usernameIdx = header.findIndex((h) => h.includes('user') || h.includes('login') || h.includes('account') || h.includes('账号'));
  let passwordIdx = header.findIndex((h) => h.includes('password') || h.includes('code') || h.includes('pwd') || h.includes('密码'));
  let notesIdx = header.findIndex((h) => h.includes('note') || h.includes('comment') || h.includes('备注'));

  // 智能 fallback
  if (titleIdx === -1 && urlIdx !== -1) titleIdx = urlIdx;
  if (titleIdx === -1) titleIdx = 0;
  if (usernameIdx === -1 && rows[0].length > 1) usernameIdx = 1;
  if (passwordIdx === -1 && rows[0].length > 2) passwordIdx = 2;

  const results: Array<Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const password = passwordIdx !== -1 ? row[passwordIdx] || '' : '';
    if (!password) continue; // 跳过空密码

    let title = titleIdx !== -1 ? row[titleIdx] || '' : '';
    const url = urlIdx !== -1 ? row[urlIdx] || '' : '';
    const username = usernameIdx !== -1 ? row[usernameIdx] || '' : '';
    const notes = notesIdx !== -1 ? row[notesIdx] || '' : '';

    if (!title && url) {
      try {
        title = new URL(url).hostname;
      } catch {
        title = url;
      }
    }
    if (!title) title = `导入凭据-${r}`;

    results.push({
      title,
      category: 'website',
      username,
      password,
      website: url,
      notes,
      isFavorite: false
    });
  }

  return results;
}

/**
 * 导出明文 CSV 文件 (带 UTF-8 BOM，方便 Excel/WPS 打开)
 */
export function exportVaultAsCsv(items: DecryptedVaultItem[]): void {
  const header = ['名称', '网址', '账号', '密码', '分类', '备注', '是否置顶'];
  const escapeCsv = (str: string | undefined) => {
    if (!str) return '""';
    return `"${str.replace(/"/g, '""')}"`;
  };

  const lines = [
    header.join(','),
    ...items.map((item) =>
      [
        escapeCsv(item.title),
        escapeCsv(item.website),
        escapeCsv(item.username),
        escapeCsv(item.password),
        escapeCsv(item.category),
        escapeCsv(item.notes),
        item.isFavorite ? '"是"' : '"否"'
      ].join(',')
    )
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `SafeVault_Passwords_${dateStr}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
