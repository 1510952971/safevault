import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Sparkles, Star, Globe, User, Lock, FileText, KeyRound, Shield, Plus, Trash2, History } from 'lucide-react';
import { DecryptedVaultItem, CategoryType, CustomField, PasswordHistoryEntry } from '../types/vault';
import { CATEGORIES } from '../utils/storage';
import { calculatePasswordStrength, generateSecurePassword } from '../utils/crypto';
import { isValidTotpSecret } from '../utils/totp';

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
  const [totpSecret, setTotpSecret] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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
      setTotpSecret(editItem.totpSecret || '');
      setNotes(editItem.notes || '');
      setIsFavorite(!!editItem.isFavorite);
      setCustomFields(editItem.customFields || []);
    } else {
      setTitle('');
      setCategory('website');
      setUsername('');
      setPassword('');
      setWebsite('');
      setTotpSecret('');
      setNotes('');
      setIsFavorite(false);
      setCustomFields([]);
    }
    setErrorMsg('');
    setShowPassword(false);
    setShowHistory(false);
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(password);

  const handleGeneratePreset = (type: 'complex' | 'ultra' | 'pin') => {
    let generated = '';
    if (type === 'complex') {
      generated = generateSecurePassword({
        length: 16,
        useUppercase: true,
        useLowercase: true,
        useNumbers: true,
        useSymbols: true,
        excludeAmbiguous: true
      });
    } else if (type === 'ultra') {
      generated = generateSecurePassword({
        length: 24,
        useUppercase: true,
        useLowercase: true,
        useNumbers: true,
        useSymbols: true,
        excludeAmbiguous: false
      });
    } else if (type === 'pin') {
      generated = generateSecurePassword({
        length: 8,
        useUppercase: false,
        useLowercase: false,
        useNumbers: true,
        useSymbols: false,
        excludeAmbiguous: false
      });
    }
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
    if (totpSecret.trim() && !isValidTotpSecret(totpSecret)) {
      setErrorMsg('TOTP 2FA 密钥格式无效 (须为 Base32 编码字母数字组合)');
      return;
    }

    // 密码历史记录轮换：若为编辑现有项且修改了密码，将原密码归档至历史记录
    let updatedHistory = editItem?.passwordHistory || [];
    if (editItem && editItem.password && editItem.password !== password) {
      const newHistoryEntry: PasswordHistoryEntry = {
        password: editItem.password,
        changedAt: new Date().toISOString()
      };
      updatedHistory = [newHistoryEntry, ...updatedHistory].slice(0, 10);
    }

    // 过滤掉空白自定义字段
    const validCustomFields = customFields
      .map((f) => ({ ...f, label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label || f.value);

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
          totpSecret: totpSecret.trim().toUpperCase(),
          notes: notes.trim(),
          isFavorite,
          customFields: validCustomFields,
          passwordHistory: updatedHistory,
          isDeleted: editItem?.isDeleted,
          deletedAt: editItem?.deletedAt
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

  const handleAddCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        id: `cf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        label: '',
        value: '',
        isProtected: false
      }
    ]);
  };

  const handleUpdateCustomField = (id: string, key: keyof CustomField, val: any) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
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
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="border-l-4 border-brand-lime pl-2.5">
            <h3 className="text-base font-bold text-slate-900">
              {editItem ? '编辑密码凭据档案' : '录入新密码凭据'}
            </h3>
            <p className="text-[11px] font-mono text-slate-400">CREDENTIAL ENTRY // AES-GCM-256</p>
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
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* 标题与所属分类 */}
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
                placeholder="例如：群晖NAS、GitHub、主邮箱"
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

          {/* 账号 */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>账号 / 用户名 / 邮箱</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin / user@example.com / 手机号"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none"
            />
          </div>

          {/* 密码 与 发生器快捷键 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>密码凭据 <span className="text-rose-500">*</span></span>
              </label>
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => handleGeneratePreset('complex')}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  16位复杂
                </button>
                <button
                  type="button"
                  onClick={() => handleGeneratePreset('ultra')}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  24位超强
                </button>
                <button
                  type="button"
                  onClick={() => handleGeneratePreset('pin')}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  8位PIN
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入或快捷生成密码"
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
                  <span>安全评级：{strength.label}</span>
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

          {/* 网址 与 TOTP 2FA 密钥 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>登录官网 / 访问地址</span>
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
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>TOTP 2FA 动态密钥 (可选)</span>
              </label>
              <input
                type="text"
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
                placeholder="例如：JBSWY3DPEHPK3PXP"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 font-mono focus:outline-none uppercase"
              />
            </div>
          </div>

          {/* 私密备注 */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>私密备注 / 备忘说明 (AES-256端到端加密)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：备用应急代码、额外备忘等..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-slate-900 focus:outline-none resize-none"
            />
          </div>

          {/* 自定义扩展安全字段 */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>自定义扩展字段 (PIN/安全问题/Token)</span>
              </label>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="text-[11px] font-semibold text-slate-800 hover:text-black flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>添加字段</span>
              </button>
            </div>

            {customFields.length > 0 && (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {customFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleUpdateCustomField(field.id, 'label', e.target.value)}
                      placeholder="字段名 (如: PIN码)"
                      className="w-1/3 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none"
                    />
                    <input
                      type={field.isProtected ? 'password' : 'text'}
                      value={field.value}
                      onChange={(e) => handleUpdateCustomField(field.id, 'value', e.target.value)}
                      placeholder="字段内容"
                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800 font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateCustomField(field.id, 'isProtected', !field.isProtected)}
                      title={field.isProtected ? '当前为敏感防窥掩码保护' : '点击开启敏感防窥掩码'}
                      className={`p-1 rounded text-xs ${field.isProtected ? 'text-slate-900 bg-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(field.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="删除字段"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 密码历史版本记录 (编辑现有项时展示) */}
          {editItem?.passwordHistory && editItem.passwordHistory.length > 0 && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-slate-700 hover:text-slate-950 text-xs font-semibold"
              >
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>历史密码记录 ({editItem.passwordHistory.length} 次轮换留档)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {showHistory ? '收起 ▲' : '展开查看 ▼'}
                </span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2 max-h-28 overflow-y-auto">
                  {editItem.passwordHistory.map((h, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] font-mono bg-white p-1.5 rounded border border-slate-100">
                      <span className="text-slate-500">
                        {new Date(h.changedAt).toLocaleDateString()} {new Date(h.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-slate-400 text-[10px]">已加密安全归档</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 置顶勾选开关 */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded">
            <input
              type="checkbox"
              id="isFavoriteCheck"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 focus:ring-brand-lime accent-slate-900 cursor-pointer"
            />
            <label htmlFor="isFavoriteCheck" className="text-slate-700 font-semibold cursor-pointer flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>设为核心置顶凭据 (在顶部重点关注展示)</span>
            </label>
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
