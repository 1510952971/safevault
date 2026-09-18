import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Copy, Check, Sparkles, Shield, Terminal } from 'lucide-react';
import { PasswordGeneratorOptions } from '../types/vault';
import { generateSecurePassword, calculatePasswordStrength } from '../utils/crypto';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyPassword: (password: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onCopyPassword
}) => {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 16,
    useUppercase: true,
    useLowercase: true,
    useNumbers: true,
    useSymbols: true,
    excludeAmbiguous: true
  });

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const pwd = generateSecurePassword(options);
    setGeneratedPassword(pwd);
    setCopied(false);
  };

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen, options]);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(generatedPassword);

  const handleCopy = () => {
    onCopyPassword(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative bg-white border border-slate-300 rounded-lg w-full max-w-md shadow-2xl p-6 overflow-hidden">
        {/* 四角刻度 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 头部 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="border-l-4 border-brand-lime pl-2.5">
            <h3 className="text-base font-bold text-slate-900">强密码发生器</h3>
            <span className="text-[10px] font-mono text-slate-400">CSPRNG // ENTROPY HIGH</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* 生成密码显示盒 */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-base font-bold text-slate-900 tracking-wider break-all select-all">
                {generatedPassword}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded transition-colors"
                  title="刷新生成"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`p-1.5 rounded transition-colors ${
                    copied ? 'text-slate-900 bg-brand-lime' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                  }`}
                  title="复制密码"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 强度进度条 */}
            <div className="space-y-1 pt-1 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>强度评估：{strength.label}</span>
                <span>{strength.score}%</span>
              </div>
              <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strength.colorClass} transition-all duration-300`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
            </div>
          </div>

          {/* 长度调节 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono font-semibold">
              <span className="text-slate-700">密码长度</span>
              <span className="text-slate-900">{options.length} 位</span>
            </div>
            <input
              type="range"
              min={8}
              max={32}
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value, 10) })}
              className="w-full accent-slate-900 bg-slate-200 rounded h-1.5 cursor-pointer"
            />
          </div>

          {/* 规则复选 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {[
              { key: 'useUppercase', label: '包含大写字母 (A-Z)' },
              { key: 'useLowercase', label: '包含小写字母 (a-z)' },
              { key: 'useNumbers', label: '包含阿拉伯数字 (0-9)' },
              { key: 'useSymbols', label: '包含特殊符号 (!@#$%^&*)' },
              { key: 'excludeAmbiguous', label: '排除易混淆字符 (0/O, 1/l/I)' },
            ].map((rule) => (
              <label key={rule.key} className="flex items-center justify-between cursor-pointer py-1 text-slate-700 hover:text-slate-950">
                <span>{rule.label}</span>
                <input
                  type="checkbox"
                  checked={options[rule.key as keyof PasswordGeneratorOptions] as boolean}
                  onChange={(e) => setOptions({ ...options, [rule.key]: e.target.checked })}
                  className="rounded accent-slate-900 w-4 h-4 cursor-pointer"
                />
              </label>
            ))}
          </div>

          {/* 战术按钮 */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
            >
              关闭
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all group"
            >
              <div className="w-7 h-8 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                <span className="text-xs font-mono">&gt;</span>
              </div>
              <span className="px-4 text-xs font-bold">复制此密码</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
