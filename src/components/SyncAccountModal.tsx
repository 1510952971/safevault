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
  LogOut
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
        if (res.success && res.token && res.salt) {
          const newCfg: NasSyncConfig = {
            serverUrl: normalizeServerUrl(serverUrl),
            username: username.trim().toLowerCase(),
            token: res.token,
            salt: res.salt,
            lastSyncTime: null,
            autoSync: isAutoSync
          };
          saveNasSyncConfig(newCfg);
          setSyncConfig(newCfg);
          addToast('success', '极空间账号注册并绑定成功！');
          onSyncStatusChanged?.(true, null);
        } else {
          addToast('error', res.message || '注册失败');
        }
      } else {
        const res = await loginNasAccount(serverUrl, username, masterPassword);
        if (res.success && res.token && res.salt) {
          const newCfg: NasSyncConfig = {
            serverUrl: normalizeServerUrl(serverUrl),
            username: username.trim().toLowerCase(),
            token: res.token,
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

  // 立即将本地数据推送到极空间（Push）
  const handlePushToNas = async () => {
    if (!syncConfig || !vaultMeta || !masterKey) {
      addToast('error', '金库未解锁或未连接极空间，无法同步');
      return;
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
    saveNasSyncConfig(null);
    setSyncConfig(null);
    onSyncStatusChanged?.(false, null);
    addToast('info', '已断开极空间 NAS 连接，恢复为单机离线模式');
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
                  <div>
                    <span className="text-slate-500 block">NAS 网址 // SERVER:</span>
                    <span className="text-slate-200 truncate block">{syncConfig.serverUrl}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">同步账号 // USER:</span>
                    <span className="text-slate-200 block">{syncConfig.username}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">本地凭据体量:</span>
                    <span className="text-slate-200 block">{items.length} 项</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">最近成功同步:</span>
                    <span className="text-slate-200 block">
                      {syncConfig.lastSyncTime
                        ? new Date(syncConfig.lastSyncTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '待首次同步'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮组 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePushToNas}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-bold transition-colors"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                  )}
                  <span>立即推送至 NAS (Push)</span>
                </button>

                <button
                  onClick={handlePullFromNas}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-600 rounded font-bold transition-colors"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                  )}
                  <span>从 NAS 拉取覆盖 (Pull)</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-400">可在手机端输入相同网址与账号登录实现无缝双向互通</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>断开连接</span>
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
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
