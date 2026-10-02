import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
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
import { UserManualModal } from './components/UserManualModal';
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
  getNasSyncStatus,
  NasSyncConfig,
  SyncEndpointConfig,
  changeNasAccountPassword,
  runWithSyncFailover,
  upsertSyncEndpoint,
  replicateVaultToSecondary
} from './utils/sync';
import { PrivacyShield } from './components/PrivacyShield';
import { Toast } from './components/Toast';
import { checkForGitHubUpdate } from './utils/updateChecker';
import { ThemePickerModal } from './components/ThemePickerModal';
import { applyTheme, loadTheme, ThemeId } from './utils/theme';

export const App: React.FC = () => {
  const isAndroidNative = Capacitor.getPlatform() === 'android';
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
  const [isUserManualOpen, setIsUserManualOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());

  // 极空间 NAS 配置与账号登录状态
  const [nasConfig, setNasConfig] = useState<NasSyncConfig | null>(() => loadNasSyncConfig());
  const [currentAccount, setCurrentAccount] = useState<string | null>(() => loadNasSyncConfig()?.username || null);
  const nasTransferInFlightRef = useRef(false);

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

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
    }
    // 未登录 NAS 账号时不开放本地缓存解锁；本地缓存仅作为登录后的加密离线缓存。
    if (storedMeta && cfg?.username) {
      setVaultMeta(storedMeta);
      setIsLocked(true);
    } else {
      setVaultMeta(null);
      setIsLocked(true);
    }
  }, []);

  // 程序启动后的首要联网动作：核对 GitHub 主分支版本，不一致时主动弹出更新提示。
  useEffect(() => {
    let cancelled = false;
    void checkForGitHubUpdate().then((result) => {
      if (!cancelled && result.success && result.versionMismatch) {
        setIsUpdateModalOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
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
    setIsThemeModalOpen(false);
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
      let authoritativeVersion = pullRes.version ?? loginRes.version;
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

        // 旧金库只在用户已经用正确主密码登录后迁移：重新生成随机 DEK、
        // 用当前密码包裹它，并把所有旧条目写成 v3。没有主密码的服务端
        // 无法代替客户端完成这一步，也不存在静默恢复或绕过路径。
        const needsProtocolMigration = effectiveMeta.keyEnvelopeVersion !== 2
          || encryptedItems.some((item) => item.encryptionVersion !== 3);
        if (needsProtocolMigration) {
          const upgraded = await initializeVaultMeta(masterPassword);
          const upgradedItems: EncryptedVaultItem[] = [];
          for (const item of decryptedList) {
            upgradedItems.push(await encryptVaultItem(upgraded.masterKey, item, item.id));
          }
          const migrationPush = await pushVaultToNas(
            cleanUrl,
            sessionToken,
            upgraded.meta,
            upgradedItems,
            getDeviceIdentifier(),
            pullRes.version
          );
          if (!migrationPush.success) {
            throw new Error(migrationPush.message || '旧版金库迁移失败，未改变云端数据；请稍后重试');
          }
          effectiveMeta = upgraded.meta;
          derivedKey = upgraded.masterKey;
          authoritativeVersion = migrationPush.version ?? authoritativeVersion;
          addToast('info', '已将旧版金库安全迁移到整条记录加密协议');
        }
      } else {
        // NAS 是唯一权威数据源。新账号在 NAS 上为空时只创建空库，
        // 不自动读取或迁移当前设备的本地离线库，避免把旧设备数据覆盖到错误账号。
        const initRes = await initializeVaultMeta(masterPassword);
        effectiveMeta = initRes.meta;
        derivedKey = initRes.masterKey;
        decryptedList = [];

        const pushRes = await pushVaultToNas(cleanUrl, sessionToken, effectiveMeta, [], getDeviceIdentifier(), pullRes.version);
        if (!pushRes.success) {
          throw new Error(pushRes.message || '无法在极空间创建新的空密码库');
        }
        authoritativeVersion = pushRes.version ?? authoritativeVersion;
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
        remoteVersion: authoritativeVersion
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

  // 3.2 账号登录制：注册新账号并初始化专属云端数据库
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

      // 新账号以极空间为唯一数据源，从空库开始；本地旧缓存不自动迁移。
      let metaToUse: VaultMeta;
      let masterKeyToUse: CryptoKey;
      let initialItems: DecryptedVaultItem[] = [];
      let initialEncrypted: EncryptedVaultItem[] = [];
      const initRes = await initializeVaultMeta(masterPassword);
      metaToUse = initRes.meta;
      masterKeyToUse = initRes.masterKey;

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
    // 写操作优先：若恰逢后台版本检查，等待其结束，不能静默丢弃本次上传。
    for (let attempt = 0; nasTransferInFlightRef.current && attempt < 50; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (nasTransferInFlightRef.current) return false;
    nasTransferInFlightRef.current = true;
    try {
      const statusExecution = await runWithSyncFailover(cfg, (endpoint) =>
        getNasSyncStatus(endpoint.serverUrl, endpoint.token)
      );
      const status = statusExecution.result;
      if (!status.success || typeof status.version !== 'number') return false;
      const encrypted: EncryptedVaultItem[] = [];
      for (const it of currentItems) {
        encrypted.push(await encryptVaultItem(key, it, it.id));
      }
      const pushExecution = await runWithSyncFailover(cfg, (endpoint) =>
        pushVaultToNas(
          endpoint.serverUrl,
          endpoint.token,
          meta,
          encrypted,
          getDeviceIdentifier(),
          endpoint.provider === statusExecution.endpoint.provider ? status.version : endpoint.remoteVersion
        )
      );
      const res = pushExecution.result;
      if (res.success) {
        const updatedCfg = upsertSyncEndpoint(cfg, {
          ...pushExecution.endpoint,
          lastSyncTime: res.updatedAt || new Date().toISOString(),
          remoteVersion: res.version,
          dataHash: res.dataHash,
          lastError: undefined,
          lastReachableAt: new Date().toISOString()
        }, true);
        saveNasSyncConfig(updatedCfg);
        setNasConfig(updatedCfg);
        void replicateVaultToSecondary(updatedCfg, pushExecution.endpoint.provider, meta, encrypted, getDeviceIdentifier());
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[AutoSync] 自动静默同步至极空间后台异常:', e);
      return false;
    } finally {
      nasTransferInFlightRef.current = false;
    }
  }, []);

  // 3.5 已解锁客户端持续跟随 NAS 权威版本：前台每 10 秒检查，窗口聚焦时立即检查。
  const refreshFromNasIfChanged = useCallback(async () => {
    if (isLocked || !masterKey || nasTransferInFlightRef.current) return;
    const cfg = loadNasSyncConfig();
    if (!cfg?.token) return;

    nasTransferInFlightRef.current = true;
    try {
      const statusExecution = await runWithSyncFailover(cfg, (endpoint) =>
        getNasSyncStatus(endpoint.serverUrl, endpoint.token)
      );
      const status = statusExecution.result;
      if (!status.success || typeof status.version !== 'number' || status.version === statusExecution.endpoint.remoteVersion) return;

      const pullRes = await pullVaultFromNas(statusExecution.endpoint.serverUrl, statusExecution.endpoint.token);
      if (!pullRes.success || !pullRes.vaultMeta || !pullRes.encryptedItems) return;

      const remoteItems = await decryptAllVaultItems(masterKey, pullRes.encryptedItems);
      saveStoredVaultMeta(pullRes.vaultMeta);
      saveStoredEncryptedItems(pullRes.encryptedItems);
      setVaultMeta(pullRes.vaultMeta);
      setItems(remoteItems);

      const updatedCfg = upsertSyncEndpoint(cfg, {
        ...statusExecution.endpoint,
        lastSyncTime: pullRes.updatedAt || new Date().toISOString(),
        remoteVersion: pullRes.version ?? status.version,
        dataHash: pullRes.dataHash,
        lastError: undefined,
        lastReachableAt: new Date().toISOString()
      }, true);
      saveNasSyncConfig(updatedCfg);
      setNasConfig(updatedCfg);
      addToast('info', `已从${statusExecution.endpoint.provider === 'aws' ? ' AWS' : '极空间 NAS'}${statusExecution.failedOver ? '备用方案' : ''}获取其他客户端的更新，当前共 ${remoteItems.length} 项`);
    } catch (error) {
      console.warn('[LiveSync] 获取其他客户端更新失败:', error);
    } finally {
      nasTransferInFlightRef.current = false;
    }
  }, [isLocked, masterKey]);

  useEffect(() => {
    if (isLocked || !masterKey || !nasConfig?.token) return;

    const refreshWhenActive = () => {
      if (!document.hidden) void refreshFromNasIfChanged();
    };
    const intervalId = window.setInterval(refreshWhenActive, 10_000);
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    void refreshFromNasIfChanged();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
    };
  }, [isLocked, masterKey, nasConfig?.token, refreshFromNasIfChanged]);

  // 3.6 兼容旧调用：新版本不再提供离线单机初始化。
  const handleInitialize = async (masterPassword: string) => {
    void masterPassword;
    addToast('warning', '请先登录或注册极空间同步账号，数据将统一保存在极空间 NAS');
  };

  // 4. 输入主密码解锁
  const handleUnlock = async (password: string): Promise<boolean> => {
    if (!vaultMeta) return false;
    const result = await verifyMasterPassword(password, vaultMeta);
    if (result.success && result.masterKey) {
      // 解锁成功后解密所有条目
      setIsLoading(true);
      try {
        const encryptedItems = loadStoredEncryptedItems();
        const decryptedList = await decryptAllVaultItems(result.masterKey, encryptedItems);
        // 只有本地密文全集通过认证后才切换到解锁态，避免损坏/篡改
        // 的缓存让界面进入“半解锁”状态或继续覆盖可信远端数据。
        setMasterKey(result.masterKey);
        setIsLocked(false);
        setItems(decryptedList);
        addToast('success', '密码数据库解锁成功');

        // 解锁后以极空间为唯一权威源刷新本地加密缓存，不把本地独有数据反向推送。
        const cfg = loadNasSyncConfig();
        if (cfg?.token) {
          (async () => {
            try {
              const pullExecution = await runWithSyncFailover(cfg, (endpoint) =>
                pullVaultFromNas(endpoint.serverUrl, endpoint.token)
              );
              const pullRes = pullExecution.result;
              if (pullRes.success && pullRes.encryptedItems) {
                const remoteDecrypted = await decryptAllVaultItems(result.masterKey!, pullRes.encryptedItems);
                const remoteEncrypted = pullRes.encryptedItems;
                saveStoredEncryptedItems(remoteEncrypted);
                if (pullRes.vaultMeta) saveStoredVaultMeta(pullRes.vaultMeta);
                setItems(remoteDecrypted);
                if (pullRes.vaultMeta) setVaultMeta(pullRes.vaultMeta);
                const updatedCfg = upsertSyncEndpoint(cfg, {
                  ...pullExecution.endpoint,
                  lastSyncTime: pullRes.updatedAt || new Date().toISOString(),
                  remoteVersion: pullRes.version,
                  dataHash: pullRes.dataHash,
                  lastError: undefined,
                  lastReachableAt: new Date().toISOString()
                }, true);
                saveNasSyncConfig(updatedCfg);
                setNasConfig(updatedCfg);
                addToast('info', `已从${pullExecution.endpoint.provider === 'aws' ? ' AWS' : '极空间 NAS'}${pullExecution.failedOver ? '备用方案' : ''}刷新 ${remoteDecrypted.length} 项数据`);
              }
            } catch (syncErr) {
              console.warn('[AutoSyncOnUnlock] 自动静默对齐异常:', syncErr);
            }
          })();
        }
      } catch (err) {
        console.error('解密金库条目异常:', err);
        setMasterKey(null);
        setIsLocked(true);
        setItems([]);
        addToast('error', '本地金库密文校验失败，已拒绝解锁；请恢复可信备份');
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

      // 认证摘要与新密文必须由服务端在同一个版本锁/灾备事务中提交。
      // 不能拆成“先推密文、再改认证”，否则网络中断会产生半成功状态。
      const activeConfig = loadNasSyncConfig();
      if (activeConfig?.token) {
        if (!activeConfig.salt) {
          throw new Error('缺少同步账号盐值，无法安全更新认证摘要。');
        }
        const remoteStatus = await getNasSyncStatus(activeConfig.serverUrl, activeConfig.token);
        if (!remoteStatus.success || typeof remoteStatus.version !== 'number') {
          throw new Error(remoteStatus.message || '无法确认云端版本，已取消改密');
        }
        const atomicChange = await changeNasAccountPassword(
          activeConfig.serverUrl,
          activeConfig.token,
          activeConfig.username,
          newPass,
          activeConfig.salt,
          newMeta,
          newEncryptedItems,
          remoteStatus.version,
          getDeviceIdentifier()
        );
        if (!atomicChange.success) {
          throw new Error(atomicChange.message || '主密码与云端密文原子更新失败');
        }
        const updatedConfig = {
          ...activeConfig,
          lastSyncTime: atomicChange.updatedAt || new Date().toISOString(),
          remoteVersion: atomicChange.version
        };
        saveNasSyncConfig(updatedConfig);
        setNasConfig(updatedConfig);
      }

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

    const previousItem = existingId ? items.find((item) => item.id === existingId) : undefined;
    const now = new Date().toISOString();
    const recordForEncryption = {
      ...itemData,
      createdAt: previousItem?.createdAt || now,
      updatedAt: now
    };
    const encryptedItem = await encryptVaultItem(masterKey, recordForEncryption, existingId);
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
      createdAt: recordForEncryption.createdAt,
      updatedAt: recordForEncryption.updatedAt
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
        const now = new Date().toISOString();
        const recordForEncryption = { ...itemData, createdAt: now, updatedAt: now };
        const encrypted = await encryptVaultItem(masterKey, recordForEncryption);
        newEncryptedItems.push(encrypted);
        newDecryptedItems.push({
          ...itemData,
          id: encrypted.id,
          createdAt: now,
          updatedAt: now
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
    <div data-theme={theme} className={`safevault-app-shell h-screen overflow-hidden flex flex-col bg-[#F5F6F8] text-slate-900 selection:bg-brand-lime selection:text-black ${isAndroidNative ? 'platform-android' : ''}`}>
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
        onOpenTheme={() => setIsThemeModalOpen(true)}
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
              onInitializeStandalone={undefined}
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
            onOpenUserManual={() => setIsUserManualOpen(true)}
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

      <UserManualModal
        isOpen={isUserManualOpen}
        onClose={() => setIsUserManualOpen(false)}
      />

      <ThemePickerModal
        isOpen={isThemeModalOpen}
        currentTheme={theme}
        onSelect={(nextTheme) => {
          setTheme(nextTheme);
          setIsThemeModalOpen(false);
          addToast('success', '主题已切换，密码库数据未改变');
        }}
        onClose={() => setIsThemeModalOpen(false)}
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
