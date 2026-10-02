import React, { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, ShieldCheck, AlertTriangle, RefreshCw, Lock } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/crypto';

interface ChangeMasterPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalItemsCount: number;
  onChangePassword: (oldPass: string, newPass: string) => Promise<boolean>;
}

export const ChangeMasterPasswordModal: React.FC<ChangeMasterPasswordModalProps> = ({
  isOpen,
  onClose,
  totalItemsCount,
  onChangePassword
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const strength = calculatePasswordStrength(newPassword);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!oldPassword) {
      setErrorMsg('请输入当前正在使用的主密码');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('新主密码长度不得低于 6 位');
      return;
    }
    if (newPassword === oldPassword) {
      setErrorMsg('新主密码不能与当前旧密码相同');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('两次输入的新主密码不一致');
      return;
    }

    try {
      setIsProcessing(true);
      const ok = await onChangePassword(oldPassword, newPassword);
      if (ok) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        setErrorMsg('当前主密码验证错误，无法执行修改');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '修改主密码发生异常');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="relative bg-white border border-slate-300 rounded-xl w-full max-w-md shadow-2xl p-6 sm:p-7 overflow-hidden">
        {/* 四角战术刻度 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 头部 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#161922] text-brand-lime flex items-center justify-center shadow-sm">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">修改主密码与全库重加密</h3>
              <p className="text-[10px] font-mono text-slate-400">RE-KEY & RE-ENCRYPT VAULT</p>
            </div>
          </div>
          <button
            disabled={isProcessing}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 安全说明卡片 */}
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>零知识无损重加密标准</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
            修改主密码后，系统将生成新盐值和随机金库数据密钥，通过 PBKDF2 600,000 轮派生新 KEK 包裹它，并对库内全部 <strong>{totalItemsCount}</strong> 条凭据逐一重新加密。
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 原主密码 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              当前主密码
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                required
                disabled={isProcessing}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入当前正在使用的主密码"
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-800 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1"
              >
                {showOld ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 新主密码 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              设定新主密码 (≥6位)
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                disabled={isProcessing}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入全新的高强度主密码"
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-800 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1"
              >
                {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {newPassword && (
              <div className="mt-1.5 space-y-1">
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

          {/* 确认新主密码 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              确认新主密码
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              required
              disabled={isProcessing}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新主密码以核对"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-800 disabled:opacity-50"
            />
          </div>

          {/* 底部操作按钮 */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isProcessing || !oldPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 bg-[#161922] hover:bg-black text-brand-lime font-bold text-xs rounded transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-lime" />
                  <span>全库重加密中...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>确认修改并重加密</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
