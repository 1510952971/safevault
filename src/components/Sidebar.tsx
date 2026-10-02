import React from 'react';
import {
  Layers,
  Star,
  AlertTriangle,
  Globe,
  Briefcase,
  CreditCard,
  MessageCircle,
  Gamepad2,
  Key,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { CategoryType } from '../types/vault';
import { CATEGORIES } from '../utils/storage';

interface SidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  favoritesCount?: number;
  riskyCount?: number;
  trashCount?: number;
  totalCount?: number;
  categoryCounts?: Record<string, number>;
}

const CATEGORY_ICON_MAP: Record<CategoryType, React.ReactNode> = {
  website: <Globe className="w-4 h-4 shrink-0" />,
  work: <Briefcase className="w-4 h-4 shrink-0" />,
  finance: <CreditCard className="w-4 h-4 shrink-0" />,
  social: <MessageCircle className="w-4 h-4 shrink-0" />,
  game: <Gamepad2 className="w-4 h-4 shrink-0" />,
  other: <Key className="w-4 h-4 shrink-0" />
};

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  favoritesCount = 0,
  riskyCount = 0,
  trashCount = 0,
  totalCount = 0,
  categoryCounts = {}
}) => {
  return (
    <aside className="safevault-sidebar w-full lg:w-52 xl:w-60 h-full min-h-0 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between overflow-hidden select-none z-10 shadow-sm lg:shadow-none">
      {/* 顶部标题区 (桌面端专属标题) */}
      <div className="hidden lg:flex px-4 py-3 bg-slate-50/80 border-b border-slate-200 items-center justify-between shrink-0">
        <div className="flex items-start gap-2 min-w-0">
          <span className="w-1.5 h-3.5 bg-brand-lime rounded-full inline-block" />
          <div className="min-w-0 leading-tight">
            <span className="text-xs font-bold text-slate-700 block whitespace-nowrap">分类索引</span>
            <span className="text-[10px] font-mono text-slate-400 block whitespace-nowrap mt-0.5">INDEX // CATEGORY INDEX</span>
          </div>
        </div>
      </div>

      {/* 竖向战术菜单项 */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <nav className="divide-y divide-slate-100 flex flex-col overflow-y-auto overflow-x-hidden">
          {/* 全部凭据 */}
          <button
            onClick={() => onSelectCategory('all')}
            className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#161922] text-white font-semibold'
                : 'bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1 h-3.5 rounded-full ${
                  selectedCategory === 'all' ? 'bg-brand-lime' : 'bg-transparent'
                }`}
              />
              <Layers className="w-4 h-4 shrink-0" />
              <span className="text-xs">全部凭据</span>
            </div>
            <span
              className={`font-mono text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold transition-colors ${
                selectedCategory === 'all'
                  ? 'text-brand-lime bg-white/10'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              {totalCount}
            </span>
          </button>

          {/* 核心置顶凭据 */}
          <button
            onClick={() => onSelectCategory('favorites')}
            className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
              selectedCategory === 'favorites'
                ? 'bg-[#161922] text-white font-semibold'
                : 'bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1 h-3.5 rounded-full ${
                  selectedCategory === 'favorites' ? 'bg-brand-lime' : 'bg-transparent'
                }`}
              />
              <Star className="w-4 h-4 shrink-0 text-amber-500 fill-amber-500" />
              <span className="text-xs font-medium">核心置顶</span>
            </div>
            <span
              className={`font-mono text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold transition-colors ${
                selectedCategory === 'favorites'
                  ? 'text-brand-lime bg-white/10'
                  : favoritesCount > 0
                  ? 'text-amber-600 bg-amber-50'
                  : 'text-slate-400 bg-slate-100'
              }`}
            >
              {favoritesCount}
            </span>
          </button>

          {/* 风险审计预警 */}
          <button
            onClick={() => onSelectCategory('risky')}
            className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
              selectedCategory === 'risky'
                ? 'bg-[#161922] text-white font-semibold'
                : 'bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1 h-3.5 rounded-full ${
                  selectedCategory === 'risky' ? 'bg-brand-lime' : 'bg-transparent'
                }`}
              />
              <AlertTriangle className={`w-4 h-4 shrink-0 ${riskyCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
              <span className="text-xs font-medium">风险审计</span>
            </div>
            <span
              className={`font-mono text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold transition-colors ${
                selectedCategory === 'risky'
                  ? 'text-brand-lime bg-white/10'
                  : riskyCount > 0
                  ? 'text-rose-600 bg-rose-50'
                  : 'text-slate-400 bg-slate-100'
              }`}
            >
              {riskyCount}
            </span>
          </button>

          {/* 各细分分类 */}
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            const count = categoryCounts[cat.key] || 0;
            return (
              <button
                key={cat.key}
                onClick={() => onSelectCategory(cat.key)}
                className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
                  isSelected
                    ? 'bg-[#161922] text-white font-semibold'
                    : 'bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-1 h-3.5 rounded-full ${
                      isSelected ? 'bg-brand-lime' : 'bg-transparent'
                    }`}
                  />
                  {CATEGORY_ICON_MAP[cat.key]}
                  <span className="text-xs">{cat.label}</span>
                </div>
                <span
                  className={`font-mono text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold transition-colors ${
                    isSelected
                      ? 'text-brand-lime bg-white/10'
                      : count > 0
                      ? 'text-slate-600 bg-slate-100'
                      : 'text-slate-400 bg-slate-50'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* 分隔区 */}
          <div className="pt-2 pb-1 px-3">
            <div className="h-px bg-slate-200" />
          </div>

          {/* 废纸篓 */}
          <button
            onClick={() => onSelectCategory('trash')}
            className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
              selectedCategory === 'trash'
                ? 'bg-[#161922] text-white font-semibold'
                : 'bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-1 h-3.5 rounded-full ${
                  selectedCategory === 'trash' ? 'bg-rose-500' : 'bg-transparent'
                }`}
              />
              <Trash2 className={`w-4 h-4 shrink-0 ${selectedCategory === 'trash' ? 'text-rose-400' : 'text-slate-400'}`} />
              <span className="text-xs">废纸篓</span>
            </div>
            <span
              className={`font-mono text-[11px] ml-2 px-1.5 py-0.5 rounded font-bold transition-colors ${
                selectedCategory === 'trash'
                  ? 'text-rose-400 bg-white/10'
                  : trashCount > 0
                  ? 'text-rose-600 bg-rose-50'
                  : 'text-slate-400 bg-slate-100'
              }`}
            >
              {trashCount}
            </span>
          </button>
        </nav>
      </div>

      {/* 底部常驻停靠状态区 (桌面端沉浸底栏) */}
      <div className="hidden lg:block p-3.5 border-t border-slate-200 bg-slate-50/70 shrink-0 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-mono">ZERO-KNOWLEDGE</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
            AES-256
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>LOCAL VAULT</span>
          <span className="text-slate-600 font-semibold">{totalCount} 项凭据就绪</span>
        </div>
      </div>
    </aside>
  );
};
