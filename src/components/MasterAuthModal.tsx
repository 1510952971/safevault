import React, { useState, useEffect } from 'react';
import { Shield, Lock, KeyRound, Eye, EyeOff, AlertTriangle, RefreshCw, UploadCloud, ShieldAlert } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/crypto';
import { SafeVaultLogo } from './SafeVaultLogo';

interface MasterAuthModalProps {
  isInitialized: boolean;
  onInitialize: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<boolean>;
  onOpenRestore: () => void;
  onResetVault: () => void;
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
  onInitialize,
  onUnlock,
  onOpenRestore,
  onResetVault
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isInitialized) {
      if (password.length < 6) {
        setErrorMsg('主密码长度不得少于 6 位');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('两次输入的密码不一致');
        return;
      }

      try {
        setIsVerifying(true);
        await onInitialize(password);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '初始化失败');
      } finally {
        setIsVerifying(false);
      }
    } else {
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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative bg-white border border-slate-300 rounded-lg w-full max-w-md shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* 四角战术刻度标 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 顶部战术标识 */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <SafeVaultLogo size={22} className="shrink-0" />
            <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
              SAFEVAULT // SECURITY AUTH
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">STATUS: LOCKED</span>
        </div>

        {/* 标题 */}
        <div className="mb-6">
          <div className="border-l-4 border-brand-lime pl-2.5 mb-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {isInitialized ? '终端身份验证' : '初始化主密码'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            {isInitialized
              ? '密码数据已采用 AES-256 强加密，请输入主密码解锁终端并载入凭据。'
              : 'SafeVault 绝不存储您的主密码。它是派生 AES 密钥的唯一钥匙，务必牢记。'}
          </p>
        </div>

        {/* 防爆破锁定警示横幅 */}
        {cooldownRemaining > 0 && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start gap-2.5 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900">⚠️ 防暴力破解锁定已激活</div>
              <div className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                连续验证失败已达 {failedAttempts} 次。安全防御中枢已临时冻结密码验证，请等待 <strong className="font-mono text-sm text-rose-900 font-bold px-1 bg-rose-100 rounded">{cooldownRemaining}</strong> 秒后自动解封。
              </div>
            </div>
          </div>
        )}

        {errorMsg && cooldownRemaining <= 0 && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>{isInitialized ? '输入主密码' : '设定主密码 (>=6位)'}</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                disabled={cooldownRemaining > 0 || isVerifying}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={cooldownRemaining > 0 ? `安全冷却中，请等待 ${cooldownRemaining} 秒...` : "••••••••••••"}
                className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 transition-all disabled:opacity-50 disabled:bg-slate-100"
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

            {!isInitialized && password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>强度：{strength.label}</span>
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

          {!isInitialized && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>再次确认主密码</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入以确认"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 transition-all"
              />
            </div>
          )}

          {/* 战术按钮 */}
          <button
            type="submit"
            disabled={isVerifying || cooldownRemaining > 0}
            className="w-full flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className={`w-10 h-11 ${cooldownRemaining > 0 ? 'bg-rose-500 text-white' : 'bg-brand-lime text-slate-900'} flex items-center justify-center font-bold shrink-0 transition-colors`}>
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 text-center font-bold text-xs tracking-wider">
              {isVerifying ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-lime" />
                  <span>密码学运算中...</span>
                </span>
              ) : cooldownRemaining > 0 ? (
                `防爆破锁定中 (${cooldownRemaining}s)`
              ) : isInitialized ? (
                '解锁终端 // UNLOCK TERMINAL'
              ) : (
                '立即初始化密码数据库'
              )}
            </div>
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
          <button
            type="button"
            onClick={onOpenRestore}
            className="hover:text-slate-900 transition-colors flex items-center gap-1"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>导入备份恢复</span>
          </button>

          {isInitialized && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('⚠️ 危险操作警告：\n\n重置密码库将彻底清空当前设备本地保存的所有加密凭据与主密码，恢复至出厂未初始化状态！\n\n（若您此前导出了 .safevault.json 备份或同步到了极空间 NAS，可随时重新导入恢复）\n\n您确定要清空并重置密码库吗？')) {
                  onResetVault();
                }
              }}
              className="text-slate-400 hover:text-rose-600 transition-colors"
            >
              重置密码库
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
