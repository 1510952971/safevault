import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  ShieldAlert,
  KeyRound,
  Sparkles,
  X,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Globe,
  Briefcase,
  CreditCard,
  MessageCircle,
  Gamepad2,
  Key
} from 'lucide-react';
import { DecryptedVaultItem, CategoryType } from '../types/vault';
import { PasswordCard } from './PasswordCard';
import { CATEGORIES } from '../utils/storage';

interface VaultListProps {
  items: DecryptedVaultItem[];
  isLoading: boolean;
  onAddNew: () => void;
  onEditItem: (item: DecryptedVaultItem) => void;
  onDeleteItem: (id: string, title: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
}

const CATEGORY_ICON_MAP: Record<CategoryType, React.ReactNode> = {
  website: <Globe className="w-4 h-4" />,
  work: <Briefcase className="w-4 h-4" />,
  finance: <CreditCard className="w-4 h-4" />,
  social: <MessageCircle className="w-4 h-4" />,
  game: <Gamepad2 className="w-4 h-4" />,
  other: <Key className="w-4 h-4" />
};

export const VaultList: React.FC<VaultListProps> = ({
  items,
  isLoading,
  onAddNew,
  onEditItem,
  onDeleteItem,
  onCopyUsername,
  onCopyPassword,
  onOpenGenerator,
  onOpenBackup
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 分类计数
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    CATEGORIES.forEach(c => {
      counts[c.key] = items.filter(i => i.category === c.key).length;
    });
    return counts;
  }, [items]);

  // 过滤
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.website && item.website.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [items, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* 1. 左侧机能战术竖向菜单栏 (完全对齐设计图：01 设施 / 02 防卫 ...) */}
      <aside className="w-full lg:w-48 shrink-0 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-tactical-sm">
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-slate-700 tracking-wider">CATEGORIES</span>
          <span className="text-[10px] font-mono text-slate-400">#INDEX</span>
        </div>

        <nav className="divide-y divide-slate-100 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible">
          {/* 全部条目 */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full text-left px-3.5 py-3 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-1 h-3.5 rounded-full ${selectedCategory === 'all' ? 'bg-brand-lime' : 'bg-transparent'}`} />
              <Layers className="w-4 h-4 shrink-0" />
              <span className="text-xs">全部凭据</span>
            </div>
            <span className={`font-mono text-[11px] ml-2 ${selectedCategory === 'all' ? 'text-brand-lime' : 'text-slate-400'}`}>
              00
            </span>
          </button>

          {/* 各子分类 */}
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`w-full text-left px-3.5 py-3 transition-all flex items-center justify-between group whitespace-nowrap lg:whitespace-normal shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-1 h-3.5 rounded-full ${isSelected ? 'bg-brand-lime' : 'bg-transparent'}`} />
                  {CATEGORY_ICON_MAP[cat.key]}
                  <span className="text-xs">{cat.label}</span>
                </div>
                <span className={`font-mono text-[11px] ml-2 ${isSelected ? 'text-brand-lime' : 'text-slate-400'}`}>
                  {cat.code}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 2. 中部核心主监控看板与槽位区域 */}
      <section className="flex-1 min-w-0 w-full space-y-6">
        {/* 顶部战术看板面板 (对齐设计图：等级 1/4、指标列、圆形雷达线) */}
        <div className="relative bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm overflow-hidden">
          {/* 背景战术雷达弧线装饰 */}
          <div className="absolute -top-10 right-4 w-44 h-44 rounded-full border border-slate-200 pointer-events-none hidden md:block">
            <div className="absolute inset-2 rounded-full border border-dashed border-slate-300" />
            <div className="absolute inset-6 rounded-full border-2 border-brand-lime/80 border-t-transparent border-l-transparent transform rotate-45" />
            <div className="absolute top-12 right-10 text-[10px] font-mono text-slate-400">
              HUD // #0027
            </div>
          </div>

          {/* 小节标题 (带醒目荧光绿竖标) */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">核心凭据总览</h2>
              <span className="text-xs font-mono text-slate-400">// DASHBOARD</span>
            </div>

            {/* 搜索框 */}
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="快速检索凭据..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-800 rounded text-xs text-slate-800 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 大字号比率 */}
          <div className="mb-4">
            <span className="text-xs font-mono text-slate-400 block mb-1">CAPACITY // 已激活槽位</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 tracking-tight">
                {items.length}
              </span>
              <span className="text-xl sm:text-2xl font-mono text-slate-400">
                / {Math.max(items.length, 10)}
              </span>
            </div>
            {/* 进度条 */}
            <div className="w-full sm:w-72 h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-slate-900 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(10, (items.length / 10) * 100))}%` }}
              />
            </div>
          </div>

          {/* 战术指标细分列 (带绿色刻度) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">当前槽位</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-3 bg-brand-lime inline-block" />
                <span className="text-sm font-bold font-mono text-slate-800">{items.length} 个</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">核心加密</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-3 bg-brand-lime inline-block" />
                <span className="text-sm font-bold text-slate-800">AES-GCM-256</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">持久化环境</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-3 bg-brand-lime inline-block" />
                <span className="text-sm font-bold text-slate-800">纯本地 / NAS</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-slate-400 block mb-1">防卫安全值</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-3 bg-brand-lime inline-block" />
                <span className="text-sm font-bold font-mono text-slate-800">100 满防</span>
              </div>
            </div>
          </div>

          {/* 底部经典座右铭 (对齐设计图：以科学与秩序，连接更远的未来。) */}
          <p className="mt-4 text-[11px] text-slate-400 font-mono tracking-wide">
            “ 以算法与秩序，守护更私密的数字资产。 ”
          </p>
        </div>

        {/* 槽位列表区域 (对齐设计图：扩建设施 (1/2) 与 空槽位 [+] 按钮) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                存储槽位清单 ({filteredItems.length}/{items.length})
              </h3>
            </div>
            <button
              onClick={onAddNew}
              className="text-xs font-medium text-slate-700 hover:text-slate-950 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>快速录入</span>
            </button>
          </div>

          {/* 骨架屏加载中 */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-16 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* 槽位卡片网格 + 空槽位卡片 */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 已录入凭据卡片 */}
              {filteredItems.map((item, idx) => {
                const numStr = (idx + 1).toString().padStart(2, '0');
                return (
                  <PasswordCard
                    key={item.id}
                    item={item}
                    indexNumber={numStr}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    onCopyUsername={onCopyUsername}
                    onCopyPassword={onCopyPassword}
                  />
                );
              })}

              {/* 空槽位 [+] 卡片 (完全还原设计图的 02 空槽位 [+] 选择设施进行建造) */}
              <div
                onClick={onAddNew}
                className="relative bg-white/70 hover:bg-white border-2 border-dashed border-slate-300 hover:border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center min-h-[160px] cursor-pointer transition-all duration-200 group shadow-tactical-sm hover:shadow-tactical-md"
              >
                {/* 右上角槽位编号 */}
                <span className="absolute top-3 left-3 font-mono text-xs font-bold text-slate-400 group-hover:text-slate-700">
                  {(filteredItems.length + 1).toString().padStart(2, '0')}
                </span>

                <div className="w-12 h-12 rounded-full border border-slate-300 group-hover:border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:scale-105 transition-all mb-2">
                  <Plus className="w-6 h-6" />
                </div>

                <h4 className="font-bold text-sm text-slate-800 group-hover:text-slate-950">
                  空槽位
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  点击录入新的密码凭据
                </p>

                {/* 战术右下角折角标记 */}
                <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-[10px]">
                  ┘
                </div>
              </div>
            </div>
          )}

          {/* 搜索无匹配 */}
          {!isLoading && items.length > 0 && filteredItems.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 mb-1">未检索到匹配凭据</p>
              <p className="text-xs text-slate-400 mb-3">没有与 “{searchQuery}” 匹配的条目</p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs"
              >
                清除搜索
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3. 右侧快捷面板 (完全对齐设计图右侧：升级到等级 2 / 战术行动面板) */}
      <aside className="w-full lg:w-72 shrink-0 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm">
          {/* 面板标题 */}
          <div className="border-l-4 border-brand-lime pl-2.5 mb-4">
            <h3 className="text-sm font-bold text-slate-900">终端防卫状态</h3>
            <span className="text-[10px] font-mono text-slate-400">DEFENSE LEVEL 2</span>
          </div>

          {/* 条件列表 (对齐设计图：建立后天数 0/10，钢铁 0/200，原木 1/100) */}
          <div className="space-y-3 divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>自动超时锁屏</span>
              </div>
              <span className="font-mono font-bold text-slate-800">3 分钟</span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <div className="flex items-center gap-2 text-slate-600">
                <Cpu className="w-4 h-4 text-slate-400" />
                <span>PBKDF2 哈希</span>
              </div>
              <span className="font-mono font-bold text-slate-800">100k 轮</span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <div className="flex items-center gap-2 text-slate-600">
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span>离线密文备份</span>
              </div>
              <span className="font-mono font-bold text-slate-800">就绪</span>
            </div>
          </div>

          {/* 战术推进按钮 (完全对齐设计图左侧带荧光绿色斜切块的“开始升级”按钮) */}
          <div className="mt-5 space-y-2">
            <button
              onClick={onOpenGenerator}
              className="w-full relative flex items-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded overflow-hidden transition-all group p-0"
            >
              {/* 左侧荧光绿色斜切块 */}
              <div className="w-8 h-10 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                <span className="text-sm font-mono">&gt;</span>
              </div>
              <div className="flex-1 px-3 text-left">
                <span className="text-xs font-bold text-slate-900 group-hover:text-slate-950 block">
                  打开强密码生成器
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">CSPRNG RANDOM</span>
              </div>
            </button>

            <button
              onClick={onOpenBackup}
              className="w-full relative flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden transition-all group p-0"
            >
              <div className="w-8 h-10 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                <span className="text-sm font-mono">&gt;</span>
              </div>
              <div className="flex-1 px-3 text-left">
                <span className="text-xs font-bold text-white block">
                  导出离线加密备份
                </span>
                <span className="text-[10px] text-slate-300 font-mono block">.SAFEVAULT.JSON</span>
              </div>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
