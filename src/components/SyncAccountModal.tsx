import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldCheck,
  Smartphone,
  Monitor,
  ExternalLink,
  LogOut,
  Edit3,
  History,
  RotateCcw
} from 'lucide-react';
import {
  NasSyncConfig,
  loadNasSyncConfig,
  saveNasSyncConfig,
  checkNasHealth,
  loginNasAccount,
  registerNasAccount,
  pushVaultToNas,
  pullVaultFromNas,
  getNasSyncStatus,
  getNasBackups,
  rollbackNasBackup,
  NasBackupSummary,
  mergeVaultItems,
  getDeviceIdentifier,
  normalizeServerUrl,
  getDefaultNasServerUrl,
  getDefaultAwsServerUrl,
  DEFAULT_NAS_REMOTE_SERVER_URL,
  DEFAULT_NAS_LOCAL_SERVER_URL,
  DEFAULT_AWS_SERVER_URL,
  SyncProviderId,
  SyncEndpointConfig,
  getSyncEndpoint,
  upsertSyncEndpoint,
  activateSyncProvider,
  runWithSyncFailover,
  replicateVaultToSecondary
} from '../utils/sync';
import { VaultMeta, EncryptedVaultItem, DecryptedVaultItem } from '../types/vault';
import { encryptVaultItem, decryptAllVaultItems } from '../utils/crypto';
import { saveStoredVaultMeta, saveStoredEncryptedItems } from '../utils/storage';

interface SyncAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultMeta: VaultMeta | null;
  items: DecryptedVaultItem[];
  masterKey: CryptoKey | null;
  onVaultUpdatedFromRemote: (newMeta: VaultMeta, newItems: DecryptedVaultItem[]) => void;
  onSyncStatusChanged?: (connected: boolean, lastSyncTime: string | null) => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const SyncAccountModal: React.FC<SyncAccountModalProps> = ({
  isOpen,
  onClose,
  vaultMeta,
  items,
  masterKey,
  onVaultUpdatedFromRemote,
  onSyncStatusChanged,
  addToast
}) => {
  const [syncConfig, setSyncConfig] = useState<NasSyncConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [selectedProvider, setSelectedProvider] = useState<SyncProviderId>('nas');

  // 输入表单状态
  const [serverUrl, setServerUrl] = useState(getDefaultNasServerUrl);
  const [username, setUsername] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [isAutoSync, setIsAutoSync] = useState(true);

  // 运行状态
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [backups, setBackups] = useState<NasBackupSummary[]>([]);
  const [currentRemoteVersion, setCurrentRemoteVersion] = useState<number | null>(null);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // 动态修改/切换 NAS 网址状态 (应对极空间远程域名变动)
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const selectedEndpoint = syncConfig ? getSyncEndpoint(syncConfig, selectedProvider) : null;
  const providerLabel = selectedProvider === 'aws' ? 'AWS 同步服务器' : '极空间 NAS + Cloudflare Tunnel';

  const selectProvider = (provider: SyncProviderId) => {
    setSelectedProvider(provider);
    const endpoint = syncConfig ? getSyncEndpoint(syncConfig, provider) : null;
    setServerUrl(endpoint?.serverUrl || (provider === 'nas' ? getDefaultNasServerUrl() : getDefaultAwsServerUrl()));
    setUsername(endpoint?.username || syncConfig?.username || '');
    setHealthStatus(null);
  };

  const persistEndpointResult = (
    config: NasSyncConfig,
    endpoint: SyncEndpointConfig,
    patch: Partial<SyncEndpointConfig> = {},
    activate = true
  ) => {
    const nextEndpoint: SyncEndpointConfig = {
      ...endpoint,
      ...patch,
      lastError: undefined,
      lastReachableAt: new Date().toISOString()
    };
    const nextConfig = upsertSyncEndpoint(config, nextEndpoint, activate);
    saveNasSyncConfig(nextConfig);
    setSyncConfig(nextConfig);
    return nextConfig;
  };

  // 保存并更新 NAS 网址 (无感切换，不丢失登录会话与 Token)
  const handleSaveEditedUrl = async () => {
    if (!editUrlInput.trim() || !syncConfig || !selectedEndpoint) return;
    const cleanUrl = normalizeServerUrl(editUrlInput);
    setIsSavingUrl(true);
    const health = await checkNasHealth(cleanUrl);
    setIsSavingUrl(false);
    if (!health.success) {
      const proceed = window.confirm(`⚠️ 连通性测试未通过：${health.message || '无法连接该网址'}\n\n是否仍要强制保存该网址？`);
      if (!proceed) return;
    }
    const updatedCfg = persistEndpointResult(syncConfig, selectedEndpoint, { serverUrl: cleanUrl }, selectedProvider === (syncConfig.activeProvider || syncConfig.provider || 'nas'));
    onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
    setIsEditingUrl(false);
    addToast('success', `极空间同步网址已成功更新为：${cleanUrl}`);
  };

  const refreshBackups = async (config: NasSyncConfig | null = syncConfig) => {
    if (!config?.token) return;
    setIsLoadingBackups(true);
    const execution = await runWithSyncFailover(config, (endpoint) =>
      getNasBackups(endpoint.serverUrl, endpoint.token)
    );
    const result = execution.result;
    setIsLoadingBackups(false);
    if (result.success) {
      setBackups(result.backups || []);
      if (typeof result.currentVersion === 'number') {
        setCurrentRemoteVersion(result.currentVersion);
        persistEndpointResult(config, execution.endpoint, { remoteVersion: result.currentVersion });
      }
    } else if (execution.failedOver) {
      addToast('info', `当前同步方案不可用，已切换到${execution.endpoint.provider === 'aws' ? ' AWS' : '极空间 NAS'}备用方案`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const cfg = loadNasSyncConfig();
      setSyncConfig(cfg);
      if (cfg) {
        const provider = cfg.activeProvider || cfg.provider || 'nas';
        setSelectedProvider(provider);
        const endpoint = getSyncEndpoint(cfg, provider);
        setServerUrl(endpoint?.serverUrl || (provider === 'nas' ? getDefaultNasServerUrl() : getDefaultAwsServerUrl()));
        setUsername(endpoint?.username || cfg.username);
        setIsAutoSync(endpoint?.autoSync ?? cfg.autoSync);
        setCurrentRemoteVersion(endpoint?.remoteVersion ?? cfg.remoteVersion ?? null);
        if (endpoint) void refreshBackups(cfg);
      } else {
        setServerUrl(getDefaultNasServerUrl());
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 测试极空间连通性
  const handleCheckHealth = async () => {
    if (!serverUrl.trim()) {
      addToast('error', `请输入${providerLabel}网址`);
      return;
    }
    setIsCheckingHealth(true);
    setHealthStatus(null);
    const result = await checkNasHealth(serverUrl);
    setIsCheckingHealth(false);
    if (result.success) {
      setHealthStatus(`✅ 成功连通 SafeVault 服务 (${result.name} v${result.version}，用户数: ${result.userCount})`);
      addToast('success', `${providerLabel}在线，通信正常！`);
    } else {
      setHealthStatus(`❌ 连接失败: ${result.message}`);
      addToast('error', result.message || '连接失败');
    }
  };

  // 登录或注册
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim()) {
      addToast('error', `请填写${providerLabel}访问网址`);
      return;
    }
    if (!username.trim()) {
      addToast('error', '请填写同步账号');
      return;
    }
    if (!masterPassword) {
      addToast('error', '请填写主密码用于零知识身份派生');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = activeTab === 'register'
        ? await registerNasAccount(serverUrl, username, masterPassword)
        : await loginNasAccount(serverUrl, username, masterPassword);

      if (!res.success || !res.salt) {
        if (activeTab === 'register' && res.message && (res.message.includes('已存在') || res.message.includes('409'))) {
          addToast('info', `💡 该账号在${providerLabel}中已存在，已自动切换到【登录】模式！`);
          setActiveTab('login');
        } else {
          addToast('error', res.message || `${providerLabel}${activeTab === 'register' ? '注册' : '登录'}失败`);
        }
        return;
      }

      const cleanUrl = normalizeServerUrl(serverUrl);
      const cleanUser = username.trim().toLowerCase();
      let remoteVersion = res.version;
      let lastSyncTime = res.updatedAt || null;
      let dataHash: string | undefined;

      // 为已登录的另一端首次绑定时，只在目标端为空时复制当前本地密文；
      // 目标端已有数据则只绑定，不盲目覆盖，防止切换时误删数据。
      if (syncConfig && masterKey && vaultMeta) {
        const remote = await pullVaultFromNas(cleanUrl, res.token || '');
        if (!remote.success) throw new Error(remote.message || `${providerLabel}数据状态读取失败`);
        if (remote.vaultMeta?.testCipher || (remote.encryptedItems?.length || 0) > 0) {
          remoteVersion = remote.version ?? remoteVersion;
          lastSyncTime = remote.updatedAt || lastSyncTime;
          dataHash = remote.dataHash;
          if (selectedProvider !== (syncConfig.activeProvider || syncConfig.provider || 'nas')) {
            addToast('info', `${providerLabel}已有独立数据，已安全绑定但未覆盖；切换前请先执行一次拉取或智能合并。`);
          }
        } else {
          const encryptedItems = [];
          for (const item of items) encryptedItems.push(await encryptVaultItem(masterKey, item, item.id));
          const seeded = await pushVaultToNas(
            cleanUrl,
            res.token || '',
            vaultMeta,
            encryptedItems,
            getDeviceIdentifier(),
            remote.version ?? res.version
          );
          if (!seeded.success) throw new Error(seeded.message || `${providerLabel}初始化复制失败`);
          remoteVersion = seeded.version ?? remoteVersion;
          lastSyncTime = seeded.updatedAt || lastSyncTime;
          dataHash = seeded.dataHash;
        }
      }

      const endpoint: SyncEndpointConfig = {
        provider: selectedProvider,
        serverUrl: cleanUrl,
        username: cleanUser,
        token: res.token || '',
        salt: res.salt,
        lastSyncTime,
        autoSync: isAutoSync,
        remoteVersion,
        dataHash
      };
      const newCfg = upsertSyncEndpoint(syncConfig, endpoint, true);
      saveNasSyncConfig(newCfg);
      setSyncConfig(newCfg);
      setSelectedProvider(selectedProvider);
      setServerUrl(cleanUrl);
      setUsername(cleanUser);
      addToast('success', `${providerLabel}${activeTab === 'register' ? '账号注册' : '账号登录'}成功，当前已设为主同步方案。`);
      onSyncStatusChanged?.(true, newCfg.lastSyncTime);
      setCurrentRemoteVersion(newCfg.remoteVersion ?? null);
      void refreshBackups(newCfg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 智能双向合并同步 (Smart Sync & Merge)：最安全的同步模式，双向融合最新数据，只增不减
  const handleSmartSync = async () => {
    if (!syncConfig || !vaultMeta || !masterKey) {
      addToast('error', '密码数据库未解锁或未连接极空间，无法同步');
      return;
    }
    setIsSyncing(true);
    try {
      // 1. 先拉取云端数据
      const pullExecution = await runWithSyncFailover(syncConfig, (endpoint) =>
        pullVaultFromNas(endpoint.serverUrl, endpoint.token)
      );
      const pullRes = pullExecution.result;
      if (pullExecution.failedOver) {
        addToast('info', `主方案暂时不可用，已从${pullExecution.endpoint.provider === 'aws' ? ' AWS' : '极空间 NAS'}备用方案读取数据。`);
      }
      if (!pullRes.success) {
        addToast('error', pullRes.message || '无法从任一同步方案读取数据，已停止智能同步');
        return;
      }
      let remoteDecrypted: DecryptedVaultItem[] = [];

      if (pullRes.success && pullRes.encryptedItems && pullRes.encryptedItems.length > 0) {
        try {
          remoteDecrypted = await decryptAllVaultItems(masterKey, pullRes.encryptedItems);
        } catch (decryptErr) {
          // 密文校验失败时必须停止整个合并流程；部分合并会把篡改/损坏
          // 的云端数据伪装成“缺失条目”，进而覆盖或删除本地可信数据。
          console.warn('云端金库密文校验失败，已停止智能同步:', decryptErr);
          addToast('error', '云端金库密文校验失败，已停止同步；请先恢复可信备份');
          return;
        }
      }

      // 2. 双向智能合并本地与云端条目（按 id 去重，以 updatedAt 最新为准，只增不减）
      const { mergedItems, addedFromRemote, updatedFromRemote, retainedLocalOnly } = mergeVaultItems(
        items,
        remoteDecrypted
      );

      // 3. 重新加密合并后的全量条目
      const mergedEncrypted: EncryptedVaultItem[] = [];
      for (const item of mergedItems) {
        const enc = await encryptVaultItem(masterKey, item, item.id);
        mergedEncrypted.push(enc);
      }

      // 4. 将合并后的全集推送到极空间持久化
      const effectiveMeta = pullRes.vaultMeta || vaultMeta;
      const pushExecution = await runWithSyncFailover(syncConfig, (endpoint) =>
        pushVaultToNas(
          endpoint.serverUrl,
          endpoint.token,
          effectiveMeta,
          mergedEncrypted,
          getDeviceIdentifier(),
          endpoint.provider === pullExecution.endpoint.provider
            ? pullRes.version
            : endpoint.remoteVersion
        )
      );
      const pushRes = pushExecution.result;

      if (pushRes.success) {
        // 5. 更新本地持久化与内存状态
        saveStoredVaultMeta(effectiveMeta);
        saveStoredEncryptedItems(mergedEncrypted);
        onVaultUpdatedFromRemote(effectiveMeta, mergedItems);

        const updatedCfg = persistEndpointResult(syncConfig, pushExecution.endpoint, {
          lastSyncTime: pushRes.updatedAt || new Date().toISOString(),
          remoteVersion: pushRes.version,
          dataHash: pushRes.dataHash
        });
        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
        setCurrentRemoteVersion(pushRes.version ?? null);
        void refreshBackups(updatedCfg);

        const replication = await replicateVaultToSecondary(
          updatedCfg,
          pushExecution.endpoint.provider,
          effectiveMeta,
          mergedEncrypted,
          getDeviceIdentifier()
        );
        if (replication.conflictedProviders.length > 0) {
          addToast('info', '另一同步端检测到独立更新，已保留其数据并停止自动覆盖；请在确认后执行智能合并。');
        }

        addToast(
          'success',
          `双向同步完成！已安全合并共 ${mergedItems.length} 条凭据（吸收云端 ${addedFromRemote} 条，更新 ${updatedFromRemote} 条，保留本地 ${retainedLocalOnly} 条）`
        );
      } else {
        addToast('error', pushRes.message || '双向同步推送失败');
      }
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '双向同步异常，请检查网络或主密码是否一致');
    } finally {
      setIsSyncing(false);
    }
  };

  // 立即将本地数据推送到极空间（Push，自带云端防误覆盖检查）
  const handlePushToNas = async () => {
    if (!syncConfig || !vaultMeta || !masterKey) {
      addToast('error', '密码数据库未解锁或未连接极空间，无法同步');
      return;
    }

    // 防误覆盖安全预检：先获取极空间云端凭据数量，并锁定本次推送基线版本
    let expectedVersion: number | undefined;
    let preflightEndpoint: SyncEndpointConfig | null = null;
    try {
      const statusExecution = await runWithSyncFailover(syncConfig, (endpoint) =>
        getNasSyncStatus(endpoint.serverUrl, endpoint.token)
      );
      const status = statusExecution.result;
      preflightEndpoint = statusExecution.endpoint;
      expectedVersion = status.version;
      if (status.success && status.hasData && typeof status.itemsCount === 'number') {
        if (items.length < status.itemsCount) {
          const diff = status.itemsCount - items.length;
          const confirmMerge = window.confirm(
            `⚠️ 数据安全防覆盖拦截：\n\n检测到极空间云端现有 ${status.itemsCount} 条凭据，而当前本地仅有 ${items.length} 条凭据！\n` +
            `若直接单向推送，将导致云端多出的 ${diff} 条密码凭据被抹除！\n\n` +
            `【推荐】点击「确定」：立即执行「智能双向合并」，完整保留两端全部密码，只增不减；\n` +
            `点击「取消」：安全中止本次推送。`
          );
          if (confirmMerge) {
            return handleSmartSync();
          } else {
            addToast('info', '已安全取消推送操作，极空间云端数据完好无损');
            return;
          }
        }
      }
    } catch (e) {
      console.warn('同步安全预检异常，继续执行单向推送:', e);
    }

    setIsSyncing(true);
    try {
      // 重新加密当前所有内存条目以确保数据最新
          const encryptedItems: EncryptedVaultItem[] = [];
      for (const item of items) {
        const enc = await encryptVaultItem(masterKey, item, item.id);
        encryptedItems.push(enc);
      }

      const pushExecution = await runWithSyncFailover(syncConfig, (endpoint) =>
        pushVaultToNas(
          endpoint.serverUrl,
          endpoint.token,
          vaultMeta,
          encryptedItems,
          getDeviceIdentifier(),
          endpoint.provider === preflightEndpoint?.provider ? expectedVersion : endpoint.remoteVersion
        )
      );
      const res = pushExecution.result;

      if (res.success) {
        const updatedCfg = persistEndpointResult(syncConfig, pushExecution.endpoint, {
          lastSyncTime: res.updatedAt || new Date().toISOString(),
          remoteVersion: res.version,
          dataHash: res.dataHash
        });
        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
        setCurrentRemoteVersion(res.version ?? null);
        void refreshBackups(updatedCfg);
        const replication = await replicateVaultToSecondary(
          updatedCfg,
          pushExecution.endpoint.provider,
          vaultMeta,
          encryptedItems,
          getDeviceIdentifier()
        );
        if (replication.conflictedProviders.length > 0) {
          addToast('info', '另一同步端存在未确认的独立版本，已停止覆盖；当前主方案数据仍已安全保存。');
        }
        addToast('success', `全库凭据 (${encryptedItems.length}项) 已安全保存到${pushExecution.endpoint.provider === 'aws' ? ' AWS' : '极空间 NAS'}${pushExecution.failedOver ? '备用方案' : ''}！`);
      } else {
        addToast('error', res.message || '推送失败');
      }
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '推送异常');
    } finally {
      setIsSyncing(false);
    }
  };

  // 从极空间拉取并解密恢复（Pull）
  const handlePullFromNas = async () => {
    if (!syncConfig || !masterKey) {
      addToast('error', '未连接极空间或未解锁金库，无法拉取');
      return;
    }
    setIsSyncing(true);
    try {
      const pullExecution = await runWithSyncFailover(syncConfig, (endpoint) =>
        pullVaultFromNas(endpoint.serverUrl, endpoint.token)
      );
      const res = pullExecution.result;
      if (res.success && res.vaultMeta && res.encryptedItems) {
        // 使用本地主密钥尝试解密云端条目
        const decryptedItems = await decryptAllVaultItems(masterKey, res.encryptedItems);
        
        // 持久化覆盖本地
        saveStoredVaultMeta(res.vaultMeta);
        saveStoredEncryptedItems(res.encryptedItems);
        onVaultUpdatedFromRemote(res.vaultMeta, decryptedItems);

        const updatedCfg = persistEndpointResult(syncConfig, pullExecution.endpoint, {
          lastSyncTime: res.updatedAt || new Date().toISOString(),
          remoteVersion: res.version,
          dataHash: res.dataHash
        });
        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
        setCurrentRemoteVersion(res.version ?? null);
        void refreshBackups(updatedCfg);

        addToast('success', `已从${pullExecution.endpoint.provider === 'aws' ? ' AWS' : '极空间 NAS'}${pullExecution.failedOver ? '备用方案' : ''}安全拉取并还原 ${decryptedItems.length} 条加密凭据！`);
      } else {
        addToast('info', res.message || '极空间云端暂无可拉取的金库数据');
      }
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '拉取解密失败，可能是云端主密码与本地不一致');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRollback = async (backup: NasBackupSummary) => {
    if (!syncConfig || !masterKey) {
      addToast('error', '未连接极空间或未解锁金库，无法回滚');
      return;
    }
    const confirmed = window.confirm(
      `确定要将极空间云端数据回滚到 v${backup.version} 吗？\n\n` +
      `该操作不会删除当前版本：回滚前会自动再备份当前版本，之后其他设备重新登录/同步即可获得回滚后的数据。`
    );
    if (!confirmed) return;

    setIsRollingBack(true);
    try {
      const statusExecution = await runWithSyncFailover(syncConfig, (endpoint) =>
        getNasSyncStatus(endpoint.serverUrl, endpoint.token)
      );
      const status = statusExecution.result;
      if (!status.success || typeof status.version !== 'number') {
        addToast('error', status.message || '无法确认当前云端版本，已取消回滚');
        return;
      }
      const result = await rollbackNasBackup(
        statusExecution.endpoint.serverUrl,
        statusExecution.endpoint.token,
        backup.id,
        status.version,
        getDeviceIdentifier()
      );
      if (!result.success) {
        addToast('error', result.message || '历史版本回滚失败');
        return;
      }

      const pullRes = await pullVaultFromNas(statusExecution.endpoint.serverUrl, statusExecution.endpoint.token);
      if (!pullRes.success || !pullRes.vaultMeta || !pullRes.encryptedItems) {
        addToast('error', pullRes.message || '回滚成功，但拉取回滚后的数据失败，请稍后重试');
        return;
      }
      const decryptedItems = await decryptAllVaultItems(masterKey, pullRes.encryptedItems);
      saveStoredVaultMeta(pullRes.vaultMeta);
      saveStoredEncryptedItems(pullRes.encryptedItems);
      onVaultUpdatedFromRemote(pullRes.vaultMeta, decryptedItems);

      const updatedCfg = persistEndpointResult(syncConfig, statusExecution.endpoint, {
        lastSyncTime: pullRes.updatedAt || new Date().toISOString(),
        remoteVersion: pullRes.version,
        dataHash: pullRes.dataHash
      });
      setCurrentRemoteVersion(pullRes.version ?? null);
      onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
      await refreshBackups(updatedCfg);
      addToast('success', `已回滚到 v${backup.version}，当前版本为 v${pullRes.version}`);
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '历史版本回滚异常');
    } finally {
      setIsRollingBack(false);
    }
  };

  // 切换主方案前先读取并校验目标端密文；校验失败或目标端为空时不触碰本地数据。
  const handleActivateProvider = async (provider: SyncProviderId) => {
    if (!syncConfig) return;
    const endpoint = getSyncEndpoint(syncConfig, provider);
    if (!endpoint) {
      selectProvider(provider);
      addToast('info', `请先配置${provider === 'aws' ? ' AWS' : '极空间 NAS'}同步端`);
      return;
    }
    if ((syncConfig.activeProvider || syncConfig.provider || 'nas') === provider) {
      selectProvider(provider);
      return;
    }

    setIsSyncing(true);
    try {
      const remote = await pullVaultFromNas(endpoint.serverUrl, endpoint.token);
      if (!remote.success) throw new Error(remote.message || '目标同步端不可用，未执行切换');

      if (remote.vaultMeta?.testCipher && masterKey) {
        const decryptedItems = await decryptAllVaultItems(masterKey, remote.encryptedItems || []);
        saveStoredVaultMeta(remote.vaultMeta);
        saveStoredEncryptedItems(remote.encryptedItems || []);
        onVaultUpdatedFromRemote(remote.vaultMeta, decryptedItems);
      } else if (remote.vaultMeta?.testCipher && !masterKey) {
        // 锁定状态只切换配置，不解密、不覆盖本地缓存；解锁流程会再次校验远端。
        addToast('info', '当前处于锁定状态，已切换主方案；解锁时会再次校验并读取目标端数据。');
      } else if (items.length > 0) {
        throw new Error('目标同步端为空，为防止切换后误清空本地数据，已取消切换；请先把当前库复制到该端。');
      }

      const updatedCfg = persistEndpointResult(syncConfig, endpoint, {
        lastSyncTime: remote.updatedAt || new Date().toISOString(),
        remoteVersion: remote.version,
        dataHash: remote.dataHash
      }, true);
      selectProvider(provider);
      setCurrentRemoteVersion(remote.version ?? null);
      onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
      await refreshBackups(updatedCfg);
      addToast('success', `已安全切换到${provider === 'aws' ? ' AWS' : '极空间 NAS + Cloudflare Tunnel'}主同步方案。`);
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '切换同步方案失败，原方案未改变');
    } finally {
      setIsSyncing(false);
    }
  };

  // 断开极空间连接
  const handleDisconnect = () => {
    const confirmed = window.confirm(
      '⚠️ 确定要断开此设备与极空间 NAS 的同步绑定吗？\n\n' +
      '• 断开后，当前设备将恢复为单机离线模式；\n' +
      '• 您的极空间账号与云端凭据数据完好无损，不会丢失；\n' +
      '• 如需重新连接，直接使用已有账号【登录】即可，无需重新注册。'
    );
    if (!confirmed) return;

    saveNasSyncConfig(null);
    setSyncConfig(null);
    onSyncStatusChanged?.(false, null);
    addToast('info', '已断开极空间 NAS 连接，当前设备已恢复为单机离线模式');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                极空间 NAS 数据与历史管理
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                  ZERO-KNOWLEDGE
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                DEVICE // {getDeviceIdentifier()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 弹窗主体内容 */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          
          {/* 安全背书说明卡片 */}
          <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg flex items-start gap-2.5 text-emerald-200/90">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-emerald-300">真·零知识端到端加密保护：</span>
              极空间 NAS 仅存储经过 AES-GCM 强加密的密文包与认证哈希。您的主密码绝不出本机，极空间服务器完全无权、也无数学可能解密您的凭据。
            </div>
          </div>

          {/* 两套独立同步端：可任意选择主方案，网络故障时只在安全条件下自动切换 */}
          <div className="p-3 bg-slate-800/40 border border-slate-700/70 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200">同步方案选择</span>
              <span className="text-[10px] text-slate-500">故障自动切换 · 双端密文复制</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['nas', 'aws'] as SyncProviderId[]).map((provider) => {
                const endpoint = syncConfig ? getSyncEndpoint(syncConfig, provider) : null;
                const active = (syncConfig?.activeProvider || syncConfig?.provider || 'nas') === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => selectProvider(provider)}
                    className={`text-left px-3 py-2 rounded border transition-colors ${
                      selectedProvider === provider
                        ? 'border-emerald-500/70 bg-emerald-950/40'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-100">
                        {provider === 'nas' ? '极空间 + Cloudflare' : 'AWS 同步服务器'}
                      </span>
                      <span className={`text-[9px] ${active ? 'text-emerald-400' : endpoint ? 'text-sky-400' : 'text-slate-500'}`}>
                        {active ? '主方案' : endpoint ? '已配置' : '未配置'}
                      </span>
                    </div>
                    <span className="block mt-1 truncate text-[10px] text-slate-500 font-mono">
                      {endpoint?.serverUrl || (provider === 'nas' ? DEFAULT_NAS_REMOTE_SERVER_URL : DEFAULT_AWS_SERVER_URL)}
                    </span>
                  </button>
                );
              })}
            </div>
              {syncConfig && selectedEndpoint && (syncConfig.activeProvider || syncConfig.provider || 'nas') !== selectedProvider && (
              <button
                type="button"
                onClick={() => void handleActivateProvider(selectedProvider)}
                disabled={isSyncing}
                className="w-full px-3 py-2 text-[11px] text-sky-300 border border-sky-800/70 bg-sky-950/20 hover:bg-sky-950/40 disabled:opacity-50 rounded"
              >
                校验目标密文并切换为主方案
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
              {selectedProvider === 'nas' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setServerUrl(DEFAULT_NAS_REMOTE_SERVER_URL)}
                    className="text-left px-2.5 py-2 rounded border border-sky-800/70 bg-sky-950/20 hover:bg-sky-950/40 transition-colors"
                    title="远程设备和外网使用的固定地址"
                  >
                    <span className="block text-sky-300 font-bold">NAS 远程默认地址</span>
                    <span className="block mt-1 text-slate-400 truncate">{DEFAULT_NAS_REMOTE_SERVER_URL}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setServerUrl(DEFAULT_NAS_LOCAL_SERVER_URL)}
                    className="text-left px-2.5 py-2 rounded border border-amber-800/70 bg-amber-950/20 hover:bg-amber-950/40 transition-colors"
                    title="与极空间处于同一 Wi-Fi 时的直连地址"
                  >
                    <span className="block text-amber-300 font-bold">NAS 内网第二地址</span>
                    <span className="block mt-1 text-slate-400 truncate">{DEFAULT_NAS_LOCAL_SERVER_URL}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setServerUrl(DEFAULT_AWS_SERVER_URL)}
                  className="text-left px-2.5 py-2 rounded border border-violet-800/70 bg-violet-950/20 hover:bg-violet-950/40 transition-colors sm:col-span-2"
                  title="AWS 双端同步服务默认 HTTPS 地址"
                >
                  <span className="block text-violet-300 font-bold">AWS 默认同步地址</span>
                  <span className="block mt-1 text-slate-400 truncate">{DEFAULT_AWS_SERVER_URL}</span>
                </button>
              )}
            </div>
          </div>

          {syncConfig && selectedEndpoint ? (
            /* 已连接状态展示 */
            <div className="space-y-4">
              {/* 智能检测：如果当前访问的网页地址与已保存的同步网址不同，提示一键适配 */}
              {typeof window !== 'undefined' &&
                window.location.protocol.startsWith('http') &&
                normalizeServerUrl(window.location.origin) !== normalizeServerUrl(selectedEndpoint.serverUrl) && (
                  <div className="p-3 bg-sky-950/40 border border-sky-800/60 rounded-lg text-sky-200 text-xs flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <ExternalLink className="w-4 h-4 text-sky-400 shrink-0" />
                      <div className="text-[11px] leading-snug">
                        <span>检测到当前网页网址已变更为：</span>
                        <div className="font-mono text-sky-300 font-bold truncate">
                          {window.location.origin}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedCfg = {
                          ...syncConfig,
                          serverUrl: normalizeServerUrl(window.location.origin)
                        };
                        saveNasSyncConfig(updatedCfg);
                        setSyncConfig(updatedCfg);
                        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
                        addToast('success', '已自动将极空间同步地址切换为当前网页网址！');
                      }}
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold shrink-0 transition-colors shadow"
                    >
                      一键切换为当前网址
                    </button>
                  </div>
                )}

              <div className="p-4 bg-slate-800/50 border border-slate-700/80 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-slate-100 text-sm">{selectedProvider === 'aws' ? 'AWS 同步端已联机' : '极空间 NAS 已联机'}</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    CONNECTED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  {/* NAS 网址一栏：支持随时修改更换 */}
                  {isEditingUrl ? (
                    <div className="col-span-2 bg-slate-900/90 p-3 rounded-lg border border-emerald-500/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-200">
                          更换{selectedProvider === 'aws' ? ' AWS' : '极空间 NAS'}网址 (保持当前登录，无需重新配置)
                        </label>
                        {typeof window !== 'undefined' && window.location.protocol.startsWith('http') && (
                          <button
                            type="button"
                            onClick={() => setEditUrlInput(window.location.origin)}
                            className="text-[10px] text-emerald-400 hover:underline"
                          >
                            填入当前网页网址
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={editUrlInput}
                        onChange={(e) => setEditUrlInput(e.target.value)}
                        placeholder="如: http://192.168.1.100:8088 或 新的远程域名"
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded text-slate-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingUrl(false)}
                          className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white rounded border border-slate-700"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={isSavingUrl}
                          onClick={handleSaveEditedUrl}
                          className="px-3 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-1"
                        >
                          {isSavingUrl ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                          <span>测试并保存</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-2 bg-slate-900/60 p-2.5 rounded border border-slate-700/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-400 font-mono text-[10px]">{selectedProvider === 'aws' ? 'AWS 网址' : 'NAS / Tunnel 网址'} // SERVER:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditUrlInput(selectedEndpoint.serverUrl || window.location.origin);
                            setIsEditingUrl(true);
                          }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                          title="远程域名发生变动时，可直接修改目标网址"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>更换网址 (应对域名变动)</span>
                        </button>
                      </div>
                      <span className="text-slate-200 truncate block text-xs">
                        {selectedEndpoint.serverUrl || `${window.location.origin}（跟随当前网页访问地址）`}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-500 block">同步账号 // USER:</span>
                    <span className="text-slate-200 block">{selectedEndpoint.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">本地凭据体量:</span>
                    <span className="text-slate-200 block">{items.length} 项</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-700/40">
                    <span className="text-slate-500 block">最近成功同步:</span>
                    <span className="text-slate-200 block">
                      {selectedEndpoint.lastSyncTime
                        ? new Date(selectedEndpoint.lastSyncTime).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })
                        : '登录后自动获取'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮组 */}
              <div className="space-y-2.5">
                <div className="text-[11px] leading-relaxed text-slate-400 px-1">
                  新增、修改和删除会自动写入当前主同步方案；若网络故障，软件只在版本与密文校验通过后切换到另一方案。
                </div>
                <button
                  onClick={handlePullFromNas}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-md transition-all text-xs"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-emerald-100" />
                  )}
                  <span>立即刷新当前同步方案</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handlePushToNas}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
                    title="将本地数据推送至当前主方案，并在安全条件下复制到另一方案"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>恢复性上传</span>
                  </button>

                  <button
                    onClick={handlePullFromNas}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
                    title="校验后从当前主方案拉取数据并覆盖本地"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5 text-sky-400" />
                    <span>重新下载</span>
                  </button>
                </div>
                <button
                  onClick={handleSmartSync}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 text-[11px] text-amber-300 border border-amber-800/60 bg-amber-950/20 hover:bg-amber-950/40 rounded transition-colors"
                  title="仅用于旧版独立本地库迁移或故障恢复，日常使用不需要"
                >
                  兼容旧数据合并（仅迁移 / 恢复）
                </button>
              </div>

              {/* 云端历史版本：每次覆盖或回滚前都会先生成快照 */}
              <div className="p-3 bg-slate-900/60 border border-slate-700/60 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-100 font-bold text-xs">
                    <History className="w-3.5 h-3.5 text-amber-400" />
                    <span>云端历史备份 / 可回滚</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      当前 v{currentRemoteVersion ?? '—'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshBackups()}
                    disabled={isLoadingBackups || isRollingBack}
                    className="text-[10px] text-sky-400 hover:text-sky-300 disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    <span>刷新</span>
                  </button>
                </div>
                {backups.length === 0 ? (
                  <p className="text-[10px] text-slate-500">暂无历史版本。首次成功推送后，后续覆盖会自动生成备份。</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-none">
                    {backups.slice(0, 8).map((backup) => (
                      <div key={backup.id} className="flex items-center justify-between gap-2 px-2.5 py-2 bg-slate-800/80 border border-slate-700/50 rounded">
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-200 font-mono">
                            v{backup.version} · {backup.itemsCount} 项
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {backup.updatedAt ? new Date(backup.updatedAt).toLocaleString('zh-CN') : '未知时间'} · {backup.deviceName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRollback(backup)}
                          disabled={isSyncing || isRollingBack}
                          className="shrink-0 px-2 py-1 text-[10px] text-amber-300 border border-amber-700/60 hover:bg-amber-950/50 disabled:opacity-50 rounded flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>回滚</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] leading-relaxed text-slate-500">
                  回滚前会再次备份当前版本；旧设备推送时若版本过期会被拒绝，不会覆盖新数据。
                </p>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>手机端、桌面端和 NAS/AWS 使用相同账号即可互通</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-800/50 rounded transition-colors flex items-center gap-1"
                  title="仅解除此设备与极空间的同步绑定，云端账号与数据不受影响"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>断开此设备绑定</span>
                </button>
              </div>
            </div>
          ) : (
            /* 未连接状态：配置表单 */
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              
              {/* 选项卡：登录 vs 注册 */}
              <div className="flex border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors ${
                    activeTab === 'login'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  登录已有同步账号
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors ${
                    activeTab === 'register'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  注册新同步账号
                </button>
              </div>

              {activeTab === 'register' && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-amber-200 text-[11px] leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300">温馨提示：</span>
                    同步账号在当前同步服务器上<strong>只需注册一次</strong>！如果您此前已在其他设备注册过，请直接切换到<strong>「登录已有同步账号」</strong>登录，切勿重复注册。
                  </div>
                </div>
              )}

              {/* 当前同步方案访问网址 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-200">
                    {providerLabel}网址 (HTTPS 公网地址或局域网地址)
                  </label>
                  <button
                    type="button"
                    onClick={handleCheckHealth}
                    disabled={isCheckingHealth}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    {isCheckingHealth ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : null}
                    <span>测试连通性</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={selectedProvider === 'aws' ? '例如: https://aws-safevault.example.com' : '例如: http://192.168.5.134:18088 或 Cloudflare Tunnel 地址'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
                {healthStatus && (
                  <p className="mt-1 text-[11px] font-mono text-slate-400">{healthStatus}</p>
                )}
              </div>

              {/* 同步账号 */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  同步账号 (Username)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="如: admin 或 您的英文代号"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* 主密码 */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  主密码 (Master Password)
                </label>
                <input
                  type="password"
                  required
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="输入主密码 (仅在本地计算认证散列，绝不上传)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  多端设备必须使用完全一致的主密码，才能解密同一份极空间云端凭据。
                </p>
              </div>

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded transition-colors text-xs"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                <span>{activeTab === 'register' ? '立即注册并连接极空间' : '验证登录并接入极空间'}</span>
              </button>
            </form>
          )}

        </div>

        {/* 底部提示 */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>SAFEVAULT SYNC PROTOCOL V1.1 // ZERO-KNOWLEDGE</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors text-xs font-sans"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
