import React from 'react';
import { Search, X } from 'lucide-react';

interface VaultOverviewProps {
  totalItems: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const VaultOverview: React.FC<VaultOverviewProps> = ({
  totalItems,
  searchQuery,
  onSearchChange
}) => {
  const maxCapacity = Math.max(totalItems, 10);
  const percentage = Math.min(100, Math.max(10, (totalItems / maxCapacity) * 100));

  return (
    <div className="relative bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm overflow-hidden">
      {/* 背景战术雷达弧线与工程编号装饰 (对齐参考图右上角雷达环) */}
      <div className="absolute -top-10 right-4 w-48 h-48 rounded-full border border-slate-200 pointer-events-none hidden md:block">
        <div className="absolute inset-2 rounded-full border border-dashed border-slate-300" />
        <div className="absolute inset-6 rounded-full border-2 border-brand-lime border-t-transparent border-l-transparent transform rotate-45" />
        <div className="absolute top-12 right-12 text-[10px] font-mono text-slate-400">
          据点 #0027
        </div>
      </div>

      {/* 小节标题 (带醒目荧光绿竖标) 与搜索栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">设施总览</h2>
          <span className="text-xs font-mono text-slate-400">// VAULT OVERVIEW</span>
        </div>

        {/* 快速搜索框 */}
        <div className="relative w-48 sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="快速检索凭据..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-800 rounded text-xs text-slate-800 focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 大字号等级比率与战术滑块 (对齐参考图：等级 1 / 4) */}
      <div className="mb-4">
        <span className="text-xs font-mono text-slate-400 block mb-1">等级</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 tracking-tight">
            {totalItems}
          </span>
          <span className="text-xl sm:text-2xl font-mono text-slate-400">
            / {maxCapacity}
          </span>
        </div>
        {/* 战术横向进度刻度条 */}
        <div className="relative w-full sm:w-80 h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
          <div
            className="h-full bg-[#161922] transition-all duration-500 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* 战术四列参数格 (对齐参考图：| 当前槽位 2  | 核心设施 城镇中心  | 建立后天数 0天  | 防卫值 107) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>当前槽位</span>
          </div>
          <span className="text-sm font-bold font-mono text-slate-900 block pl-2">
            {totalItems}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>核心设施</span>
          </div>
          <span className="text-sm font-bold text-slate-900 block pl-2 truncate">
            {totalItems > 0 ? '密库中心' : '待初始化'}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>加密引擎</span>
          </div>
          <span className="text-sm font-bold font-mono text-slate-900 block pl-2">
            AES-GCM-256
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>防卫值</span>
          </div>
          <span className="text-sm font-bold font-mono text-slate-900 block pl-2">
            100 满防
          </span>
        </div>
      </div>

      {/* 底部座右铭 (对齐参考图：“ 以科学与秩序，连接更远的未来。 ”) */}
      <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-serif italic tracking-wider">
        “ 以算法与秩序，筑牢私密资产的安全中枢。 ”
      </p>
    </div>
  );
};
