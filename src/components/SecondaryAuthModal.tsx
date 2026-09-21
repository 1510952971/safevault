import React, { useState } from 'react';
import { X, Lock, KeyRound, Eye, EyeOff, ShieldCheck, ShieldAlert, Check } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/crypto';

export type SecondaryAuthModalMode = 'verify' | 'setup';

interface SecondaryAuthModalProps {
  isOpen: boolean;
  mode: SecondaryAuthModalMode;
  hasSecondaryPassword: boolean;
  onClose: () => void;
  onVerify: (password: string, rememberFiveMinutes: boolean) => Promise<boolean>;
  onSetupSuccess: (newPassword: string) => Promise<void>;
  onDisableSuccess: (currentPassword: string) => Promise<boolean>;
  onChangePasswordSuccess: (oldPass: string, newPass: string) => Promise<boolean>;
}

export const SecondaryAuthModal: React.FC<SecondaryAuthModalProps> = ({
  isOpen,
  mode,
  hasSecondaryPassword,
  onClose,
  onVerify,
  onSetupSuccess,
  onDisableSuccess,
  onChangePasswordSuccess
}) => {
  // 验证模式状态
  const [verifyPassword, setVerifyPassword] = useState('');
  const [rememberFiveMinutes, setRememberFiveMinutes] = useState(true);

  // 设置/修改模式状态
  const [setupTab, setSetupTab] = useState<'enable' | 'change' | 'disable'>(
    hasSecondaryPassword ? 'change' : 'enable'
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(newPassword);

  // 处理输入校验
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPassword) {
      setErrorMsg('请输入二级安全密码');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const ok = await onVerify(verifyPassword, rememberFiveMinutes);
      if (ok) {
        setVerifyPassword('');
        onClose();
      } else {
        setErrorMsg('二级安全密码验证错误，请重新输入');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '验证失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (setupTab === 'enable') {
      if (newPassword.length < 4) {
        setErrorMsg('二级密码长度建议不低于 4 位');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('两次输入的二级密码不一致');
        return;
      }

      try {
        setIsSubmitting(true);
        await onSetupSuccess(newPassword);
        onClose();
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '设置二级密码失败');
      } finally {
        setIsSubmitting(false);
      }
    } else if (setupTab === 'change') {
      if (!currentPassword) {
        setErrorMsg('请输入当前二级密码');
        return;
      }
      if (newPassword.length < 4) {
        setErrorMsg('新二级密码长度建议不低于 4 位');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('两次输入的新密码不一致');
        return;
      }

      try {
        setIsSubmitting(true);
        const ok = await onChangePasswordSuccess(currentPassword, newPassword);
        if (ok) {
          onClose();
        } else {
          setErrorMsg('当前二级密码验证错误');
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '修改二级密码异常');
      } finally {
        setIsSubmitting(false);
      }
    } else if (setupTab === 'disable') {
      if (!currentPassword) {
        setErrorMsg('请输入当前二级密码以确认关闭');
        return;
      }

      try {
        setIsSubmitting(true);
        const ok = await onDisableSuccess(currentPassword);
        if (ok) {
          onClose();
        } else {
          setErrorMsg('二级密码验证错误，无法停用');
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : '停用失败');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="relative bg-white border border-slate-300 rounded-lg w-full max-w-md shadow-2xl p-6 overflow-hidden">
        {/* 四角刻度标 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 头部 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="border-l-4 border-brand-lime pl-2.5">
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'verify' ? '二级安全密码核验' : '二级安全密码管理'}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {mode === 'verify' ? 'TIER-2 AUTH // REVEAL PROTECTION' : 'TIER-2 CONFIG // SECURITY PIN'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 错误提示 */}
        {errorMsg && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 模式一：查看/复制核验 */}
        {mode === 'verify' && (
          <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start gap-2.5">
              <KeyRound className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <p className="text-slate-600 leading-relaxed">
                当前操作涉及明文敏感凭据展示。请输入您的<strong>二级独立安全密码</strong>以完成身份二次核验。
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                二级安全密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={verifyPassword}
                  onChange={(e) => setVerifyPassword(e.target.value)}
                  placeholder="输入二级安全密码"
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* 5 分钟免密记忆 */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="rememberFiveMinutes"
                checked={rememberFiveMinutes}
                onChange={(e) => setRememberFiveMinutes(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 focus:ring-brand-lime accent-slate-900 cursor-pointer"
              />
              <label htmlFor="rememberFiveMinutes" className="text-slate-700 cursor-pointer font-medium">
                在接下来的 <strong>5 分钟</strong> 内免再次输入二级密码
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50"
              >
                <div className="w-7 h-8 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                  <span className="text-xs font-mono">&gt;</span>
                </div>
                <span className="px-4 text-xs font-bold">
                  {isSubmitting ? '核验中...' : '确认授权查看'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* 模式二：配置/开启/修改/停用 */}
        {mode === 'setup' && (
          <form onSubmit={handleSetupSubmit} className="space-y-4 text-xs">
            {/* 选项卡 (若已开启，提供修改与停用选项) */}
            {hasSecondaryPassword ? (
              <div className="flex border border-slate-200 rounded p-1 bg-slate-50 text-xs font-bold mb-3">
                <button
                  type="button"
                  onClick={() => { setSetupTab('change'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 rounded transition-colors ${
                    setupTab === 'change'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  修改二级密码
                </button>
                <button
                  type="button"
                  onClick={() => { setSetupTab('disable'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 rounded transition-colors ${
                    setupTab === 'disable'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  停用二级密码
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 leading-relaxed">
                开启二级密码后，在密码数据库内<strong>点击显示明文密码</strong>或<strong>复制密码</strong>时，必须通过二级密码验证，有效防止离开电脑时被熟人窥屏。
              </div>
            )}

            {/* 停用模式 */}
            {setupTab === 'disable' && (
              <div className="space-y-3">
                <p className="text-slate-600">
                  请输入当前的二级密码以停用此防护功能：
                </p>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">当前二级密码</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="输入当前二级密码"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? '处理中...' : '确认停用二级密码'}
                  </button>
                </div>
              </div>
            )}

            {/* 开启或修改模式 */}
            {(setupTab === 'enable' || setupTab === 'change') && (
              <div className="space-y-3">
                {setupTab === 'change' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      当前二级密码 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="验证当前二级密码"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-slate-900 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {setupTab === 'change' ? '新二级安全密码' : '设置二级安全密码'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="建议 4~16 位独立 PIN 码或口令"
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {newPassword && (
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>强度：{strength.label}</span>
                      <span>{strength.score}%</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    确认二级密码 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入二级安全密码"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group disabled:opacity-50"
                  >
                    <div className="w-7 h-8 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                      <span className="text-xs font-mono">&gt;</span>
                    </div>
                    <span className="px-4 text-xs font-bold">
                      {isSubmitting ? '提交中...' : setupTab === 'change' ? '确认修改' : '确认开启二级密码'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
