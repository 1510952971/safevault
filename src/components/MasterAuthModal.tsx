import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  ShieldAlert,
  Server,
  Cloud,
  User,
  LogOut,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { calculatePasswordStrength } from '../utils/crypto';
import { SafeVaultLogo } from './SafeVaultLogo';
import { normalizeServerUrl } from '../utils/sync';

export interface MasterAuthModalProps {
  isInitialized: boolean;
  currentAccount: string | null;
  onLogin: (username: string, masterPassword: string, customServerUrl?: string) => Promise<{ success: boolean; message?: string } | boolean>;
  onRegister: (username: string, masterPassword: string, customServerUrl?: string) => Promise<{ success: boolean; message?: string } | boolean>;
  onUnlock: (password: string) => Promise<boolean>;
  onLogout: () => void;
  onOpenRestore: () => void;
  onResetVault: () => void;
  onInitializeStandalone?: (password: string) => Promise<void>;
}

const RATE_LIMIT_STORAGE_KEY = 'safevault_auth_ratelimit_v1';

function getStoredRateLimit(): { failedCount: number; lockedUntil: number } {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return { failedCount: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { failedCount: 0, lockedUntil: 0 };
  }
}

function saveStoredRateLimit(failedCount: number, lockedUntil: number) {
  try {
    sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify({ failedCount, lockedUntil }));
  } catch {}
}

function clearStoredRateLimit() {
  try {
    sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  } catch {}
}

// 阶梯式防暴力破解冷却时间 (秒)
export function getCooldownSecondsForAttempts(attempts: number): number {
  if (attempts >= 10) return 300; // 连续 10 次输错：冻结 5 分钟
  if (attempts >= 8) return 60;   // 连续 8 次输错：冻结 1 分钟
  if (attempts >= 5) return 30;   // 连续 5 次输错：冻结 30 秒
  if (attempts >= 3) return 5;    // 连续 3 次输错：冻结 5 秒
  return 0;
}

export const MasterAuthModal: React.FC<MasterAuthModalProps> = ({
  isInitialized,
  currentAccount,
  onLogin,
  onRegister,
  onUnlock,
  onLogout,
  onOpenRestore,
  onResetVault,
  onInitializeStandalone
}) => {
  void isInitialized;
  void onResetVault;
  // 未登录时的选项卡：login (登录已有账号) | register (注册新账号) | standalone (离线单机)
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'standalone'>('login');

  // 表单状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 高级连接设置（可折叠）
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(() => {
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      return window.location.origin;
    }
    return '';
  });

  // 防暴力破解状态 (基于 sessionStorage 跨刷新持久化)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => getStoredRateLimit().failedCount);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    const { lockedUntil } = getStoredRateLimit();
    const diff = Math.ceil((lockedUntil - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  const strength = calculatePasswordStrength(password);

  // 冷却实时每秒倒计时
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // 已登录状态下的快速解锁
  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cooldownRemaining > 0) {
      setErrorMsg(`⚠️ 安全防爆破锁定已激活：请等待 ${cooldownRemaining} 秒后重试`);
      return;
    }

    if (!password) {
      setErrorMsg('请输入主密码');
      return;
    }

    try {
      setIsVerifying(true);
      const success = await onUnlock(password);
      if (success) {
        clearStoredRateLimit();
        setFailedAttempts(0);
        setCooldownRemaining(0);
      } else {
        const newFailed = failedAttempts + 1;
        setFailedAttempts(newFailed);
        const cooldownSecs = getCooldownSecondsForAttempts(newFailed);
        if (cooldownSecs > 0) {
          const lockedUntil = Date.now() + cooldownSecs * 1000;
          saveStoredRateLimit(newFailed, lockedUntil);
          setCooldownRemaining(cooldownSecs);
          setErrorMsg(`主密码错误（已连续输错 ${newFailed} 次）。安全冷却已触发，请等待 ${cooldownSecs} 秒后重试。`);
        } else {
          saveStoredRateLimit(newFailed, 0);
          setErrorMsg(`主密码验证错误，请仔细核对后重试（已连续输错 ${newFailed} 次）`);
        }
      }
    } catch (_err) {
      setErrorMsg('解密异常，请重试');
    } finally {
      setIsVerifying(false);
    }
  };

  // 账号登录提交
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('请填写同步账号');
      return;
    }
    if (!password) {
      setErrorMsg('请填写主密码');
      return;
    }

    setIsVerifying(true);
    try {
      const ok = await onLogin(username.trim().toLowerCase(), password, customServerUrl);
      if (!ok) {
        setErrorMsg('登录失败：账号或密码不匹配，或极空间服务尚未连通');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录发生异常';
      if (msg.includes('未找到') || msg.includes('404')) {
        setErrorMsg('该账号在极空间中尚未注册，已为您自动切换至【注册】！');
        setAuthTab('register');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // 账号注册提交
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();
    if (cleanUser.length < 3) {
      setErrorMsg('账号名称长度不得少于 3 个字符');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('主密码长度不得少于 6 位');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
      return;
    }

    setIsVerifying(true);
    try {
      const ok = await onRegister(cleanUser, password, customServerUrl);
      if (!ok) {
        setErrorMsg('注册失败，请检查极空间连通性');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '注册发生异常';
      if (msg.includes('已在极空间') || msg.includes('409') || msg.includes('已存在')) {
        setErrorMsg('该账号已存在，已为您切换至【登录】模式！');
        setAuthTab('login');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // 离线单机初始化
  const handleStandaloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('主密码长度不得少于 6 位');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
      return;
    }

    if (!onInitializeStandalone) return;
    setIsVerifying(true);
    try {
      await onInitializeStandalone(password);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '初始化单机数据库失败');
    } finally {
      setIsVerifying(false);
    }
  };

  // -------------------------------------------------------------
  // 视图渲染：根据是否处于已登录状态展示不同界面
  // -------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-white border border-slate-300 rounded-xl w-full max-w-md shadow-2xl p-6 sm:p-7 overflow-hidden">
        
        {/* 顶部极简装饰刻度 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-[10px]">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-[10px]">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-[10px]">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-[10px]">┘</div>

        {/* 顶部品牌与安全认证标识 */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <SafeVaultLogo size={22} className="shrink-0" />
            <span className="font-mono text-xs font-bold text-slate-900 tracking-wider">
              SAFEVAULT // 密码数据库
            </span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
            {currentAccount ? 'STATUS: LOCKED' : 'ACCOUNT AUTH'}
          </span>
        </div>

        {/* 防爆破锁定警示横幅 */}
        {cooldownRemaining > 0 && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start gap-2.5 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900">⚠️ 防暴力破解锁定已激活</div>
              <div className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                连续验证失败已达 {failedAttempts} 次。安全防御中枢已临时冻结，请等待 <strong className="font-mono text-sm text-rose-900 font-bold px-1 bg-rose-100 rounded">{cooldownRemaining}</strong> 秒后自动解封。
              </div>
            </div>
          </div>
        )}

        {/* 错误提示横幅 */}
        {errorMsg && cooldownRemaining <= 0 && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* 场景 A：已登录账号状态下的快速锁屏解锁 */}
        {currentAccount ? (
          <div className="space-y-4">
            <div>
              <div className="border-l-4 border-emerald-500 pl-2.5 mb-1.5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>解锁终端</span>
                  <span className="text-xs font-mono font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{currentAccount}</span>
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                终端已安全锁定。请输入主密码解锁并载入 [{currentAccount}] 的凭据。
              </p>
            </div>

            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>输入主密码</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    disabled={cooldownRemaining > 0 || isVerifying}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={cooldownRemaining > 0 ? `安全冷却中 (${cooldownRemaining}s)...` : "••••••••••••"}
                    className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={cooldownRemaining > 0}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1 disabled:opacity-30"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-slate-900" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying || cooldownRemaining > 0}
                className="w-full flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50"
              >
                <div className={`w-10 h-11 ${cooldownRemaining > 0 ? 'bg-rose-500 text-white' : 'bg-brand-lime text-slate-900'} flex items-center justify-center font-bold shrink-0`}>
                  <span className="text-base font-mono">&gt;</span>
                </div>
                <div className="flex-1 text-center font-bold text-xs tracking-wider">
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-lime" />
                      <span>解密并验证中...</span>
                    </span>
                  ) : cooldownRemaining > 0 ? (
                    `防爆破锁定中 (${cooldownRemaining}s)`
                  ) : (
                    '解锁终端 // UNLOCK TERMINAL'
                  )}
                </div>
              </button>
            </form>

            {/* 底部操作：退出登录 / 切换账号 */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`确定要退出当前账号 [${currentAccount}] 吗？\n\n退出后将返回账号登录页面，可自由切换其他账号。`)) {
                    setPassword('');
                    onLogout();
                  }
                }}
                className="text-slate-600 hover:text-rose-600 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>切换账号 / 退出登录</span>
              </button>

              <button
                type="button"
                onClick={onOpenRestore}
                className="hover:text-slate-900 transition-colors flex items-center gap-1"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>导入备份恢复</span>
              </button>
            </div>
          </div>
        ) : (
          /* 场景 B：未登录状态下的统一账号中心 (登录 / 注册) */
          <div className="space-y-4">
            
            {/* 顶栏模式切换选项卡 */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => { setAuthTab('login'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-center text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                  authTab === 'login'
                    ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>账号登录</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('register'); setErrorMsg(''); }}
                className={`flex-1 py-2 text-center text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                  authTab === 'register'
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>注册新账号</span>
              </button>
            </div>

            {/* 模式 1：账号登录 */}
            {authTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    同步账号 (Username)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入已注册的账号"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    主密码 (Master Password)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入主密码 (本地解密派生，绝不上云)"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 高级设置折叠区 (针对远程域名或自定义服务器) */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <span>⚙️ 高级连接设置</span>
                    {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showAdvanced && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>极空间 NAS 服务网址 (默认跟随当前网页)：</span>
                        {typeof window !== 'undefined' && window.location.protocol.startsWith('http') && (
                          <button
                            type="button"
                            onClick={() => setCustomServerUrl(window.location.origin)}
                            className="text-[10px] text-emerald-600 hover:underline"
                          >
                            自动当前
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={customServerUrl}
                        onChange={(e) => setCustomServerUrl(e.target.value)}
                        placeholder="留空则自动使用当前网页地址"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-[11px]"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50"
                >
                  <div className="w-10 h-10 bg-brand-lime text-slate-900 flex items-center justify-center font-bold shrink-0">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-center font-bold text-xs tracking-wider">
                    {isVerifying ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-lime" />
                        <span>正在登录并拉取金库...</span>
                      </span>
                    ) : (
                      '登录并进入密码数据库'
                    )}
                  </div>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => { setAuthTab('register'); setErrorMsg(''); }}
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    没有账号？立即注册专属同步账号 →
                  </button>
                </div>
              </form>
            )}

            {/* 模式 2：注册新账号 */}
            {authTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    创建账号 (Username)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="英文字母或数字组合 (如: admin 或 yourname)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    设定主密码（不少于 6 位）
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="设置高强度主密码 (务必牢记，绝不上云)"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {password && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>密码强度：{strength.label}</span>
                        <span>{strength.score}%</span>
                      </div>
                      <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${strength.colorClass} transition-all duration-300`}
                          style={{ width: `${strength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    再次确认主密码
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入以确认主密码"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>

                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px] leading-relaxed">
                  💡 <strong>重要安全机制</strong>：主密码是派生端到端加密密钥的唯一钥匙，极空间服务器绝不保存您的主密码。请务必牢记。
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full flex items-center bg-emerald-600 hover:bg-emerald-500 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50"
                >
                  <div className="w-10 h-10 bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-center font-bold text-xs tracking-wider">
                    {isVerifying ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>正在极空间注册中...</span>
                      </span>
                    ) : (
                      '立即注册并建立密码库'
                    )}
                  </div>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => { setAuthTab('login'); setErrorMsg(''); }}
                    className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    已有账号？直接登录 →
                  </button>
                </div>
              </form>
            )}

            {/* 模式 3：离线单机模式 (应急备用) */}
            {authTab === 'standalone' && (
              <form onSubmit={handleStandaloneSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    设定离线单机主密码（不少于 6 位）
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="仅在此设备本地存储，不连极空间"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    确认主密码
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入以确认"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-2 bg-slate-800 text-white rounded text-xs font-bold"
                >
                  创建离线单机数据库
                </button>
              </form>
            )}

            {/* 底部应急操作 */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
              <button
                type="button"
                onClick={onOpenRestore}
                className="hover:text-slate-900 transition-colors flex items-center gap-1"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>导入备份恢复</span>
              </button>

              {authTab !== 'standalone' && onInitializeStandalone && (
                <button
                  type="button"
                  onClick={() => setAuthTab('standalone')}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  单机脱机模式
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
