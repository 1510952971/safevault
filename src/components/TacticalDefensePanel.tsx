import React from 'react';
import { Clock, Cpu, AlertTriangle, ShieldCheck, CopyCheck } from 'lucide-react';

interface TacticalDefensePanelProps {
  weakCount: number;
  reusedCount: number;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
  onFilterRisky: () => void;
}

export const TacticalDefensePanel: React.FC<TacticalDefensePanelProps> = ({
  weakCount,
  reusedCount,
  onOpenGenerator,
  onOpenBackup,
  onFilterRisky
}) => {
  const hasRisk = weakCount > 0 || reusedCount > 0;

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm">
        {/* 面板标题 */}
        <div className="border-l-4 border-brand-lime pl-2.5 mb-4">
          <h3 className="text-sm font-bold text-slate-900">安全审计与防御中枢</h3>
          <span className="text-[10px] font-mono text-slate-400">AUDIT & DEFENSE // ACTIVE</span>
        </div>

        {/* 核心安全指标列表 */}
        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          {/* 超时自动锁屏 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>超时自动锁屏</span>
            </div>
            <span className="font-mono font-bold text-slate-800">03:00 / 03:00</span>
          </div>

          {/* PBKDF2 算力拉伸 */}
          <div className="flex items-center justify-between pt-2.5">
            <div className="flex items-center gap-2 text-slate-600">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>PBKDF2 算力拉伸</span>
            </div>
            <span className="font-mono font-bold text-slate-800">100,000 轮</span>
          </div>

          {/* 弱密码风险审计 */}
          <div className="flex items-center justify-between pt-2.5">
            <div className="flex items-center gap-2 text-slate-600">
              <AlertTriangle className={`w-4 h-4 ${weakCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
              <span>弱密码风险项</span>
            </div>
            <span className={`font-mono font-bold ${weakCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {weakCount > 0 ? `${weakCount} 项待加固` : '达标 (0)'}
            </span>
          </div>

          {/* 跨站重复密码预警 */}
          <div className="flex items-center justify-between pt-2.5">
            <div className="flex items-center gap-2 text-slate-600">
              <CopyCheck className={`w-4 h-4 ${reusedCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>重复使用密码</span>
            </div>
            <span className={`font-mono font-bold ${reusedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {reusedCount > 0 ? `${reusedCount} 处复用` : '独立隔离 (0)'}
            </span>
          </div>
        </div>

        {/* 战术推进按钮 */}
        <div className="mt-5 space-y-2.5">
          {/* 若存在风险，显示一键体检筛选按钮 */}
          {hasRisk && (
            <button
              onClick={onFilterRisky}
              className="w-full relative flex items-center bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded overflow-hidden transition-all group p-0 shadow-sm text-left"
            >
              <div className="w-9 h-11 bg-rose-500 flex items-center justify-center font-bold text-white shrink-0">
                <span className="text-base font-mono">!</span>
              </div>
              <div className="flex-1 px-3">
                <span className="text-xs font-bold text-rose-900 block">
                  查看风险密码 ({weakCount + reusedCount} 项)
                </span>
                <span className="text-[10px] text-rose-600 font-mono block">CLICK TO FILTER</span>
              </div>
            </button>
          )}

          <button
            onClick={onOpenGenerator}
            className="w-full relative flex items-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded overflow-hidden transition-all group p-0 shadow-sm"
          >
            {/* 左侧斜切荧光黄色块 > */}
            <div className="w-9 h-11 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 px-3 text-left">
              <span className="text-xs font-bold text-slate-900 group-hover:text-slate-950 block">
                生成高熵随机密码
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">CSPRNG ENTROPY</span>
            </div>
          </button>

          <button
            onClick={onOpenBackup}
            className="w-full relative flex items-center bg-[#161922] hover:bg-slate-800 text-white rounded overflow-hidden transition-all group p-0 shadow-sm"
          >
            {/* 左侧斜切荧光黄色块 > */}
            <div className="w-9 h-11 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 px-3 text-left">
              <span className="text-xs font-bold text-white block">
                导出密文离线备份
              </span>
              <span className="text-[10px] text-slate-300 font-mono block">.SAFEVAULT.JSON</span>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};
