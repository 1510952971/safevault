import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Lock, Sparkles, DownloadCloud, Plus, ExternalLink, Copy, Key, ArrowRight, CornerDownLeft, FileText } from 'lucide-react';
import { DecryptedVaultItem } from '../types/vault';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DecryptedVaultItem[];
  onSelectCopyPassword: (password: string) => void;
  onSelectCopyUsername: (username: string) => void;
  onOpenNew: () => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
  onLockNow: () => void;
  onOpenChangeMasterPassword?: () => void;
  onOpenEmergencyKit?: () => void;
  onOpenSyncModal?: () => void;
  onOpenUpdateModal?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectCopyPassword,
  onSelectCopyUsername,
  onOpenNew,
  onOpenGenerator,
  onOpenBackup,
  onLockNow,
  onOpenChangeMasterPassword,
  onOpenEmergencyKit,
  onOpenSyncModal,
  onOpenUpdateModal
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeItems = useMemo(() => items.filter((i) => !i.isDeleted), [items]);

  // 匹配的凭据条目
  const filteredItems = useMemo(() => {
    if (!query.trim()) return activeItems.slice(0, 6);
    const q = query.toLowerCase().trim();
    return activeItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.website && item.website.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [activeItems, query]);

  // 快捷动作列表 (当没有深入匹配或搜索匹配动作时展示)
  const quickActions = useMemo(() => {
    const actions = [
      { id: 'act-new', label: '录入新密码凭据', icon: <Plus className="w-4 h-4 text-brand-lime" />, run: onOpenNew },
      { id: 'act-gen', label: '生成高熵随机密码', icon: <Sparkles className="w-4 h-4 text-amber-500" />, run: onOpenGenerator },
      { id: 'act-backup', label: '导出离线加密备份', icon: <DownloadCloud className="w-4 h-4 text-sky-500" />, run: onOpenBackup },
      ...(onOpenSyncModal ? [{ id: 'act-nas-sync', label: '极空间 NAS 容器多端同步设置', icon: <ExternalLink className="w-4 h-4 text-emerald-500" />, run: onOpenSyncModal }] : []),
      ...(onOpenChangeMasterPassword ? [{ id: 'act-change-master', label: '修改密码库主密码并全库重加密', icon: <Key className="w-4 h-4 text-teal-500" />, run: onOpenChangeMasterPassword }] : []),
      ...(onOpenEmergencyKit ? [{ id: 'act-emergency-kit', label: '生成打印离线应急救援卡', icon: <FileText className="w-4 h-4 text-indigo-500" />, run: onOpenEmergencyKit }] : []),
      ...(onOpenUpdateModal ? [{ id: 'act-check-update', label: '检查 GitHub 程序版本更新', icon: <Sparkles className="w-4 h-4 text-purple-400" />, run: onOpenUpdateModal }] : []),
      { id: 'act-lock', label: '立即锁定密码管理库', icon: <Lock className="w-4 h-4 text-rose-500" />, run: onLockNow }
    ];

    if (!query.trim()) return actions;
    const q = query.toLowerCase().trim();
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [query, onOpenNew, onOpenGenerator, onOpenBackup, onLockNow, onOpenChangeMasterPassword, onOpenEmergencyKit]);

  const totalSelectable = filteredItems.length + quickActions.length;

  // 重置状态与聚焦
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 键盘导航 (上下键、回车)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (totalSelectable > 0 ? (prev + 1) % totalSelectable : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (totalSelectable > 0 ? (prev - 1 + totalSelectable) % totalSelectable : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex < filteredItems.length) {
          const item = filteredItems[selectedIndex];
          if (e.shiftKey) {
            onSelectCopyUsername(item.username);
          } else {
            onSelectCopyPassword(item.password);
          }
          onClose();
        } else {
          const actionIdx = selectedIndex - filteredItems.length;
          if (quickActions[actionIdx]) {
            quickActions[actionIdx].run();
            onClose();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, quickActions, totalSelectable, onSelectCopyPassword, onSelectCopyUsername, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-slate-950/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative bg-white border border-slate-300 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部搜索框 */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 bg-slate-50/50 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="搜索凭据、账号、网址或输入命令..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300">
              ESC 关闭
            </span>
          </div>
        </div>

        {/* 结果列表区 */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100 scrollbar-thin">
          {/* 匹配凭据 */}
          {filteredItems.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                凭据档案 ({filteredItems.length})
              </div>
              {filteredItems.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => {
                      onSelectCopyPassword(item.password);
                      onClose();
                    }}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-[#161922] text-white' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-slate-800 text-brand-lime' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Key className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm truncate">{item.title}</span>
                          {item.isFavorite && (
                            <span className={`text-[9px] px-1 rounded font-bold ${
                              isSelected ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              ★ 置顶
                            </span>
                          )}
                        </div>
                        <span className={`text-[11px] font-mono truncate block ${
                          isSelected ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {item.username || '(无账号)'} {item.website ? `· ${item.website}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCopyUsername(item.username);
                          onClose();
                        }}
                        className={`text-[10px] font-mono px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                          isSelected ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                        title="复制账号"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>账号</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCopyPassword(item.password);
                          onClose();
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded font-bold bg-brand-lime text-slate-950 hover:bg-lime-400 transition-colors flex items-center gap-1 shadow-sm"
                        title="复制密码"
                      >
                        <CornerDownLeft className="w-2.5 h-2.5" />
                        <span>复制密码</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 快捷操作动作 */}
          {quickActions.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                快捷动作 ({quickActions.length})
              </div>
              {quickActions.map((act, actIdx) => {
                const globalIdx = filteredItems.length + actIdx;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <div
                    key={act.id}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    onClick={() => {
                      act.run();
                      onClose();
                    }}
                    className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-[#161922] text-white' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-slate-800' : 'bg-slate-100'
                      }`}>
                        {act.icon}
                      </div>
                      <span className="text-xs sm:text-sm font-semibold">{act.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? 'text-slate-400 bg-slate-800' : 'text-slate-400 bg-slate-100'
                      }`}>
                        ENTER
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 无匹配结果 */}
          {totalSelectable === 0 && (
            <div className="py-10 text-center text-slate-400 text-xs">
              未找到与 &quot;{query}&quot; 相关的凭据或命令
            </div>
          )}
        </div>

        {/* 底部按键提示栏 */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-white border border-slate-200 rounded text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.2 bg-white border border-slate-200 rounded text-[10px]">↓</kbd>
              <span>导航</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white border border-slate-200 rounded text-[10px]">ENTER</kbd>
              <span>复制密码 / 执行</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-white border border-slate-200 rounded text-[10px]">Shift+ENTER</kbd>
              <span>复制账号</span>
            </span>
          </div>
          <span className="hidden sm:inline text-slate-400">SAFEVAULT QUICK COMMAND</span>
        </div>
      </div>
    </div>
  );
};
