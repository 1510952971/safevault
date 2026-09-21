import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  KeyRound,
  Sparkles,
  DownloadCloud,
  Cloud,
  CloudOff,
  GitBranch,
  Lock,
  ChevronDown,
  Key,
  FileText
} from 'lucide-react';
import { SafeVaultLogo } from './SafeVaultLogo';

interface HeaderProps {
  isLocked: boolean;
  totalItems: number;
  remainingLockSeconds: number;
  lockTimeoutMinutes: number;
  hasSecondaryPassword: boolean;
  isSecondaryAuthorized: boolean;
  isNasConnected?: boolean;
  nasLastSyncTime?: string | null;
  onOpenSecondaryPasswordModal: () => void;
  onChangeLockTimeout: (mins: number) => void;
  onLockNow: () => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
  onOpenChangeMasterPassword?: () => void;
  onOpenEmergencyKit?: () => void;
  onOpenSyncModal?: () => void;
  onOpenUpdateModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLocked,
  totalItems,
  remainingLockSeconds,
  lockTimeoutMinutes,
  hasSecondaryPassword,
  isSecondaryAuthorized,
  isNasConnected,
  nasLastSyncTime,
  onOpenSecondaryPasswordModal,
  onChangeLockTimeout,
  onLockNow,
  onOpenGenerator,
  onOpenBackup,
  onOpenChangeMasterPassword,
  onOpenEmergencyKit,
  onOpenSyncModal,
  onOpenUpdateModal
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <header className="shrink-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between transition-all shadow-xs w-full select-none">
      
      {/* 左侧系统标识与版本 (绝对单行，绝不折行) */}
      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
        <SafeVaultLogo size={32} className="shrink-0 drop-shadow-xs" />
        <div className="flex items-center gap-2 whitespace-nowrap">
          <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
            <span>密码管理库</span>
            <span className="text-xs font-mono font-semibold text-slate-400 hidden sm:inline">// SAFEVAULT</span>
          </h1>
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-brand-lime/20 text-slate-800 border border-brand-lime/60 px-2 py-0.5 rounded font-semibold whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-lime inline-block"></span>
            ZERO-KNOWLEDGE
          </span>
          {onOpenUpdateModal && (
            <button
              onClick={onOpenUpdateModal}
              className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded transition-colors font-semibold whitespace-nowrap"
              title="检查 GitHub 版本更新"
            >
              <GitBranch className="w-2.5 h-2.5 text-emerald-600" />
              <span>v1.1.0</span>
            </button>
          )}
        </div>
      </div>

      {/* 右侧战术操作区 (紧凑单行排版，永不换行) */}
      <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
        {!isLocked && (
          <>
            {/* 终端编号与体量 (超大宽屏展示) */}
            <div className="hidden 2xl:flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded whitespace-nowrap">
              <span>TERMINAL</span>
              <span className="font-bold text-slate-800">#0027</span>
              <span className="w-1 h-3 bg-brand-lime mx-0.5"></span>
              <span>{totalItems} 项</span>
            </div>

            {/* 超时自动锁屏倒计时与配置 */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-mono text-slate-700 transition-colors whitespace-nowrap shrink-0"
              title="自动锁屏倒计时，点击可修改"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-900">{formatTimer(remainingLockSeconds)}</span>
              <span className="text-slate-300">/</span>
              <select
                value={lockTimeoutMinutes}
                onChange={(e) => onChangeLockTimeout(Number(e.target.value))}
                className="bg-transparent text-xs font-mono text-slate-700 font-semibold cursor-pointer focus:outline-none"
              >
                <option value={1}>1分</option>
                <option value={3}>3分</option>
                <option value={5}>5分</option>
                <option value={15}>15分</option>
                <option value={30}>30分</option>
              </select>
            </div>

            {/* 极空间 NAS 云同步状态 */}
            {onOpenSyncModal && (
              <button
                onClick={onOpenSyncModal}
                className={`px-2.5 py-1.5 rounded border text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isNasConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title={isNasConnected ? `已连接极空间 NAS (最后同步: ${nasLastSyncTime ? new Date(nasLastSyncTime).toLocaleTimeString() : '刚刚'})` : '极空间 NAS 多端同步中心 (未连接)'}
              >
                {isNasConnected ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
                    <span className="font-bold">极空间同步</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>极空间同步</span>
                  </>
                )}
              </button>
            )}

            {/* 二级安全密码设置/状态 */}
            <button
              onClick={onOpenSecondaryPasswordModal}
              className={`px-2.5 py-1.5 rounded border text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                hasSecondaryPassword
                  ? isSecondaryAuthorized
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="二级查看安全密码，点击管理"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>
                二级密码: {hasSecondaryPassword ? (isSecondaryAuthorized ? '已授权' : '保护中') : '未开启'}
              </span>
            </button>

            {/* 强密码发生器 */}
            <button
              onClick={onOpenGenerator}
              className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="强密码发生器"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">密码发生器</span>
            </button>

            {/* 备份与恢复 */}
            <button
              onClick={onOpenBackup}
              className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="备份与恢复"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="hidden sm:inline">密文备份</span>
            </button>

            {/* 更多功能下拉菜单 (优雅收纳 修改主密码、应急救援单、GitHub更新) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`px-2.5 py-1.5 rounded border text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isMoreOpen
                    ? 'bg-slate-200 text-slate-900 border-slate-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="更多安全与运维功能"
              >
                <span>更多</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMoreOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-in fade-in-50 duration-150">
                  {onOpenChangeMasterPassword && (
                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenChangeMasterPassword();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5 text-slate-500" />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">修改主密码并重加密</span>
                        <span className="text-[10px] text-slate-400 font-mono">RE-KEY VAULT</span>
                      </div>
                    </button>
                  )}
                  {onOpenEmergencyKit && (
                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenEmergencyKit();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">打印/导出应急救援单</span>
                        <span className="text-[10px] text-slate-400 font-mono">EMERGENCY KIT</span>
                      </div>
                    </button>
                  )}
                  {onOpenUpdateModal && (
                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenUpdateModal();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">检查 GitHub 版本更新</span>
                        <span className="text-[10px] text-slate-400 font-mono">CHECK RELEASES // v1.1.0</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 立即锁定密码库 (醒目深色战术按钮) */}
            <button
              onClick={onLockNow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all whitespace-nowrap shrink-0"
              title="立即锁定密码管理库"
            >
              <Lock className="w-3 h-3 text-brand-lime shrink-0" />
              <span>锁定</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
