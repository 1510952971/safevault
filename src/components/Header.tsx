import React from 'react';
import { ShieldCheck, Lock, Sparkles, DownloadCloud, Terminal, Clock } from 'lucide-react';

interface HeaderProps {
  isLocked: boolean;
  totalItems: number;
  remainingLockSeconds: number;
  lockTimeoutMinutes: number;
  onChangeLockTimeout: (mins: number) => void;
  onLockNow: () => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLocked,
  totalItems,
  remainingLockSeconds,
  lockTimeoutMinutes,
  onChangeLockTimeout,
  onLockNow,
  onOpenGenerator,
  onOpenBackup
}) => {
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3 transition-all shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* 左侧系统标识 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-brand-lime shadow-sm">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>凭据管理终端</span>
                <span className="text-xs font-mono font-semibold text-slate-400">// SAFEVAULT</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-brand-lime/20 text-slate-800 border border-brand-lime/60 px-2 py-0.5 rounded font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-lime inline-block"></span>
                ZERO-KNOWLEDGE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wider font-mono hidden sm:block">
              “以算法与秩序，筑牢私密资产的安全中枢。”
            </p>
          </div>
        </div>

        {/* 右侧战术操作区 */}
        <div className="flex items-center gap-2">
          {!isLocked && (
            <>
              {/* 终端编号 Tag */}
              <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded">
                <span>TERMINAL</span>
                <span className="font-bold text-slate-800">#0027</span>
                <span className="w-1 h-3 bg-brand-lime mx-0.5"></span>
                <span>ITEMS: {totalItems}</span>
              </div>

              {/* 超时自动锁屏倒计时与配置 */}
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-mono text-slate-700 transition-colors"
                title="自动锁屏实时倒计时，点击可修改锁屏时长"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-900">{formatTimer(remainingLockSeconds)}</span>
                <span className="text-slate-300">/</span>
                <select
                  value={lockTimeoutMinutes}
                  onChange={(e) => onChangeLockTimeout(Number(e.target.value))}
                  className="bg-transparent text-xs font-mono text-slate-700 font-semibold cursor-pointer focus:outline-none"
                >
                  <option value={1}>1分钟 (快速测试)</option>
                  <option value={3}>3分钟 (默认)</option>
                  <option value={5}>5分钟</option>
                  <option value={15}>15分钟</option>
                  <option value={30}>30分钟</option>
                </select>
              </div>

              {/* 强密码发生器 */}
              <button
                onClick={onOpenGenerator}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                title="强密码发生器"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden sm:inline">密码发生器</span>
              </button>

              {/* 备份与恢复 */}
              <button
                onClick={onOpenBackup}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                title="备份与恢复"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden sm:inline">密文备份</span>
              </button>

              {/* 立即锁定终端 */}
              <button
                onClick={onLockNow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
                title="立即锁定当前终端"
              >
                <Lock className="w-3 h-3 text-brand-lime" />
                <span>锁定终端</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
