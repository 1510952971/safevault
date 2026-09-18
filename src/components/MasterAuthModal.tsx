import React, { useState } from 'react';
import { Shield, Lock, KeyRound, Eye, EyeOff, AlertTriangle, RefreshCw, UploadCloud, Terminal } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/crypto';

interface MasterAuthModalProps {
  isInitialized: boolean;
  onInitialize: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<boolean>;
  onOpenRestore: () => void;
  onResetVault: () => void;
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

  const strength = calculatePasswordStrength(password);

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
      if (!password) {
        setErrorMsg('请输入主密码');
        return;
      }

      try {
        setIsVerifying(true);
        const success = await onUnlock(password);
        if (!success) {
          setErrorMsg('主密码验证错误，请仔细核对后重试');
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
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-brand-lime">
              <Terminal className="w-3.5 h-3.5" />
            </div>
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

        {errorMsg && (
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1"
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
            disabled={isVerifying}
            className="w-full flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50"
          >
            <div className="w-10 h-11 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 text-center font-bold text-xs tracking-wider">
              {isVerifying ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-lime" />
                  <span>密码学运算中...</span>
                </span>
              ) : isInitialized ? (
                '解锁终端 // UNLOCK TERMINAL'
              ) : (
                '立即初始化安全保险箱'
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
              onClick={onResetVault}
              className="text-slate-400 hover:text-rose-600 transition-colors"
            >
              重置金库
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
