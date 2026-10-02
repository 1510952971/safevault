import React from 'react';
import { Check, Palette, X } from 'lucide-react';
import { APP_THEMES, ThemeId } from '../utils/theme';

interface ThemePickerModalProps {
  isOpen: boolean;
  currentTheme: ThemeId;
  onSelect: (theme: ThemeId) => void;
  onClose: () => void;
}

export const ThemePickerModal: React.FC<ThemePickerModalProps> = ({
  isOpen,
  currentTheme,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="theme-picker-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-brand-lime">
            <Palette className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="theme-picker-title" className="text-base font-bold text-slate-950">主题与外观</h2>
            <p className="text-[11px] text-slate-500">只改变显示样式，不会修改或重新加密密码库数据。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="关闭主题设置">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {APP_THEMES.map((theme) => {
            const selected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelect(theme.id)}
                className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${selected ? 'border-slate-900 bg-slate-50 shadow-md ring-2 ring-brand-lime/60' : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm'}`}
                aria-pressed={selected}
              >
                <span className={`h-12 w-16 shrink-0 rounded-lg bg-gradient-to-br ${theme.preview} shadow-inner`}>
                  <span className="m-2 block h-8 rounded-md border border-white/50 bg-white/20" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    {theme.name}
                    {selected && <Check className="h-4 w-4 text-emerald-600" />}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">{theme.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <footer className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-500 sm:px-5">
          主题会保存在当前设备；切换设备后不会影响同步账号、密文、备份或服务器数据。
        </footer>
      </div>
    </div>
  );
};
