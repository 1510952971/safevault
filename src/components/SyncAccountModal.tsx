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
  Edit3
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
  mergeVaultItems,
  getDeviceIdentifier,
  normalizeServerUrl
} from '../utils/sync';
import { VaultMeta, DecryptedVaultItem } from '../types/vault';
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

  // 输入表单状态
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [isAutoSync, setIsAutoSync] = useState(true);

  // 运行状态
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  // 动态修改/切换 NAS 网址状态 (应对极空间远程域名变动)
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  // 保存并更新 NAS 网址 (无感切换，不丢失登录会话与 Token)
  const handleSaveEditedUrl = async () => {
    if (!editUrlInput.trim() || !syncConfig) return;
    const cleanUrl = normalizeServerUrl(editUrlInput);
    setIsSavingUrl(true);
    const health = await checkNasHealth(cleanUrl);
    setIsSavingUrl(false);
    if (!health.success) {
      const proceed = window.confirm(`⚠️ 连通性测试未通过：${health.message || '无法连接该网址'}\n\n是否仍要强制保存该网址？`);
      if (!proceed) return;
    }
    const updatedCfg: NasSyncConfig = {
      ...syncConfig,
      serverUrl: cleanUrl
    };
    saveNasSyncConfig(updatedCfg);
    setSyncConfig(updatedCfg);
    onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
    setIsEditingUrl(false);
    addToast('success', `极空间同步网址已成功更新为：${cleanUrl}`);
  };

  useEffect(() => {
    if (isOpen) {
      const cfg = loadNasSyncConfig();
      setSyncConfig(cfg);
      if (cfg) {
        setServerUrl(cfg.serverUrl);
        setUsername(cfg.username);
        setIsAutoSync(cfg.autoSync);
      } else {
        // 若当前处于 NAS 容器托管的网页下，自动预填当前 origin
        if (window.location.port === '8088' || window.location.pathname.startsWith('/')) {
          setServerUrl(window.location.origin);
        } else {
          setServerUrl('http://192.168.1.100:8088');
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 测试极空间连通性
  const handleCheckHealth = async () => {
    if (!serverUrl.trim()) {
      addToast('error', '请输入极空间 NAS 网址');
      return;
    }
    setIsCheckingHealth(true);
    setHealthStatus(null);
    const result = await checkNasHealth(serverUrl);
    setIsCheckingHealth(false);
    if (result.success) {
      setHealthStatus(`✅ 成功连通极空间服务 (${result.name} v${result.version}，用户数: ${result.userCount})`);
      addToast('success', '极空间 NAS 服务在线，通信正常！');
    } else {
      setHealthStatus(`❌ 连接失败: ${result.message}`);
      addToast('error', result.message || '连接失败');
    }
  };

  // 登录或注册
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim()) {
      addToast('error', '请填写极空间 NAS 访问网址');
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
      if (activeTab === 'register') {
        const res = await registerNasAccount(serverUrl, username, masterPassword);
        if (res.success && res.salt) {
          const newCfg: NasSyncConfig = {
            serverUrl: normalizeServerUrl(serverUrl),
            username: username.trim().toLowerCase(),
            token: res.token || '',
            salt: res.salt,
            lastSyncTime: null,
            autoSync: isAutoSync
          };
          saveNasSyncConfig(newCfg);
          setSyncConfig(newCfg);
          addToast('success', '极空间账号注册并绑定成功！');
          onSyncStatusChanged?.(true, null);
        } else {
          if (res.message && (res.message.includes('已存在') || res.message.includes('409'))) {
            addToast('info', '💡 该账号在极空间中已存在，已自动为您切换至【登录】模式！');
            setActiveTab('login');
          } else {
            addToast('error', res.message || '注册失败');
          }
        }
      } else {
        const res = await loginNasAccount(serverUrl, username, masterPassword);
        if (res.success && res.salt) {
          const newCfg: NasSyncConfig = {
            serverUrl: normalizeServerUrl(serverUrl),
            username: username.trim().toLowerCase(),
            token: res.token || '',
            salt: res.salt,
            lastSyncTime: null,
            autoSync: isAutoSync
          };
          saveNasSyncConfig(newCfg);
          setSyncConfig(newCfg);
          addToast('success', '极空间账号登录成功，已联机！');
          onSyncStatusChanged?.(true, null);
        } else {
          addToast('error', res.message || '登录失败，请检查账号或密码');
        }
      }
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
      const pullRes = await pullVaultFromNas(syncConfig.serverUrl, syncConfig.token);
      let remoteDecrypted: DecryptedVaultItem[] = [];

      if (pullRes.success && pullRes.encryptedItems && pullRes.encryptedItems.length > 0) {
        try {
          remoteDecrypted = await decryptAllVaultItems(masterKey, pullRes.encryptedItems);
        } catch (decryptErr) {
          console.warn('解密云端条目部分或全部失败，将仅合并成功解密部分:', decryptErr);
        }
      }

      // 2. 双向智能合并本地与云端条目（按 id 去重，以 updatedAt 最新为准，只增不减）
      const { mergedItems, addedFromRemote, updatedFromRemote, retainedLocalOnly } = mergeVaultItems(
        items,
        remoteDecrypted
      );

      // 3. 重新加密合并后的全量条目
      const mergedEncrypted = [];
      for (const item of mergedItems) {
        const enc = await encryptVaultItem(masterKey, item, item.id);
        mergedEncrypted.push(enc);
      }

      // 4. 将合并后的全集推送到极空间持久化
      const effectiveMeta = pullRes.vaultMeta || vaultMeta;
      const pushRes = await pushVaultToNas(
        syncConfig.serverUrl,
        syncConfig.token,
        effectiveMeta,
        mergedEncrypted,
        getDeviceIdentifier()
      );

      if (pushRes.success) {
        // 5. 更新本地持久化与内存状态
        saveStoredVaultMeta(effectiveMeta);
        saveStoredEncryptedItems(mergedEncrypted);
        onVaultUpdatedFromRemote(effectiveMeta, mergedItems);

        const updatedCfg = { ...syncConfig, lastSyncTime: pushRes.updatedAt || new Date().toISOString() };
        saveNasSyncConfig(updatedCfg);
        setSyncConfig(updatedCfg);
        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);

        addToast(
          'success',
          `双向同步完成！已安全合并共 ${mergedItems.length} 条凭据（吸收云端 ${addedFromRemote} 条，更新 ${updatedFromRemote} 条，保留本地 ${retainedLocalOnly} 条）`
        );
      } else {
        addToast('error', pushRes.message || '双向同步推送到极空间失败');
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

    // 防误覆盖安全预检：先获取极空间云端凭据数量
    try {
      const status = await getNasSyncStatus(syncConfig.serverUrl, syncConfig.token);
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
      const encryptedItems = [];
      for (const item of items) {
        const enc = await encryptVaultItem(masterKey, item, item.id);
        encryptedItems.push(enc);
      }

      const res = await pushVaultToNas(
        syncConfig.serverUrl,
        syncConfig.token,
        vaultMeta,
        encryptedItems,
        getDeviceIdentifier()
      );

      if (res.success) {
        const updatedCfg = { ...syncConfig, lastSyncTime: res.updatedAt || new Date().toISOString() };
        saveNasSyncConfig(updatedCfg);
        setSyncConfig(updatedCfg);
        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);
        addToast('success', `全库凭据 (${encryptedItems.length}项) 已成功安全推送至极空间 NAS！`);
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
      const res = await pullVaultFromNas(syncConfig.serverUrl, syncConfig.token);
      if (res.success && res.vaultMeta && res.encryptedItems) {
        // 使用本地主密钥尝试解密云端条目
        const decryptedItems = await decryptAllVaultItems(masterKey, res.encryptedItems);
        
        // 持久化覆盖本地
        saveStoredVaultMeta(res.vaultMeta);
        saveStoredEncryptedItems(res.encryptedItems);
        onVaultUpdatedFromRemote(res.vaultMeta, decryptedItems);

        const updatedCfg = { ...syncConfig, lastSyncTime: res.updatedAt || new Date().toISOString() };
        saveNasSyncConfig(updatedCfg);
        setSyncConfig(updatedCfg);
        onSyncStatusChanged?.(true, updatedCfg.lastSyncTime);

        addToast('success', `已成功从极空间拉取并还原 ${decryptedItems.length} 条加密凭据！`);
      } else {
        addToast('info', res.message || '极空间云端暂无可拉取的金库数据');
      }
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : '拉取解密失败，可能是云端主密码与本地不一致');
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
                极空间 NAS 容器化多端同步中心
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

          {syncConfig ? (
            /* 已连接状态展示 */
            <div className="space-y-4">
              {/* 智能检测：如果当前访问的网页地址与已保存的同步网址不同，提示一键适配 */}
              {typeof window !== 'undefined' &&
                window.location.protocol.startsWith('http') &&
                normalizeServerUrl(window.location.origin) !== normalizeServerUrl(syncConfig.serverUrl) && (
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
                    <span className="font-bold text-slate-100 text-sm">极空间联机同步就绪</span>
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
                          更换极空间 NAS 网址 (保持当前登录，无需重新配置)
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
                        <span className="text-slate-400 font-mono text-[10px]">NAS 网址 // SERVER:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditUrlInput(syncConfig.serverUrl);
                            setIsEditingUrl(true);
                          }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                          title="远程域名发生变动时，可直接修改目标网址"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>更换网址 (应对域名变动)</span>
                        </button>
                      </div>
                      <span className="text-slate-200 truncate block text-xs">{syncConfig.serverUrl}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-500 block">同步账号 // USER:</span>
                    <span className="text-slate-200 block">{syncConfig.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">本地凭据体量:</span>
                    <span className="text-slate-200 block">{items.length} 项</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-700/40">
                    <span className="text-slate-500 block">最近成功同步:</span>
                    <span className="text-slate-200 block">
                      {syncConfig.lastSyncTime
                        ? new Date(syncConfig.lastSyncTime).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })
                        : '待首次同步'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮组 */}
              <div className="space-y-2.5">
                {/* 核心主推荐按钮：智能双向合并同步 */}
                <button
                  onClick={handleSmartSync}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-md transition-all text-xs"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-emerald-100" />
                  )}
                  <span>智能双向同步 (推荐 · 自动合并两端最新，防丢失)</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handlePushToNas}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
                    title="将本地数据推送至极空间（若本地数据少于云端会自动拦截预警）"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>单向推送 (Push)</span>
                  </button>

                  <button
                    onClick={handlePullFromNas}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors"
                    title="从极空间拉取数据并覆盖本地"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5 text-sky-400" />
                    <span>单向拉取 (Pull)</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>手机端或其他设备输入相同账号登录即可互通</span>
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
                    同步账号在极空间 NAS 上<strong>只需注册一次</strong>！如果您此前已在电脑端或其他设备注册过，请直接切换到<strong>「登录已有同步账号」</strong>登录，切勿重复注册。
                  </div>
                </div>
              )}

              {/* 极空间 NAS 访问网址 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-200">
                    极空间 NAS 网址 (局域网 IP 或 极空间远程域名)
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
                  placeholder="例如: http://192.168.1.100:8088 或 极空间远程网址"
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
