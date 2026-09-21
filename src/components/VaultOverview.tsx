import React from 'react';
import { Search, X, ShieldAlert, ShieldCheck } from 'lucide-react';

interface VaultOverviewProps {
  totalItems: number;
  favoriteCount: number;
  weakCount: number;
  reusedCount: number;
  healthScore: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const VaultOverview: React.FC<VaultOverviewProps> = ({
  totalItems,
  favoriteCount,
  weakCount,
  reusedCount,
  healthScore,
  searchQuery,
  onSearchChange
}) => {
  const maxCapacity = Math.max(totalItems, 20);
  const percentage = Math.min(100, Math.max(5, (totalItems / maxCapacity) * 100));

  return (
    <div className="relative bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm overflow-hidden">
      {/* 背景战术雷达弧线与工程编号装饰 */}
      <div className="absolute -top-10 right-4 w-48 h-48 rounded-full border border-slate-200 pointer-events-none hidden md:block">
        <div className="absolute inset-2 rounded-full border border-dashed border-slate-300" />
        <div className="absolute inset-6 rounded-full border-2 border-brand-lime border-t-transparent border-l-transparent transform rotate-45" />
        <div className="absolute top-12 right-12 text-[10px] font-mono text-slate-400">
          密库 #0027
        </div>
      </div>

      {/* 小节标题 与 搜索栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">保险库总览</h2>
          <span className="text-xs font-mono text-slate-400">// VAULT OVERVIEW</span>
        </div>

        {/* 快速搜索框 */}
        <div className="relative w-48 sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="检索标题、账号、网址或备注..."
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

      {/* 大字号指标与进度刻度 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* 已收录凭据量 */}
        <div>
          <span className="text-xs font-mono text-slate-400 block mb-1">
            已收录密码凭据 // TOTAL CAPACITY
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 tracking-tight">
              {totalItems}
            </span>
            <span className="text-xl sm:text-2xl font-mono text-slate-400">
              / {maxCapacity}
            </span>
          </div>
          {/* 战术横向进度刻度条 */}
          <div className="relative w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-[#161922] transition-all duration-500 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* 密码库健康评分 */}
        <div className="sm:border-l sm:border-slate-100 sm:pl-6">
          <span className="text-xs font-mono text-slate-400 block mb-1">
            全库安全健康评分 // AUDIT SCORE
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl sm:text-5xl font-extrabold font-mono tracking-tight ${
                healthScore >= 90
                  ? 'text-emerald-600'
                  : healthScore >= 70
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}
            >
              {healthScore}
            </span>
            <span className="text-sm font-bold text-slate-500">
              {healthScore >= 90 ? '极强防卫' : healthScore >= 70 ? '良好防卫' : '存在风险'}
            </span>
          </div>
          {/* 综合健康指示器 */}
          <div className="relative w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                healthScore >= 90
                  ? 'bg-emerald-500'
                  : healthScore >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* 战术四列参数格 (彻底替换旧的城镇中心/防卫值，替换为真实的密码管理核心指标) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>核心置顶</span>
          </div>
          <span className="text-sm font-bold font-mono text-slate-900 block pl-2">
            {favoriteCount} 项
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>弱密码风险</span>
          </div>
          <span
            className={`text-sm font-bold font-mono block pl-2 ${
              weakCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {weakCount > 0 ? `${weakCount} 项警告` : '0 (无风险)'}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>重复使用</span>
          </div>
          <span
            className={`text-sm font-bold font-mono block pl-2 ${
              reusedCount > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {reusedCount > 0 ? `${reusedCount} 处复用` : '0 (独立隔离)'}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-mono text-slate-400">
            <span className="w-0.5 h-2.5 bg-brand-lime inline-block" />
            <span>加密算法</span>
          </div>
          <span className="text-sm font-bold font-mono text-slate-900 block pl-2">
            AES-256-GCM
          </span>
        </div>
      </div>

      {/* 底部座右铭 */}
      <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-serif italic tracking-wider">
        “ 以算法与秩序，筑牢私密资产的安全中枢。 ”
      </p>
    </div>
  );
};
