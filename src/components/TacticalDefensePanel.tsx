import React from 'react';
import { Clock, Cpu, AlertTriangle, ShieldCheck, CopyCheck, KeyRound } from 'lucide-react';

interface TacticalDefensePanelProps {
  weakCount: number;
  reusedCount: number;
  remainingLockSeconds: number;
  lockTimeoutMinutes: number;
  hasSecondaryPassword: boolean;
  isSecondaryAuthorized: boolean;
  onOpenSecondaryPasswordModal: () => void;
  onChangeLockTimeout: (mins: number) => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
  onFilterRisky: () => void;
}

export const TacticalDefensePanel: React.FC<TacticalDefensePanelProps> = ({
  weakCount,
  reusedCount,
  remainingLockSeconds,
  lockTimeoutMinutes,
  hasSecondaryPassword,
  isSecondaryAuthorized,
  onOpenSecondaryPasswordModal,
  onChangeLockTimeout,
  onOpenGenerator,
  onOpenBackup,
  onFilterRisky
}) => {
  const hasRisk = weakCount > 0 || reusedCount > 0;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm">
        {/* 面板标题 */}
        <div className="border-l-4 border-brand-lime pl-2.5 mb-4">
          <h3 className="text-sm font-bold text-slate-900">安全审计与防御中枢</h3>
          <span className="text-[10px] font-mono text-slate-400">AUDIT & DEFENSE // ACTIVE</span>
        </div>

        {/* 核心安全指标列表 */}
        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          {/* 超时自动锁屏 */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <div className="flex items-center gap-2 text-slate-600 shrink-0 whitespace-nowrap">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>自动锁屏</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono font-bold text-slate-800">
                {formatTimer(remainingLockSeconds)}
              </span>
              <span className="text-slate-300">/</span>
              <select
                value={lockTimeoutMinutes}
                onChange={(e) => onChangeLockTimeout(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-700 focus:outline-none cursor-pointer hover:border-slate-300"
                title="选择无操作自动锁屏时长"
              >
                <option value={1}>1分钟</option>
                <option value={3}>3分钟</option>
                <option value={5}>5分钟</option>
                <option value={15}>15分钟</option>
                <option value={30}>30分钟</option>
              </select>
            </div>
          </div>

          {/* 二级独立密码查看防护 */}
          <div className="flex items-center justify-between pt-2.5 gap-2">
            <div className="flex items-center gap-2 text-slate-600 shrink-0 whitespace-nowrap">
              <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
              <span>二级查看密码</span>
            </div>
            <button
              onClick={onOpenSecondaryPasswordModal}
              className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded border transition-colors shrink-0 ${
                hasSecondaryPassword
                  ? isSecondaryAuthorized
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
                    : 'text-amber-700 bg-amber-50 border-amber-300'
                  : 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {hasSecondaryPassword ? (isSecondaryAuthorized ? '已授权查看' : '保护中') : '点击开启'}
            </button>
          </div>

          {/* PBKDF2 算力拉伸 */}
          <div className="flex items-center justify-between pt-2.5 gap-2">
            <div className="flex items-center gap-2 text-slate-600 shrink-0 whitespace-nowrap">
              <Cpu className="w-4 h-4 text-slate-400 shrink-0" />
              <span>PBKDF2 算力拉伸</span>
            </div>
            <span className="font-mono font-bold text-slate-800 shrink-0">100,000 轮</span>
          </div>

          {/* 弱密码风险审计 */}
          <div className="flex items-center justify-between pt-2.5 gap-2">
            <div className="flex items-center gap-2 text-slate-600 shrink-0 whitespace-nowrap">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${weakCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
              <span>弱密码风险项</span>
            </div>
            <span className={`font-mono font-bold shrink-0 ${weakCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {weakCount > 0 ? `${weakCount} 项待加固` : '达标 (0)'}
            </span>
          </div>

          {/* 跨站重复密码预警 */}
          <div className="flex items-center justify-between pt-2.5 gap-2">
            <div className="flex items-center gap-2 text-slate-600 shrink-0 whitespace-nowrap">
              <CopyCheck className={`w-4 h-4 shrink-0 ${reusedCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>重复使用密码</span>
            </div>
            <span className={`font-mono font-bold shrink-0 ${reusedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
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

          {/* 设置/管理二级密码按钮 */}
          <button
            onClick={onOpenSecondaryPasswordModal}
            className="w-full relative flex items-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded overflow-hidden transition-all group p-0 shadow-sm"
          >
            <div className="w-9 h-11 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 px-3 text-left">
              <span className="text-xs font-bold text-slate-900 group-hover:text-slate-950 block">
                {hasSecondaryPassword ? '管理二级查看密码' : '开启二级安全密码'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">TIER-2 PROTECTION</span>
            </div>
          </button>

          <button
            onClick={onOpenGenerator}
            className="w-full relative flex items-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded overflow-hidden transition-all group p-0 shadow-sm"
          >
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
