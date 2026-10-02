import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  FileText,
  LogOut,
  User,
  Palette
} from 'lucide-react';
import { SafeVaultLogo } from './SafeVaultLogo';
import { CURRENT_APP_VERSION } from '../utils/updateChecker';

interface HeaderProps {
  isLocked: boolean;
  totalItems: number;
  remainingLockSeconds: number;
  lockTimeoutMinutes: number;
  hasSecondaryPassword: boolean;
  isSecondaryAuthorized: boolean;
  currentAccount?: string | null;
  isNasConnected?: boolean;
  nasLastSyncTime?: string | null;
  onOpenSecondaryPasswordModal: () => void;
  onChangeLockTimeout: (mins: number) => void;
  onLockNow: () => void;
  onLogout?: () => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
  onOpenChangeMasterPassword?: () => void;
  onOpenEmergencyKit?: () => void;
  onOpenSyncModal?: () => void;
  onOpenUpdateModal?: () => void;
  onOpenTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLocked,
  totalItems,
  remainingLockSeconds,
  lockTimeoutMinutes,
  hasSecondaryPassword,
  isSecondaryAuthorized,
  currentAccount,
  isNasConnected,
  nasLastSyncTime,
  onOpenSecondaryPasswordModal,
  onChangeLockTimeout,
  onLockNow,
  onLogout,
  onOpenGenerator,
  onOpenBackup,
  onOpenChangeMasterPassword,
  onOpenEmergencyKit,
  onOpenSyncModal,
  onOpenUpdateModal,
  onOpenTheme
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePortalRef = useRef<HTMLDivElement>(null);
  const [moreMenuStyle, setMoreMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(target) &&
        !morePortalRef.current?.contains(target)
      ) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isMoreOpen) return;

    const updateMoreMenuPosition = () => {
      const button = moreButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = 208;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        Math.max(8, window.innerWidth - menuWidth - 8)
      );
      setMoreMenuStyle({
        top: `${Math.min(rect.bottom + 6, window.innerHeight - 12)}px`,
        left: `${left}px`,
        width: `${menuWidth}px`
      });
    };

    updateMoreMenuPosition();
    window.addEventListener('resize', updateMoreMenuPosition);
    window.addEventListener('scroll', updateMoreMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMoreMenuPosition);
      window.removeEventListener('scroll', updateMoreMenuPosition, true);
    };
  }, [isMoreOpen]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <header className="safevault-header mobile-safe-top shrink-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 lg:px-5 min-h-14 flex items-center gap-2 transition-all shadow-xs w-full min-w-0 overflow-visible select-none">
      
      {/* 左侧系统标识与版本 */}
      <div className="flex items-center gap-2.5 min-w-0 shrink whitespace-nowrap">
        <SafeVaultLogo size={32} className="shrink-0 drop-shadow-xs" />
        <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
          <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
            <span className="sm:hidden">SafeVault</span>
            <span className="hidden sm:inline">密码数据库</span>
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
              <span>{CURRENT_APP_VERSION}</span>
            </button>
          )}
        </div>
      </div>

      {/* 右侧战术操作区：始终单行，窗口变窄时隐藏说明文字，保留图标与核心操作 */}
      <div className="safevault-header-actions ml-auto max-w-[61vw] sm:max-w-none flex-1 min-w-0 flex items-center justify-start sm:justify-end gap-1 whitespace-nowrap overflow-x-auto overflow-y-visible scrollbar-none py-1">
        {!isLocked && (
          <>
            {/* 凭据体量 (超大宽屏展示) */}
            <div className="hidden 2xl:flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded whitespace-nowrap">
              <span>{totalItems} 项</span>
            </div>

            {/* 超时自动锁屏倒计时与配置 */}
            <div
              className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-mono text-slate-700 transition-colors whitespace-nowrap shrink-0"
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

            {/* 当前登录账号状态 / 极空间同步入口 */}
            {onOpenSyncModal && (
              <button
                onClick={onOpenSyncModal}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isNasConnected
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title={isNasConnected ? `当前账号: ${currentAccount || '已联机'} · 极空间数据在线 (最后更新: ${nasLastSyncTime ? new Date(nasLastSyncTime).toLocaleTimeString() : '刚刚'})` : '极空间 NAS 数据与历史 (未连接)'}
              >
                {isNasConnected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden xl:inline font-bold font-mono">👤 {currentAccount || '已联机'}</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="hidden xl:inline">极空间未连接</span>
                  </>
                )}
              </button>
            )}

            {/* 二级安全密码设置/状态 */}
            <button
              onClick={onOpenSecondaryPasswordModal}
              className={`flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors items-center gap-1.5 whitespace-nowrap shrink-0 ${
                hasSecondaryPassword
                  ? isSecondaryAuthorized
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="二级查看安全密码，点击管理"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">
                二级密码: {hasSecondaryPassword ? (isSecondaryAuthorized ? '已授权' : '保护中') : '未开启'}
              </span>
            </button>

            {/* 强密码发生器 */}
            <button
              onClick={onOpenGenerator}
              className="flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition-colors items-center gap-1.5 whitespace-nowrap shrink-0"
              title="强密码发生器"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden xl:inline">密码发生器</span>
            </button>

            {/* 备份与恢复 */}
            <button
              onClick={onOpenBackup}
              className="flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition-colors items-center gap-1.5 whitespace-nowrap shrink-0"
              title="备份与恢复"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="hidden xl:inline">密文备份</span>
            </button>

            {/* 更多功能下拉菜单 (优雅收纳 修改主密码、应急救援单、GitHub更新) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                ref={moreButtonRef}
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isMoreOpen
                    ? 'bg-slate-200 text-slate-900 border-slate-400'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="更多安全与运维功能"
              >
                <span className="hidden sm:inline">更多</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMoreOpen && createPortal(
                <div
                  ref={morePortalRef}
                  style={{ ...moreMenuStyle, position: 'fixed' }}
                  className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-[100] animate-in fade-in-50 duration-150 max-h-[calc(100vh-5rem)] overflow-y-auto"
                >
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
                        <span className="text-[10px] text-slate-400 font-mono">CHECK RELEASES // {CURRENT_APP_VERSION}</span>
                      </div>
                    </button>
                  )}
                  {onOpenTheme && (
                    <button
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenTheme();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors border-t border-slate-100"
                    >
                      <Palette className="w-3.5 h-3.5 text-fuchsia-500" />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">主题与外观</span>
                        <span className="text-[10px] text-slate-400 font-mono">THEME & APPEARANCE</span>
                      </div>
                    </button>
                  )}
                </div>,
                document.body
              )}
            </div>

            {/* 立即锁定与退出当前账号 */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onLockNow}
                className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all whitespace-nowrap shrink-0"
                title="立即锁定密码数据库 (锁屏防窥，输入主密码即可快速解锁)"
              >
                <Lock className="w-3 h-3 text-brand-lime shrink-0" />
                <span className="hidden xl:inline">锁定</span>
              </button>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs"
                  title="退出当前账号 (返回登录界面，可切换其他账号)"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">退出</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
