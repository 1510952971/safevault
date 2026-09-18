import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Sparkles, ShieldCheck, Key, Globe, User, Lock, FileText } from 'lucide-react';
import { DecryptedVaultItem, CategoryType } from '../types/vault';
import { CATEGORIES } from '../utils/storage';
import { calculatePasswordStrength, generateSecurePassword } from '../utils/crypto';

interface PasswordModalProps {
  isOpen: boolean;
  editItem?: DecryptedVaultItem | null;
  onClose: () => void;
  onSave: (item: Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string) => Promise<void>;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  editItem,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryType>('website');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title);
      setCategory(editItem.category);
      setUsername(editItem.username);
      setPassword(editItem.password);
      setWebsite(editItem.website || '');
      setNotes(editItem.notes || '');
    } else {
      setTitle('');
      setCategory('website');
      setUsername('');
      setPassword('');
      setWebsite('');
      setNotes('');
    }
    setErrorMsg('');
    setShowPassword(false);
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(password);

  const handleQuickGenerate = () => {
    const generated = generateSecurePassword({
      length: 16,
      useUppercase: true,
      useLowercase: true,
      useNumbers: true,
      useSymbols: true,
      excludeAmbiguous: true
    });
    setPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('请输入平台或凭据标题');
      return;
    }
    if (!password) {
      setErrorMsg('密码不能为空');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await onSave(
        {
          title: title.trim(),
          category,
          username: username.trim(),
          password,
          website: website.trim(),
          notes: notes.trim()
        },
        editItem?.id
      );
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white border border-slate-300 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden my-8 p-6">
        {/* 四角刻度标 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 头部 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="border-l-4 border-brand-lime pl-2.5">
            <h3 className="text-base font-bold text-slate-900">
              {editItem ? '编辑凭据槽位' : '录入新凭据槽位'}
            </h3>
            <p className="text-[11px] font-mono text-slate-400">SLOT ENTRY // AES-GCM-256</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                平台 / 应用名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：微信、GitHub、NAS后台"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">所属分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.code} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>账号 / 用户名 / 邮箱</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com 或 手机号"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>密码凭据 <span className="text-rose-500">*</span></span>
              </label>
              <button
                type="button"
                onClick={handleQuickGenerate}
                className="text-[11px] font-mono text-slate-700 hover:text-slate-950 flex items-center gap-1 font-semibold"
              >
                <Sparkles className="w-3 h-3 text-brand-lime" />
                <span>[生成 16 位强密码]</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded font-mono text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-800" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {password && (
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

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>官方登录链接 (可选)</span>
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>私密备注 / 密保说明 (加密存储)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="仅对您可见的私密信息..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none resize-none"
            />
          </div>

          {/* 战术操作按钮 */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
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
                {isSubmitting ? '加密入库中...' : '确认保存凭据'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
