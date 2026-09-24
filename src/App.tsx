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
  registerNasAccount,
  pullVaultFromNas,
  pushVaultToNas,
  normalizeServerUrl,
  getDeviceIdentifier,
  logoutNasAccount,
  updateNasAuthHash,
  getNasSyncStatus,
  mergeVaultItems,
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
  const [isPrivacyShieldEnabled, setIsPrivacyShieldEnabled] = useState(() => {
    try {
      const stored = window.localStorage.getItem('safevault_privacy_shield_enabled_v1');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const [isChangeMasterModalOpen, setIsChangeMasterModalOpen] = useState(false);
  const [isEmergencyKitModalOpen, setIsEmergencyKitModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // 极空间 NAS 配置与账号登录状态
  const [nasConfig, setNasConfig] = useState<NasSyncConfig | null>(() => loadNasSyncConfig());
  const [currentAccount, setCurrentAccount] = useState<string | null>(() => loadNasSyncConfig()?.username || null);

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

  useEffect(() => {
    try {
      window.localStorage.setItem('safevault_privacy_shield_enabled_v1', String(isPrivacyShieldEnabled));
    } catch {
      // 私有浏览模式或存储被禁用时不影响界面使用。
    }
    if (!isPrivacyShieldEnabled) {
      setIsPrivacyMaskActive(false);
    }
  }, [isPrivacyShieldEnabled]);

  // 1. 初始化检查本地存储与账号凭证
  useEffect(() => {
    const cfg = loadNasSyncConfig();
    const storedMeta = loadStoredVaultMeta();
    if (cfg?.username) {
      setCurrentAccount(cfg.username);
      setNasConfig(cfg);
    } else if (storedMeta) {
      setCurrentAccount('本地金库');
    }
    if (storedMeta) {
      setVaultMeta(storedMeta);
      setIsLocked(true);
    } else {
      setVaultMeta(null);
      setIsLocked(true);
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

  // 窗口失焦或切后台时激活防肩窥高斯模糊隐私幕布 (仅在已解锁且开关开启时生效)
  useEffect(() => {
    if (isLocked || !masterKey || !isPrivacyShieldEnabled) {
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
  }, [isLocked, masterKey, isPrivacyShieldEnabled]);

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
    if (masterKey) autoPushToNas(updatedMeta, items, masterKey);
    addToast('info', `已将自动锁屏时长设置为 ${minutes} 分钟`);
  };

  // 3. 账号登录制：登录已有极空间账号并拉取对应数据库 (自动相对路径，网址变动 0 影响)
  const handleLogin = async (
    username: string,
    masterPassword: string,
    customServerUrl?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      const cleanUrl = normalizeServerUrl(customServerUrl);
      const cleanUser = username.trim().toLowerCase();
      const previousConfig = loadNasSyncConfig();
      const expectedSalt = previousConfig?.username === cleanUser ? previousConfig.salt : undefined;

      // 1. 调用极空间登录 API (通过零知识 AuthHash，主密码绝不上云)
      const loginRes = await loginNasAccount(cleanUrl, cleanUser, masterPassword, expectedSalt);
      if (!loginRes.success || !loginRes.salt) {
        const msg = loginRes.message || '登录失败：账号或主密码不匹配';
        addToast('error', msg);
        return { success: false, message: msg };
      }

      // 2. 拉取该账号在极空间的专属云端金库
      const sessionToken = loginRes.token || '';
      const pullRes = await pullVaultFromNas(cleanUrl, sessionToken);
      if (!pullRes.success) {
        const msg = pullRes.message || '拉取云端密码库失败';
        addToast('error', msg);
        return { success: false, message: msg };
      }

      let effectiveMeta: VaultMeta;
      let decryptedList: DecryptedVaultItem[] = [];
      let derivedKey: CryptoKey;

      if (pullRes.vaultMeta && pullRes.vaultMeta.testCipher) {
        // 云端已有加密库，使用主密码核验并解密
        const verifyRes = await verifyMasterPassword(masterPassword, pullRes.vaultMeta);
        if (!verifyRes.success || !verifyRes.masterKey) {
          const msg = '主密码错误：无法解密该账号的云端金库，请核对主密码';
          addToast('error', msg);
          return { success: false, message: msg };
        }
        derivedKey = verifyRes.masterKey;
        effectiveMeta = pullRes.vaultMeta;
        const encryptedItems = pullRes.encryptedItems || [];
        decryptedList = await decryptAllVaultItems(derivedKey, encryptedItems);
      } else {
        // 该账号在云端为空，检查本地是否有已有数据可迁移
        const existingStoredMeta = loadStoredVaultMeta();
        const existingEncryptedItems = loadStoredEncryptedItems();
        if (existingStoredMeta && existingEncryptedItems.length > 0) {
          const verifyRes = await verifyMasterPassword(masterPassword, existingStoredMeta);
          if (verifyRes.success && verifyRes.masterKey) {
            effectiveMeta = existingStoredMeta;
            derivedKey = verifyRes.masterKey;
            decryptedList = await decryptAllVaultItems(derivedKey, existingEncryptedItems);
          } else {
            const initRes = await initializeVaultMeta(masterPassword);
            effectiveMeta = initRes.meta;
            derivedKey = initRes.masterKey;
            decryptedList = [];
          }
        } else {
          const initRes = await initializeVaultMeta(masterPassword);
          effectiveMeta = initRes.meta;
          derivedKey = initRes.masterKey;
          decryptedList = [];
        }

        const encList = [];
        for (const it of decryptedList) {
          encList.push(await encryptVaultItem(derivedKey, it, it.id));
        }
        await pushVaultToNas(cleanUrl, sessionToken, effectiveMeta, encList, getDeviceIdentifier(), pullRes.version);
      }

      // 3. 持久化到本地存储
      saveStoredVaultMeta(effectiveMeta);
      const encList = [];
      for (const it of decryptedList) {
        encList.push(await encryptVaultItem(derivedKey, it, it.id));
      }
      saveStoredEncryptedItems(encList);

      const newCfg: NasSyncConfig = {
        serverUrl: cleanUrl,
        username: cleanUser,
        token: sessionToken,
        salt: loginRes.salt,
        lastSyncTime: pullRes.updatedAt || new Date().toISOString(),
        autoSync: true,
        remoteVersion: pullRes.version ?? loginRes.version
      };
      saveNasSyncConfig(newCfg);
      setNasConfig(newCfg);
      setCurrentAccount(cleanUser);

      setVaultMeta(effectiveMeta);
      setMasterKey(derivedKey);
      setItems(decryptedList);
      setIsLocked(false);

      addToast('success', `欢迎回来，${cleanUser}！已进入您的密码数据库 (${decryptedList.length}项)`);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录过程发生异常';
      addToast('error', msg);
      return { success: false, message: msg };
    } finally {
      setIsLoading(false);
    }
  };

  // 3.2 账号登录制：注册新账号并初始化专属云端数据库 (平滑迁移本地已有数据)
  const handleRegister = async (
    username: string,
    masterPassword: string,
    customServerUrl?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setIsLoading(true);
      const cleanUrl = normalizeServerUrl(customServerUrl);
      const cleanUser = username.trim().toLowerCase();

      // 1. 注册极空间账号
      const regRes = await registerNasAccount(cleanUrl, cleanUser, masterPassword);
      if (!regRes.success || !regRes.salt) {
        const msg = regRes.message || '注册失败';
        addToast('error', msg);
        return { success: false, message: msg };
      }

      // 检查当前设备本地是否已有旧数据（平滑迁移，绝不丢数据）
      const existingStoredMeta = loadStoredVaultMeta();
      const existingEncryptedItems = loadStoredEncryptedItems();
      let metaToUse: VaultMeta;
      let masterKeyToUse: CryptoKey;
      let initialItems: DecryptedVaultItem[] = [];
      let initialEncrypted: EncryptedVaultItem[] = [];

      if (existingStoredMeta && existingEncryptedItems.length > 0) {
        const verifyRes = await verifyMasterPassword(masterPassword, existingStoredMeta);
        if (verifyRes.success && verifyRes.masterKey) {
          metaToUse = existingStoredMeta;
          masterKeyToUse = verifyRes.masterKey;
          initialItems = await decryptAllVaultItems(masterKeyToUse, existingEncryptedItems);
          initialEncrypted = existingEncryptedItems;
        } else {
          const initRes = await initializeVaultMeta(masterPassword);
          metaToUse = initRes.meta;
          masterKeyToUse = initRes.masterKey;
        }
      } else {
        const initRes = await initializeVaultMeta(masterPassword);
        metaToUse = initRes.meta;
        masterKeyToUse = initRes.masterKey;
      }

      // 3. 推送初始元数据上云开户
      const sessionToken = regRes.token || '';
      await pushVaultToNas(cleanUrl, sessionToken, metaToUse, initialEncrypted, getDeviceIdentifier(), regRes.version);

      saveStoredVaultMeta(metaToUse);
      saveStoredEncryptedItems(initialEncrypted);

      const newCfg: NasSyncConfig = {
        serverUrl: cleanUrl,
        username: cleanUser,
        token: sessionToken,
        salt: regRes.salt,
        lastSyncTime: new Date().toISOString(),
        autoSync: true,
        remoteVersion: regRes.version
      };
      saveNasSyncConfig(newCfg);
      setNasConfig(newCfg);
      setCurrentAccount(cleanUser);

      setVaultMeta(metaToUse);
      setMasterKey(masterKeyToUse);
      setItems(initialItems);
      setIsLocked(false);

      addToast('success', `极空间账号 [${cleanUser}] 注册成功！已为您建立专属加密金库。`);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '注册过程发生异常';
      addToast('error', msg);
      return { success: false, message: msg };
    } finally {
      setIsLoading(false);
    }
  };

  // 3.3 彻底退出当前账号 (返回登录界面，可切换其他账号)
  const handleLogout = useCallback(() => {
    const activeConfig = loadNasSyncConfig();
    if (activeConfig?.token) void logoutNasAccount(activeConfig.serverUrl, activeConfig.token);
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

    // 清除会话
    saveNasSyncConfig(null);
    setNasConfig(null);
    setCurrentAccount(null);
    setVaultMeta(null);

    addToast('info', '已安全退出当前账号，已返回登录中心');
  }, []);

  // 3.4 密码项任何增删改时，后台自动静默推送至极空间云端 (实时防丢)
  const autoPushToNas = useCallback(async (meta: VaultMeta, currentItems: DecryptedVaultItem[], key: CryptoKey): Promise<boolean> => {
    const cfg = loadNasSyncConfig();
    if (!cfg?.token) return false;
    try {
      const status = await getNasSyncStatus(cfg.serverUrl, cfg.token);
      if (!status.success || typeof status.version !== 'number') return false;
      const encrypted = [];
      for (const it of currentItems) {
        encrypted.push(await encryptVaultItem(key, it, it.id));
      }
      const res = await pushVaultToNas(cfg.serverUrl, cfg.token, meta, encrypted, getDeviceIdentifier(), status.version);
      if (res.success) {
        const updatedCfg = {
          ...cfg,
          lastSyncTime: res.updatedAt || new Date().toISOString(),
          remoteVersion: res.version
        };
        saveNasSyncConfig(updatedCfg);
        setNasConfig(updatedCfg);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[AutoSync] 自动静默同步至极空间后台异常:', e);
      return false;
    }
  }, []);

  // 3.5 离线单机主密码初始化 (备选)
  const handleInitialize = async (masterPassword: string) => {
    const { meta, masterKey: newKey } = await initializeVaultMeta(masterPassword);
    saveStoredVaultMeta(meta);
    setVaultMeta(meta);
    setMasterKey(newKey);
    setItems([]);
    setCurrentAccount('离线单机库');
    setIsLocked(false);
    addToast('success', '密码数据库离线单机模式初始化完成！');
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

        // 解锁后后台自动与极空间云端比对最新版本（多端无感双向对齐）
        const cfg = loadNasSyncConfig();
        if (cfg?.token) {
          (async () => {
            try {
              const pullRes = await pullVaultFromNas(cfg.serverUrl, cfg.token);
              if (pullRes.success && pullRes.encryptedItems) {
                const remoteDecrypted = await decryptAllVaultItems(result.masterKey!, pullRes.encryptedItems);
                const { mergedItems, addedFromRemote, updatedFromRemote, retainedLocalOnly } = mergeVaultItems(
                  decryptedList,
                  remoteDecrypted
                );
                if (addedFromRemote > 0 || updatedFromRemote > 0) {
                  const reEncrypted = [];
                  for (const it of mergedItems) {
                    reEncrypted.push(await encryptVaultItem(result.masterKey!, it, it.id));
                  }
                  saveStoredEncryptedItems(reEncrypted);
                  setItems(mergedItems);
                  addToast('info', `已同步极空间最新数据 (+${addedFromRemote}条新增, ~${updatedFromRemote}条更新)`);
                }
                if (retainedLocalOnly > 0) {
                  const fullEncrypted = [];
                  for (const it of mergedItems) {
                    fullEncrypted.push(await encryptVaultItem(result.masterKey!, it, it.id));
                  }
                  await pushVaultToNas(
                    cfg.serverUrl,
                    cfg.token,
                    pullRes.vaultMeta || vaultMeta,
                    fullEncrypted,
                    getDeviceIdentifier(),
                    pullRes.version
                  );
                }
              }
            } catch (syncErr) {
              console.warn('[AutoSyncOnUnlock] 自动静默对齐异常:', syncErr);
            }
          })();
        }
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

      // 先把使用新密钥重加密后的密文推送成功，再更新 NAS 账号认证摘要。
      // 这样登录凭据和云端密文始终成对切换，避免只改了一半导致多端无法登录。
      const activeConfig = loadNasSyncConfig();
      const pushed = await autoPushToNas(newMeta, items, newMasterKey);
      if (activeConfig?.token) {
        if (!pushed) {
          throw new Error('本地主密码已修改，但云端密文推送失败；同步账号认证摘要未更新，请保持当前会话并重试同步。');
        }
        if (!activeConfig.salt) {
          throw new Error('缺少同步账号盐值，无法安全更新认证摘要。');
        }
        const authUpdate = await updateNasAuthHash(
          activeConfig.serverUrl,
          activeConfig.token,
          activeConfig.username,
          newPass,
          activeConfig.salt
        );
        if (!authUpdate.success) {
          throw new Error(authUpdate.message || '同步账号认证摘要更新失败');
        }
      }

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

    let newItems: DecryptedVaultItem[];
    if (existingId) {
      newItems = items.map((i) => (i.id === existingId ? updatedDecrypted : i));
      setItems(newItems);
      addToast('success', `[${itemData.title}] 已安全更新`);
    } else {
      newItems = [updatedDecrypted, ...items];
      setItems(newItems);
      addToast('success', `[${itemData.title}] 已加密入库`);
    }

    if (vaultMeta) {
      autoPushToNas(vaultMeta, newItems, masterKey);
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

    const newItems = items.map((i) => (i.id === id ? updatedDecrypted : i));
    setItems(newItems);
    addToast('info', `已将 [${title}] 移至废纸篓，可在废纸篓中随时恢复`);
    if (vaultMeta) {
      autoPushToNas(vaultMeta, newItems, masterKey);
    }
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

    const newItems = items.map((i) => (i.id === id ? updatedDecrypted : i));
    setItems(newItems);
    addToast('success', `已恢复 [${target.title}] 至密码库`);
    if (vaultMeta) {
      autoPushToNas(vaultMeta, newItems, masterKey);
    }
  };

  // 6.2 永久删除保留墓碑，确保其他设备不会在同步时复活该条目。
  const handlePermanentDeleteItem = (id: string, title: string) => {
    if (!window.confirm(`⚠️ 危险操作：确定要彻底粉碎 [${title}] 吗？\n此凭据将从加密存储中被永久覆写抹除，不可恢复！`)) return;

    const deletedAt = new Date().toISOString();
    const storedItems = loadStoredEncryptedItems();
    const updated = storedItems.map((i) => i.id === id
      ? { ...i, isDeleted: true, deletedAt, updatedAt: deletedAt }
      : i);
    saveStoredEncryptedItems(updated);
    const newItems = items.map((i) => i.id === id
      ? { ...i, isDeleted: true, deletedAt, updatedAt: deletedAt }
      : i);
    setItems(newItems);
    addToast('warning', `已标记永久删除 [${title}]，删除状态将同步到其他设备`);
    if (vaultMeta && masterKey) {
      autoPushToNas(vaultMeta, newItems, masterKey);
    }
  };

  // 6.3 一键清空废纸篓
  const handleEmptyTrash = () => {
    const trashItems = items.filter((i) => i.isDeleted);
    if (trashItems.length === 0) return;
    if (!window.confirm(`⚠️ 确定要清空废纸篓中的全部 ${trashItems.length} 个密码条目吗？\n此操作将不可逆地永久抹除这些加密凭据！`)) return;

    const deletedAt = new Date().toISOString();
    const trashIds = new Set(trashItems.map((i) => i.id));
    const storedItems = loadStoredEncryptedItems();
    const updated = storedItems.map((i) => trashIds.has(i.id)
      ? { ...i, isDeleted: true, deletedAt, updatedAt: deletedAt }
      : i);
    saveStoredEncryptedItems(updated);
    const newItems = items.map((i) => trashIds.has(i.id)
      ? { ...i, isDeleted: true, deletedAt, updatedAt: deletedAt }
      : i);
    setItems(newItems);
    addToast('warning', `已标记 ${trashItems.length} 条永久删除，删除状态将同步到其他设备`);
    if (vaultMeta && masterKey) {
      autoPushToNas(vaultMeta, newItems, masterKey);
    }
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

    const newItems = items.map((i) => (i.id === id ? updatedDecrypted : i));
    setItems(newItems);
    addToast(
      'success',
      newFavoriteState ? `已将 [${target.title}] 设为核心置顶` : `已取消 [${target.title}] 的核心置顶`
    );
    if (vaultMeta) {
      autoPushToNas(vaultMeta, newItems, masterKey);
    }
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
      const allDecrypted = [...newDecryptedItems, ...items];
      setItems(allDecrypted);

      addToast('success', `成功加密导入 ${newEncryptedItems.length} 条密码凭据！`);
      if (vaultMeta) {
        autoPushToNas(vaultMeta, allDecrypted, masterKey);
      }
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
      secondaryKdfIterations: secData.secondaryKdfIterations,
      updatedAt: new Date().toISOString()
    };
    saveStoredVaultMeta(updatedMeta);
    setVaultMeta(updatedMeta);
    setSecondaryAuthExpiry(Date.now() + 5 * 60 * 1000);
    if (masterKey) autoPushToNas(updatedMeta, items, masterKey);
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
        secondaryKdfIterations: undefined,
        updatedAt: new Date().toISOString()
      };
      saveStoredVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);
      setSecondaryAuthExpiry(null);
      if (masterKey) autoPushToNas(updatedMeta, items, masterKey);
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
        secondaryKdfIterations: secData.secondaryKdfIterations,
        updatedAt: new Date().toISOString()
      };
      saveStoredVaultMeta(updatedMeta);
      setVaultMeta(updatedMeta);
      setSecondaryAuthExpiry(Date.now() + 5 * 60 * 1000);
      if (masterKey) autoPushToNas(updatedMeta, items, masterKey);
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
        onLogout={handleLogout}
        onOpenGenerator={() => setIsGeneratorModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenChangeMasterPassword={() => setIsChangeMasterModalOpen(true)}
        onOpenEmergencyKit={() => setIsEmergencyKitModalOpen(true)}
        currentAccount={currentAccount}
        isNasConnected={Boolean(nasConfig?.token)}
        nasLastSyncTime={nasConfig?.lastSyncTime}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      {/* 主体工作台 */}
      <main className="flex-1 flex overflow-hidden w-full relative">
        {isLocked ? (
          // 锁定或未登录状态下居中展示统一账号认证弹窗
          <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
            <MasterAuthModal
              isInitialized={!!vaultMeta}
              currentAccount={currentAccount}
              onLogin={handleLogin}
              onRegister={handleRegister}
              onUnlock={handleUnlock}
              onLogout={handleLogout}
              onOpenRestore={() => setIsBackupModalOpen(true)}
              onResetVault={handleResetVault}
              onInitializeStandalone={handleInitialize}
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
            isPrivacyShieldEnabled={isPrivacyShieldEnabled}
            isSecondaryAuthRequired={isSecondaryAuthRequired}
            onRequestSecondaryAuth={handleRequestSecondaryAuth}
            onOpenSecondaryPasswordModal={() => {
              setSecondaryModalMode('setup');
              setIsSecondaryModalOpen(true);
            }}
            onChangeLockTimeout={handleChangeLockTimeout}
            onTogglePrivacyShield={(enabled) => {
              setIsPrivacyShieldEnabled(enabled);
              setIsPrivacyMaskActive(false);
              addToast('info', enabled ? '后台防窥已开启' : '后台防窥已关闭');
            }}
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
