import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VaultMeta, EncryptedVaultItem, DecryptedVaultItem, ToastNotification, VaultBackupFile } from './types/vault';
import {
  initializeVaultMeta,
  verifyMasterPassword,
  encryptVaultItem,
  decryptAllVaultItems
} from './utils/crypto';
import {
  loadStoredVaultMeta,
  saveStoredVaultMeta,
  loadStoredEncryptedItems,
  saveStoredEncryptedItems,
  resetEntireVault,
  secureCopyToClipboard
} from './utils/storage';
import { Header } from './components/Header';
import { VaultList } from './components/VaultList';
import { MasterAuthModal } from './components/MasterAuthModal';
import { PasswordModal } from './components/PasswordModal';
import { PasswordGeneratorModal } from './components/PasswordGeneratorModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { Toast } from './components/Toast';

export const App: React.FC = () => {
  // 金库核心状态
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [items, setItems] = useState<DecryptedVaultItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 弹窗状态
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DecryptedVaultItem | null>(null);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // 提示信息
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (type: ToastNotification['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. 初始化检查本地存储是否存在金库
  useEffect(() => {
    const storedMeta = loadStoredVaultMeta();
    if (storedMeta) {
      setVaultMeta(storedMeta);
      setIsLocked(true);
    } else {
      setVaultMeta(null);
      setIsLocked(true); // 首次进入需要创建
    }
  }, []);

  // 锁屏实时倒计时秒数
  const [remainingLockSeconds, setRemainingLockSeconds] = useState<number>(180);

  // 锁定金库 (清除内存密钥与明文条目)
  const handleLockNow = useCallback(() => {
    setMasterKey(null);
    setItems([]);
    setIsLocked(true);
    setIsPasswordModalOpen(false);
    setIsGeneratorModalOpen(false);
    setIsBackupModalOpen(false);
    addToast('info', '保险箱已安全锁定');
  }, []);

  // 2. 超时无操作自动锁定机制 (支持实时每秒倒计时与自定义时长)
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isLocked || !masterKey) return;

    const timeoutMinutes = vaultMeta?.lockTimeoutMinutes || 3;
    const timeoutSeconds = timeoutMinutes * 60;
    lastActivityRef.current = Date.now();
    setRemainingLockSeconds(timeoutSeconds);

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, timeoutSeconds - elapsedSeconds);
      setRemainingLockSeconds(remaining);

      if (remaining <= 0) {
        handleLockNow();
        addToast('warning', `长时间无操作（已满 ${timeoutMinutes} 分钟），保险箱已自动锁定保护`);
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      clearInterval(checkInterval);
    };
  }, [isLocked, masterKey, vaultMeta?.lockTimeoutMinutes, handleLockNow]);

  // 修改自动锁屏时长设置
  const handleChangeLockTimeout = (minutes: number) => {
    if (!vaultMeta) return;
    const updatedMeta: VaultMeta = {
      ...vaultMeta,
      lockTimeoutMinutes: minutes,
      updatedAt: new Date().toISOString()
    };
    saveStoredVaultMeta(updatedMeta);
    setVaultMeta(updatedMeta);
    lastActivityRef.current = Date.now();
    setRemainingLockSeconds(minutes * 60);
    addToast('info', `已将自动锁屏时长设置为 ${minutes} 分钟`);
  };

  // 3. 首次创建主密码初始化
  const handleInitialize = async (masterPassword: string) => {
    const { meta, masterKey: newKey } = await initializeVaultMeta(masterPassword);
    saveStoredVaultMeta(meta);
    setVaultMeta(meta);
    setMasterKey(newKey);
    setItems([]);
    setIsLocked(false);
    addToast('success', 'SafeVault 保险箱初始化完成，请妥善保管主密码！');
  };

  // 4. 输入主密码解锁
  const handleUnlock = async (password: string): Promise<boolean> => {
    if (!vaultMeta) return false;
    const result = await verifyMasterPassword(password, vaultMeta);
    if (result.success && result.masterKey) {
      setMasterKey(result.masterKey);
      setIsLocked(false);

      // 解锁成功后解密所有条目
      setIsLoading(true);
      try {
        const encryptedItems = loadStoredEncryptedItems();
        const decryptedList = await decryptAllVaultItems(result.masterKey, encryptedItems);
        setItems(decryptedList);
        addToast('success', '保险箱解锁成功');
      } catch (err) {
        console.error('解密金库条目异常:', err);
        addToast('error', '部分密码条目解密异常');
      } finally {
        setIsLoading(false);
      }
      return true;
    }
    return false;
  };

  // 5. 保存或更新密码条目
  const handleSaveItem = async (
    itemData: Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    if (!masterKey) {
      addToast('error', '金库未解锁，无法执行加密操作');
      return;
    }

    const encryptedItem = await encryptVaultItem(masterKey, itemData, existingId);
    const storedItems = loadStoredEncryptedItems();

    let updatedEncryptedItems: EncryptedVaultItem[];
    if (existingId) {
      updatedEncryptedItems = storedItems.map((i) => (i.id === existingId ? encryptedItem : i));
    } else {
      updatedEncryptedItems = [encryptedItem, ...storedItems];
    }

    saveStoredEncryptedItems(updatedEncryptedItems);

    // 内存同步
    const updatedDecrypted: DecryptedVaultItem = {
      ...itemData,
      id: encryptedItem.id,
      createdAt: encryptedItem.createdAt,
      updatedAt: encryptedItem.updatedAt
    };

    if (existingId) {
      setItems((prev) => prev.map((i) => (i.id === existingId ? updatedDecrypted : i)));
      addToast('success', `[${itemData.title}] 已安全更新`);
    } else {
      setItems((prev) => [updatedDecrypted, ...prev]);
      addToast('success', `[${itemData.title}] 已加密入库`);
    }
  };

  // 6. 删除条目
  const handleDeleteItem = (id: string, title: string) => {
    if (!window.confirm(`确定要永久删除 [${title}] 吗？此操作无法撤销。`)) return;

    const storedItems = loadStoredEncryptedItems();
    const updated = storedItems.filter((i) => i.id !== id);
    saveStoredEncryptedItems(updated);
    setItems((prev) => prev.filter((i) => i.id !== id));
    addToast('info', `已删除 [${title}]`);
  };

  // 6.5 切换置顶状态
  const handleToggleFavorite = async (id: string) => {
    if (!masterKey) return;
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const newFavoriteState = !target.isFavorite;
    const updatedDecrypted: DecryptedVaultItem = {
      ...target,
      isFavorite: newFavoriteState
    };

    // 加密并更新存储
    const encryptedItem = await encryptVaultItem(masterKey, updatedDecrypted, id);
    const storedItems = loadStoredEncryptedItems();
    const updatedEncryptedItems = storedItems.map((i) => (i.id === id ? encryptedItem : i));
    saveStoredEncryptedItems(updatedEncryptedItems);

    setItems((prev) => prev.map((i) => (i.id === id ? updatedDecrypted : i)));
    addToast(
      'success',
      newFavoriteState ? `已将 [${target.title}] 设为核心置顶` : `已取消 [${target.title}] 的核心置顶`
    );
  };

  // 7. 复制账号
  const handleCopyUsername = async (username: string) => {
    const success = await secureCopyToClipboard(username, 60);
    if (success) {
      addToast('success', '账号已复制到剪贴板');
    } else {
      addToast('error', '复制失败，请手动选择复制');
    }
  };

  // 8. 复制密码 (30 秒安全清空)
  const handleCopyPassword = async (password: string) => {
    const success = await secureCopyToClipboard(password, 30);
    if (success) {
      addToast('success', '密码已安全复制，30秒后将自动清除剪贴板');
    } else {
      addToast('error', '复制失败，请手动选择复制');
    }
  };

  // 8.5 复制 TOTP 动态码
  const handleCopyTotp = async (code: string) => {
    const success = await secureCopyToClipboard(code, 60);
    if (success) {
      addToast('success', '2FA 动态验证码已复制到剪贴板');
    } else {
      addToast('error', '复制验证码失败');
    }
  };

  // 9. 导入备份成功处理
  const handleRestoreSuccess = (backup: VaultBackupFile) => {
    saveStoredVaultMeta(backup.meta);
    saveStoredEncryptedItems(backup.items);
    setVaultMeta(backup.meta);
    setMasterKey(null);
    setItems([]);
    setIsLocked(true);
    addToast('success', `成功导入备份！共载入 ${backup.items.length} 条密文凭据，请输入主密码解锁`);
  };

  // 10. 批量导入 CSV
  const handleBatchImportCsv = async (
    importedList: Array<Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    if (!masterKey) {
      addToast('error', '金库未解锁，无法执行批量加密入库');
      return;
    }

    setIsLoading(true);
    try {
      const storedItems = loadStoredEncryptedItems();
      const newEncryptedItems: EncryptedVaultItem[] = [];
      const newDecryptedItems: DecryptedVaultItem[] = [];

      for (const itemData of importedList) {
        const encrypted = await encryptVaultItem(masterKey, itemData);
        newEncryptedItems.push(encrypted);
        newDecryptedItems.push({
          ...itemData,
          id: encrypted.id,
          createdAt: encrypted.createdAt,
          updatedAt: encrypted.updatedAt
        });
      }

      const allEncrypted = [...newEncryptedItems, ...storedItems];
      saveStoredEncryptedItems(allEncrypted);
      setItems((prev) => [...newDecryptedItems, ...prev]);

      addToast('success', `成功加密导入 ${newEncryptedItems.length} 条密码凭据！`);
    } catch (err) {
      console.error('批量导入异常:', err);
      addToast('error', '批量导入发生异常');
    } finally {
      setIsLoading(false);
    }
  };

  // 11. 重置金库处理
  const handleResetVault = () => {
    resetEntireVault();
    setVaultMeta(null);
    setMasterKey(null);
    setItems([]);
    setIsLocked(true);
    addToast('warning', '金库已清空并恢复出厂状态');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f3f7] text-slate-900">
      {/* 顶部导航 */}
      <Header
        isLocked={isLocked}
        totalItems={items.length}
        remainingLockSeconds={remainingLockSeconds}
        lockTimeoutMinutes={vaultMeta?.lockTimeoutMinutes || 3}
        onChangeLockTimeout={handleChangeLockTimeout}
        onLockNow={handleLockNow}
        onOpenGenerator={() => setIsGeneratorModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
      />

      {/* 主体内容 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        {isLocked ? (
          // 锁定状态下展示认证弹窗
          <MasterAuthModal
            isInitialized={!!vaultMeta}
            onInitialize={handleInitialize}
            onUnlock={handleUnlock}
            onOpenRestore={() => setIsBackupModalOpen(true)}
            onResetVault={handleResetVault}
          />
        ) : (
          // 解锁状态下展示战术密码列表
          <VaultList
            items={items}
            isLoading={isLoading}
            remainingLockSeconds={remainingLockSeconds}
            lockTimeoutMinutes={vaultMeta?.lockTimeoutMinutes || 3}
            onChangeLockTimeout={handleChangeLockTimeout}
            onAddNew={() => {
              setEditingItem(null);
              setIsPasswordModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsPasswordModalOpen(true);
            }}
            onDeleteItem={handleDeleteItem}
            onToggleFavorite={handleToggleFavorite}
            onCopyUsername={handleCopyUsername}
            onCopyPassword={handleCopyPassword}
            onCopyTotp={handleCopyTotp}
            onOpenGenerator={() => setIsGeneratorModalOpen(true)}
            onOpenBackup={() => setIsBackupModalOpen(true)}
          />
        )}
      </main>

      {/* 密码新增/编辑弹窗 */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        editItem={editingItem}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
      />

      {/* 强密码生成器弹窗 */}
      <PasswordGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        onCopyPassword={handleCopyPassword}
      />

      {/* 备份与恢复弹窗 (支持 JSON 与 CSV 批量导入/导出) */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        items={items}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreSuccess={handleRestoreSuccess}
        onBatchImportCsv={handleBatchImportCsv}
        onResetVaultConfirm={handleResetVault}
      />

      {/* 浮动轻量 Toast 提示 */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
