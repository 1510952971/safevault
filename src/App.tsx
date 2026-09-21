import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VaultMeta, EncryptedVaultItem, DecryptedVaultItem, ToastNotification, VaultBackupFile } from './types/vault';
import {
  initializeVaultMeta,
  verifyMasterPassword,
  setupSecondaryPassword,
  verifySecondaryPassword,
  encryptVaultItem,
  decryptAllVaultItems,
  changeMasterPasswordAndReEncryptVault
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
import { SecondaryAuthModal, SecondaryAuthModalMode } from './components/SecondaryAuthModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ChangeMasterPasswordModal } from './components/ChangeMasterPasswordModal';
import { EmergencyKitModal } from './components/EmergencyKitModal';
import { SyncAccountModal } from './components/SyncAccountModal';
import { UpdateCheckModal } from './components/UpdateCheckModal';
import {
  loadNasSyncConfig,
  saveNasSyncConfig,
  loginNasAccount,
  pullVaultFromNas,
  normalizeServerUrl,
  NasSyncConfig
} from './utils/sync';
import { PrivacyShield } from './components/PrivacyShield';
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPrivacyMaskActive, setIsPrivacyMaskActive] = useState(false);
  const [isChangeMasterModalOpen, setIsChangeMasterModalOpen] = useState(false);
  const [isEmergencyKitModalOpen, setIsEmergencyKitModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // 极空间 NAS 配置状态
  const [nasConfig, setNasConfig] = useState<NasSyncConfig | null>(() => loadNasSyncConfig());

  // 二级密码鉴权状态
  const [secondaryAuthExpiry, setSecondaryAuthExpiry] = useState<number | null>(null);
  const [isSecondaryModalOpen, setIsSecondaryModalOpen] = useState(false);
  const [secondaryModalMode, setSecondaryModalMode] = useState<SecondaryAuthModalMode>('verify');
  const pendingSecondaryActionRef = useRef<(() => void) | null>(null);

  const isSecondaryAuthorized = Boolean(secondaryAuthExpiry && Date.now() < secondaryAuthExpiry);
  const hasSecondaryPassword = Boolean(vaultMeta?.hasSecondaryPassword);
  const isSecondaryAuthRequired = hasSecondaryPassword && !isSecondaryAuthorized;

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
    setSecondaryAuthExpiry(null);
    setIsPasswordModalOpen(false);
    setIsGeneratorModalOpen(false);
    setIsBackupModalOpen(false);
    setIsSecondaryModalOpen(false);
    setIsCommandPaletteOpen(false);
    setIsPrivacyMaskActive(false);
    setIsChangeMasterModalOpen(false);
    setIsEmergencyKitModalOpen(false);
    setIsSyncModalOpen(false);
    setIsUpdateModalOpen(false);
    pendingSecondaryActionRef.current = null;
    addToast('info', '密码数据库已安全锁定');
  }, []);

  // 全局快捷键监听 (Ctrl+K / Cmd+K 唤起战术命令中枢)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!isLocked && masterKey) {
          setIsCommandPaletteOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, masterKey]);

  // 窗口失焦或切后台时激活防肩窥高斯模糊隐私幕布 (仅在已解锁状态下生效)
  useEffect(() => {
    if (isLocked || !masterKey) {
      setIsPrivacyMaskActive(false);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPrivacyMaskActive(true);
      }
    };

    const handleBlur = () => {
      setIsPrivacyMaskActive(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isLocked, masterKey]);

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
        addToast('warning', `长时间无操作（已满 ${timeoutMinutes} 分钟），密码数据库已自动锁定保护`);
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
    addToast('success', 'SafeVault 密码数据库初始化完成，请妥善保管主密码！');
  };

  // 3.5 从极空间云端载入并恢复已有金库 (无缝应对极空间远程域名变动或新设备接入)
  const handleLoadFromNas = async (serverUrl: string, username: string, masterPassword: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const cleanUrl = normalizeServerUrl(serverUrl);
      const loginRes = await loginNasAccount(cleanUrl, username, masterPassword);
      if (!loginRes.success || !loginRes.token || !loginRes.salt) {
        addToast('error', loginRes.message || '极空间登录鉴权失败，请检查网址、账号或主密码');
        return false;
      }

      const pullRes = await pullVaultFromNas(cleanUrl, loginRes.token);
      if (!pullRes.success || !pullRes.vaultMeta) {
        addToast('error', pullRes.message || '从极空间拉取加密金库失败');
        return false;
      }

      // 使用主密码校验并解密拉取的元信息
      const verifyRes = await verifyMasterPassword(masterPassword, pullRes.vaultMeta);
      if (!verifyRes.success || !verifyRes.masterKey) {
        addToast('error', '主密码错误：无法解密该极空间金库，请检查是否与创建时的主密码一致');
        return false;
      }

      const encryptedItems = pullRes.encryptedItems || [];
      const decryptedList = await decryptAllVaultItems(verifyRes.masterKey, encryptedItems);

      // 持久化到当前域名/浏览器环境
      saveStoredVaultMeta(pullRes.vaultMeta);
      saveStoredEncryptedItems(encryptedItems);

      const newCfg: NasSyncConfig = {
        serverUrl: cleanUrl,
        username: username.trim().toLowerCase(),
        token: loginRes.token,
        salt: loginRes.salt,
        lastSyncTime: pullRes.updatedAt || new Date().toISOString(),
        autoSync: true
      };
      saveNasSyncConfig(newCfg);
      setNasConfig(newCfg);

      setVaultMeta(pullRes.vaultMeta);
      setMasterKey(verifyRes.masterKey);
      setItems(decryptedList);
      setIsLocked(false);

      addToast('success', `成功接入极空间！已安全同步并还原 ${decryptedList.length} 条加密凭据！`);
      return true;
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '连接极空间服务发生异常');
      return false;
    } finally {
      setIsLoading(false);
    }
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
        addToast('success', '密码数据库解锁成功');
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

  // 4.5 敏感操作二次核验主密码 (不修改内存密钥和解锁态)
  const handleVerifyMasterPasswordOnly = async (password: string): Promise<boolean> => {
    if (!vaultMeta) return false;
    const result = await verifyMasterPassword(password, vaultMeta);
    return result.success;
  };

  // 4.6 在线无损修改主密码与全库密文一键重加密
  const handleChangeMasterPassword = async (oldPass: string, newPass: string): Promise<boolean> => {
    if (!vaultMeta) return false;
    try {
      setIsLoading(true);
      const { newMeta, newMasterKey, newEncryptedItems } = await changeMasterPasswordAndReEncryptVault(
        oldPass,
        newPass,
        vaultMeta,
        items
      );

      saveStoredVaultMeta(newMeta);
      saveStoredEncryptedItems(newEncryptedItems);
      setVaultMeta(newMeta);
      setMasterKey(newMasterKey);

      addToast('success', '金库主密码已成功修改！全库凭据已全部使用新密钥重加密完成。');
      return true;
    } catch (err: unknown) {
      console.error('修改主密码异常:', err);
      addToast('error', err instanceof Error ? err.message : '修改主密码失败');
      return false;
    } finally {
      setIsLoading(false);
    }
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

  // 6. 移至废纸篓 (软删除，防止误删，支持一键恢复)
  const handleSoftDelete = async (id: string, title: string) => {
    if (!masterKey) return;
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const updatedDecrypted: DecryptedVaultItem = {
      ...target,
      isDeleted: true,
      deletedAt: new Date().toISOString()
    };

    const encryptedItem = await encryptVaultItem(masterKey, updatedDecrypted, id);
    const storedItems = loadStoredEncryptedItems();
    const updatedEncryptedItems = storedItems.map((i) => (i.id === id ? encryptedItem : i));
    saveStoredEncryptedItems(updatedEncryptedItems);

    setItems((prev) => prev.map((i) => (i.id === id ? updatedDecrypted : i)));
    addToast('info', `已将 [${title}] 移至废纸篓，可在废纸篓中随时恢复`);
  };

  // 6.1 从废纸篓一键恢复
  const handleRestoreItem = async (id: string) => {
    if (!masterKey) return;
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const updatedDecrypted: DecryptedVaultItem = {
      ...target,
      isDeleted: false,
      deletedAt: undefined
    };

    const encryptedItem = await encryptVaultItem(masterKey, updatedDecrypted, id);
    const storedItems = loadStoredEncryptedItems();
    const updatedEncryptedItems = storedItems.map((i) => (i.id === id ? encryptedItem : i));
    saveStoredEncryptedItems(updatedEncryptedItems);

    setItems((prev) => prev.map((i) => (i.id === id ? updatedDecrypted : i)));
    addToast('success', `已恢复 [${target.title}] 至密码库`);
  };

  // 6.2 彻底粉碎删除 (从加密介质彻底抹除)
  const handlePermanentDeleteItem = (id: string, title: string) => {
    if (!window.confirm(`⚠️ 危险操作：确定要彻底粉碎 [${title}] 吗？\n此凭据将从加密存储中被永久覆写抹除，不可恢复！`)) return;

    const storedItems = loadStoredEncryptedItems();
    const updated = storedItems.filter((i) => i.id !== id);
    saveStoredEncryptedItems(updated);
    setItems((prev) => prev.filter((i) => i.id !== id));
    addToast('warning', `已彻底粉碎抹除 [${title}]`);
  };

  // 6.3 一键清空废纸篓
  const handleEmptyTrash = () => {
    const trashItems = items.filter((i) => i.isDeleted);
    if (trashItems.length === 0) return;
    if (!window.confirm(`⚠️ 确定要清空废纸篓中的全部 ${trashItems.length} 个密码条目吗？\n此操作将不可逆地永久抹除这些加密凭据！`)) return;

    const trashIds = new Set(trashItems.map((i) => i.id));
    const storedItems = loadStoredEncryptedItems();
    const updated = storedItems.filter((i) => !trashIds.has(i.id));
    saveStoredEncryptedItems(updated);
    setItems((prev) => prev.filter((i) => !trashIds.has(i.id)));
    addToast('warning', `已清空废纸篓，共抹除了 ${trashItems.length} 条凭据`);
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

  // 8.1 受二级密码保护的复制密码拦截
  const handleCopyPasswordWithAuth = (password: string) => {
    if (isSecondaryAuthRequired) {
      handleRequestSecondaryAuth(() => {
        handleCopyPassword(password);
      });
    } else {
      handleCopyPassword(password);
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

  // 11. 重置密码库处理
  const handleResetVault = () => {
    resetEntireVault();
    setVaultMeta(null);
    setMasterKey(null);
    setItems([]);
    setIsLocked(true);
    setSecondaryAuthExpiry(null);
    addToast('warning', '密码库已清空并恢复出厂状态');
  };

  // 12. 二级密码验证拦截
  const handleRequestSecondaryAuth = (onSuccess: () => void) => {
    pendingSecondaryActionRef.current = onSuccess;
    setSecondaryModalMode('verify');
    setIsSecondaryModalOpen(true);
  };

  // 13. 二级密码核验
  const handleVerifySecondaryPassword = async (
    inputPass: string,
    rememberFiveMinutes: boolean
  ): Promise<boolean> => {
    if (!vaultMeta) return false;
    const ok = await verifySecondaryPassword(inputPass, vaultMeta);
    if (ok) {
      if (rememberFiveMinutes) {
        setSecondaryAuthExpiry(Date.now() + 5 * 60 * 1000);
      }
      addToast('success', '二级安全密码核验通过');
      const action = pendingSecondaryActionRef.current;
      pendingSecondaryActionRef.current = null;
      action?.();
      return true;
    }
    return false;
  };

  // 14. 开启/设置二级密码
  const handleSetupSecondaryPassword = async (newPassword: string) => {
    if (!vaultMeta) return;
    const secData = await setupSecondaryPassword(newPassword);
    const updatedMeta: VaultMeta = {
      ...vaultMeta,
      hasSecondaryPassword: true,
      secondarySalt: secData.secondarySalt,
      secondaryTestCipher: secData.secondaryTestCipher,
      secondaryTestIv: secData.secondaryTestIv,
      updatedAt: new Date().toISOString()
    };
    saveStoredVaultMeta(updatedMeta);
    setVaultMeta(updatedMeta);
    setSecondaryAuthExpiry(Date.now() + 5 * 60 * 1000);
    addToast('success', '二级安全密码已开启！查看与复制明文受二次保护');
  };

  // 15. 停用二级密码
  const handleDisableSecondaryPassword = async (currentPass: string): Promise<boolean> => {
    if (!vaultMeta) return false;
    const ok = await verifySecondaryPassword(currentPass, vaultMeta);
    if (ok) {
      const updatedMeta: VaultMeta = {
        ...vaultMeta,
        hasSecondaryPassword: false,
        secondarySalt: undefined,
        secondaryTestCipher: undefined,
        secondaryTestIv: undefined,
        updatedAt: new Date().toISOString()
      };
      saveStoredVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);
      setSecondaryAuthExpiry(null);
      addToast('info', '已停用二级安全密码');
      return true;
    }
    return false;
  };

  // 16. 修改二级密码
  const handleChangeSecondaryPassword = async (
    oldPass: string,
    newPass: string
  ): Promise<boolean> => {
    if (!vaultMeta) return false;
    const ok = await verifySecondaryPassword(oldPass, vaultMeta);
    if (ok) {
      const secData = await setupSecondaryPassword(newPass);
      const updatedMeta: VaultMeta = {
        ...vaultMeta,
        hasSecondaryPassword: true,
        secondarySalt: secData.secondarySalt,
        secondaryTestCipher: secData.secondaryTestCipher,
        secondaryTestIv: secData.secondaryTestIv,
        updatedAt: new Date().toISOString()
      };
      saveStoredVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);
      setSecondaryAuthExpiry(Date.now() + 5 * 60 * 1000);
      addToast('success', '二级安全密码已成功修改');
      return true;
    }
    return false;
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#F5F6F8] text-slate-900 selection:bg-brand-lime selection:text-black">
      {/* 顶部导航 */}
      <Header
        isLocked={isLocked}
        totalItems={items.length}
        remainingLockSeconds={remainingLockSeconds}
        lockTimeoutMinutes={vaultMeta?.lockTimeoutMinutes || 3}
        hasSecondaryPassword={hasSecondaryPassword}
        isSecondaryAuthorized={isSecondaryAuthorized}
        onOpenSecondaryPasswordModal={() => {
          setSecondaryModalMode('setup');
          setIsSecondaryModalOpen(true);
        }}
        onChangeLockTimeout={handleChangeLockTimeout}
        onLockNow={handleLockNow}
        onOpenGenerator={() => setIsGeneratorModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenChangeMasterPassword={() => setIsChangeMasterModalOpen(true)}
        onOpenEmergencyKit={() => setIsEmergencyKitModalOpen(true)}
        isNasConnected={Boolean(nasConfig?.token)}
        nasLastSyncTime={nasConfig?.lastSyncTime}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      {/* 主体工作台 */}
      <main className="flex-1 flex overflow-hidden w-full relative">
        {isLocked ? (
          // 锁定状态下居中展示认证弹窗
          <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
            <MasterAuthModal
              isInitialized={!!vaultMeta}
              onInitialize={handleInitialize}
              onUnlock={handleUnlock}
              onOpenRestore={() => setIsBackupModalOpen(true)}
              onResetVault={handleResetVault}
              onLoadFromNas={handleLoadFromNas}
            />
          </div>
        ) : (
          // 解锁状态下展示沉浸式三栏工作台
          <VaultList
            items={items}
            isLoading={isLoading}
            remainingLockSeconds={remainingLockSeconds}
            lockTimeoutMinutes={vaultMeta?.lockTimeoutMinutes || 3}
            hasSecondaryPassword={hasSecondaryPassword}
            isSecondaryAuthorized={isSecondaryAuthorized}
            isSecondaryAuthRequired={isSecondaryAuthRequired}
            onRequestSecondaryAuth={handleRequestSecondaryAuth}
            onOpenSecondaryPasswordModal={() => {
              setSecondaryModalMode('setup');
              setIsSecondaryModalOpen(true);
            }}
            onChangeLockTimeout={handleChangeLockTimeout}
            onAddNew={() => {
              setEditingItem(null);
              setIsPasswordModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsPasswordModalOpen(true);
            }}
            onDeleteItem={handleSoftDelete}
            onRestoreItem={handleRestoreItem}
            onPermanentDeleteItem={handlePermanentDeleteItem}
            onEmptyTrash={handleEmptyTrash}
            onToggleFavorite={handleToggleFavorite}
            onCopyUsername={handleCopyUsername}
            onCopyPassword={handleCopyPassword}
            onCopyTotp={handleCopyTotp}
            onOpenGenerator={() => setIsGeneratorModalOpen(true)}
            onOpenBackup={() => setIsBackupModalOpen(true)}
            onOpenChangeMasterPassword={() => setIsChangeMasterModalOpen(true)}
            onOpenEmergencyKit={() => setIsEmergencyKitModalOpen(true)}
            isNasConnected={Boolean(nasConfig?.token)}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
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

      {/* 备份与恢复弹窗 (支持 JSON 与 CSV 批量导入/导出，导出强制二次核验主密码) */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        items={items}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreSuccess={handleRestoreSuccess}
        onBatchImportCsv={handleBatchImportCsv}
        onResetVaultConfirm={handleResetVault}
        onVerifyMasterPassword={handleVerifyMasterPasswordOnly}
      />

      {/* 二级安全密码核验与设置弹窗 */}
      <SecondaryAuthModal
        isOpen={isSecondaryModalOpen}
        mode={secondaryModalMode}
        hasSecondaryPassword={hasSecondaryPassword}
        onClose={() => {
          setIsSecondaryModalOpen(false);
          pendingSecondaryActionRef.current = null;
        }}
        onVerify={handleVerifySecondaryPassword}
        onSetupSuccess={handleSetupSecondaryPassword}
        onDisableSuccess={handleDisableSecondaryPassword}
        onChangePasswordSuccess={handleChangeSecondaryPassword}
      />

      {/* 全局 Ctrl+K 战术命令中枢弹窗 */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={items}
        onSelectCopyPassword={handleCopyPasswordWithAuth}
        onSelectCopyUsername={handleCopyUsername}
        onOpenNew={() => {
          setIsCommandPaletteOpen(false);
          setEditingItem(null);
          setIsPasswordModalOpen(true);
        }}
        onOpenGenerator={() => {
          setIsCommandPaletteOpen(false);
          setIsGeneratorModalOpen(true);
        }}
        onOpenBackup={() => {
          setIsCommandPaletteOpen(false);
          setIsBackupModalOpen(true);
        }}
        onOpenChangeMasterPassword={() => {
          setIsCommandPaletteOpen(false);
          setIsChangeMasterModalOpen(true);
        }}
        onOpenEmergencyKit={() => {
          setIsCommandPaletteOpen(false);
          setIsEmergencyKitModalOpen(true);
        }}
        onOpenSyncModal={() => {
          setIsCommandPaletteOpen(false);
          setIsSyncModalOpen(true);
        }}
        onOpenUpdateModal={() => {
          setIsCommandPaletteOpen(false);
          setIsUpdateModalOpen(true);
        }}
        onLockNow={() => {
          setIsCommandPaletteOpen(false);
          handleLockNow();
        }}
      />

      {/* 在线无损修改主密码与全库密文重加密弹窗 */}
      <ChangeMasterPasswordModal
        isOpen={isChangeMasterModalOpen}
        onClose={() => setIsChangeMasterModalOpen(false)}
        totalItemsCount={items.length}
        onChangePassword={handleChangeMasterPassword}
      />

      {/* 离线应急救援卡生成与打印弹窗 */}
      <EmergencyKitModal
        isOpen={isEmergencyKitModalOpen}
        onClose={() => setIsEmergencyKitModalOpen(false)}
        vaultMeta={vaultMeta}
        totalItemsCount={items.length}
      />

      {/* 极空间 NAS 容器化多端同步中心弹窗 */}
      <SyncAccountModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        vaultMeta={vaultMeta}
        items={items}
        masterKey={masterKey}
        onVaultUpdatedFromRemote={(newMeta, newItems) => {
          setVaultMeta(newMeta);
          setItems(newItems);
        }}
        onSyncStatusChanged={() => {
          setNasConfig(loadNasSyncConfig());
        }}
        addToast={addToast}
      />

      {/* GitHub 版本更新检测弹窗 */}
      <UpdateCheckModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* 浏览器失焦/切后台高斯模糊防肩窥隐私幕布 */}
      <PrivacyShield
        isActive={isPrivacyMaskActive && !isLocked}
        onResume={() => setIsPrivacyMaskActive(false)}
      />

      {/* 浮动轻量 Toast 提示 */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
