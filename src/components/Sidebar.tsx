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
  Key
} from 'lucide-react';
import { CategoryType } from '../types/vault';
import { CATEGORIES } from '../utils/storage';

interface SidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  favoritesCount?: number;
  riskyCount?: number;
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
  riskyCount = 0
}) => {
  return (
    <aside className="w-full lg:w-52 shrink-0 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-tactical-sm">
      {/* 顶部标题区 */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-slate-700 tracking-wider">INDEX // 分类索引</span>
        <span className="text-[10px] font-mono text-slate-400">#0027</span>
      </div>

      {/* 竖向战术菜单项 */}
      <nav className="divide-y divide-slate-100 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible">
        {/* 全部凭据 00 */}
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
            className={`font-mono text-[11px] ml-2 ${
              selectedCategory === 'all' ? 'text-brand-lime font-bold' : 'text-slate-400'
            }`}
          >
            00
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
            className={`font-mono text-[11px] ml-2 px-1.5 py-0.2 rounded ${
              selectedCategory === 'favorites'
                ? 'text-brand-lime font-bold'
                : 'text-amber-600 bg-amber-50 font-bold'
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
            className={`font-mono text-[11px] ml-2 px-1.5 py-0.2 rounded font-bold ${
              selectedCategory === 'risky'
                ? 'text-brand-lime'
                : riskyCount > 0
                ? 'text-rose-600 bg-rose-50'
                : 'text-slate-400'
            }`}
          >
            {riskyCount}
          </span>
        </button>

        {/* 各细分战术分类 01 ~ 06 */}
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.key;
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
                className={`font-mono text-[11px] ml-2 ${
                  isSelected ? 'text-brand-lime font-bold' : 'text-slate-400'
                }`}
              >
                {cat.code}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
