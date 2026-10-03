import React, { useState, useMemo } from 'react';
import { Plus, ShieldAlert, KeyRound, Shield, Star, ExternalLink, ArrowUpDown, Trash2, RotateCcw, Menu, X, ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';
import { DecryptedVaultItem, SortOption } from '../types/vault';
import { Sidebar } from './Sidebar';
import { VaultOverview } from './VaultOverview';
import { PasswordCard } from './PasswordCard';
import { EmptySlotCard } from './EmptySlotCard';
import { TacticalDefensePanel } from './TacticalDefensePanel';
import { performSecurityAudit } from '../utils/audit';
import { calculatePasswordStrength } from '../utils/crypto';
import { registerAndroidBackHandler } from '../utils/androidBack';

interface VaultListProps {
  items: DecryptedVaultItem[];
  isLoading: boolean;
  remainingLockSeconds: number;
  lockTimeoutMinutes: number;
  hasSecondaryPassword: boolean;
  isSecondaryAuthorized: boolean;
  isPrivacyShieldEnabled: boolean;
  isSecondaryAuthRequired: boolean;
  onRequestSecondaryAuth: (onSuccess: () => void) => void;
  onOpenSecondaryPasswordModal: () => void;
  onChangeLockTimeout: (mins: number) => void;
  onTogglePrivacyShield: (enabled: boolean) => void;
  onAddNew: () => void;
  onEditItem: (item: DecryptedVaultItem) => void;
  onDeleteItem: (id: string, title: string) => void;
  onRestoreItem?: (id: string) => void;
  onPermanentDeleteItem?: (id: string, title: string) => void;
  onEmptyTrash?: () => void;
  onToggleFavorite: (id: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
  onCopyTotp: (code: string) => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
  onOpenChangeMasterPassword?: () => void;
  onOpenEmergencyKit?: () => void;
  isNasConnected?: boolean;
  onOpenSyncModal?: () => void;
  onOpenUpdateModal?: () => void;
  onOpenUserManual?: () => void;
}

export const VaultList: React.FC<VaultListProps> = ({
  items,
  isLoading,
  remainingLockSeconds,
  lockTimeoutMinutes,
  hasSecondaryPassword,
  isSecondaryAuthorized,
  isPrivacyShieldEnabled,
  isSecondaryAuthRequired,
  onRequestSecondaryAuth,
  onOpenSecondaryPasswordModal,
  onChangeLockTimeout,
  onTogglePrivacyShield,
  onAddNew,
  onEditItem,
  onDeleteItem,
  onRestoreItem,
  onPermanentDeleteItem,
  onEmptyTrash,
  onToggleFavorite,
  onCopyUsername,
  onCopyPassword,
  onCopyTotp,
  onOpenGenerator,
  onOpenBackup,
  onOpenChangeMasterPassword,
  onOpenEmergencyKit,
  isNasConnected,
  onOpenSyncModal,
  onOpenUpdateModal,
  onOpenUserManual
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('favorites_first');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('safevault_sidebar_collapsed_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    try {
      return window.localStorage.getItem('safevault_sidebar_pinned_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [isDefenseOpen, setIsDefenseOpen] = useState(false);
  const [isDefensePinned, setIsDefensePinned] = useState(() => {
    try {
      return window.localStorage.getItem('safevault_defense_pinned_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [isDefenseCollapsed, setIsDefenseCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('safevault_defense_collapsed_v1') === 'true';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem('safevault_sidebar_collapsed_v1', String(isSidebarCollapsed));
      window.localStorage.setItem('safevault_sidebar_pinned_v1', String(isSidebarPinned));
    } catch {
      // 私有浏览模式或存储被禁用时不影响界面使用。
    }
  }, [isSidebarCollapsed, isSidebarPinned]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('safevault_defense_pinned_v1', String(isDefensePinned));
    } catch {
      // 私有浏览模式或存储被禁用时不影响界面使用。
    }
  }, [isDefensePinned]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('safevault_defense_collapsed_v1', String(isDefenseCollapsed));
    } catch {
      // 私有浏览模式或存储被禁用时不影响界面使用。
    }
  }, [isDefenseCollapsed]);

  React.useEffect(() => registerAndroidBackHandler(() => {
    if (isDefenseOpen) {
      setIsDefenseOpen(false);
      return true;
    }
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      return true;
    }
    return false;
  }), [isDefenseOpen, isSidebarOpen]);

  const isTrashMode = selectedCategory === 'trash';
  const activeItems = useMemo(() => items.filter((i) => !i.isDeleted), [items]);
  const trashItems = useMemo(() => items.filter((i) => i.isDeleted), [items]);

  // 全局密码安全审计 (仅审计活跃凭据)
  const audit = useMemo(() => performSecurityAudit(items), [items]);

  // 过滤条目
  const sourceItems = isTrashMode ? trashItems : activeItems;
  const filteredItems = useMemo(() => {
    let result = sourceItems.filter((item) => {
      // 分类与特殊视图过滤
      let matchesCategory = true;
      if (!isTrashMode) {
        if (selectedCategory === 'favorites') {
          matchesCategory = !!item.isFavorite;
        } else if (selectedCategory === 'risky') {
          matchesCategory = audit.riskyItemIds.includes(item.id);
        } else if (selectedCategory !== 'all') {
          matchesCategory = item.category === selectedCategory;
        }
      }

      // 关键词检索
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.website && item.website.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });

    // 排序
    return result.sort((a, b) => {
      if (sortBy === 'favorites_first') {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === 'updated_desc') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title, 'zh-CN');
      }
      if (sortBy === 'strength_asc') {
        return calculatePasswordStrength(a.password).score - calculatePasswordStrength(b.password).score;
      }
      return 0;
    });
  }, [sourceItems, isTrashMode, searchQuery, selectedCategory, sortBy, audit]);

  // 核心置顶凭据 (废纸篓模式下不显示置顶)
  const corePinnedItem = isTrashMode
    ? null
    : activeItems.find((i) => i.isFavorite) || (activeItems.length > 0 ? activeItems[0] : null);

  // 计算每个分类下的活跃密码凭据数量
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of activeItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [activeItems]);

  return (
    <div className={`flex-1 flex h-full min-w-0 overflow-hidden w-full relative ${isSidebarPinned || isDefensePinned ? 'flex-row' : 'flex-col 2xl:flex-row'}`}>
      {/* 1. 左侧顶天立地分类导航停靠栏 */}
      <div className={`${isSidebarPinned ? 'flex' : 'hidden 2xl:flex'} shrink-0`}>
        {isSidebarCollapsed ? (
          <div className="w-10 h-full bg-white border-r border-slate-200 flex flex-col items-center pt-4 gap-3">
            <button
              type="button"
              aria-label="展开分类侧栏"
              title="展开分类侧栏"
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-50 p-1"
              onClick={() => setIsSidebarCollapsed(false)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={isSidebarPinned ? '取消侧栏常驻' : '侧栏常驻'}
              title={isSidebarPinned ? '取消侧栏常驻' : '侧栏常驻'}
              className="text-slate-400 hover:text-slate-900 p-1"
              onClick={() => setIsSidebarPinned((value) => !value)}
            >
              {isSidebarPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <div className="relative h-full">
            <Sidebar
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              favoritesCount={audit.favoriteCount}
              riskyCount={audit.riskyItemIds.length}
              trashCount={trashItems.length}
              totalCount={activeItems.length}
              categoryCounts={categoryCounts}
            />
            <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5">
              <button
                type="button"
                aria-label={isSidebarPinned ? '取消侧栏常驻' : '侧栏常驻'}
                title={isSidebarPinned ? '取消侧栏常驻' : '侧栏常驻'}
                className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200/80"
                onClick={() => setIsSidebarPinned((value) => !value)}
              >
                {isSidebarPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                aria-label="收起分类侧栏"
                title="收起分类侧栏"
                className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200/80"
                onClick={() => setIsSidebarCollapsed(true)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 窄窗口下按需打开分类侧栏，避免主内容被固定侧栏挤出屏幕 */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 2xl:hidden flex">
          <button
            type="button"
            aria-label="关闭分类侧栏"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col">
            <div className="android-safe-overlay-header shrink-0 h-12 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">分类索引</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="侧栏常驻"
                  title="侧栏常驻"
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                  onClick={() => {
                    setIsSidebarPinned(true);
                    setIsSidebarOpen(false);
                  }}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="关闭分类侧栏"
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Sidebar
                selectedCategory={selectedCategory}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  setIsSidebarOpen(false);
                }}
                favoritesCount={audit.favoriteCount}
                riskyCount={audit.riskyItemIds.length}
                trashCount={trashItems.length}
                totalCount={activeItems.length}
                categoryCounts={categoryCounts}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. 中部核心主监控看板与凭据列表 (独立容器平滑滚动) */}
      <section className="safevault-main-canvas flex-1 h-full overflow-y-auto min-w-0 bg-[#F5F6F8] p-3 pb-24 sm:p-6 space-y-4 sm:space-y-5 scrollbar-none">
        {/* 窄窗口下收起两侧面板，主内容保持完整宽度 */}
        <div className="hidden sm:flex 2xl:hidden items-center justify-between gap-2 -mb-1">
          {!isSidebarPinned && (
            <button
              type="button"
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-3.5 h-3.5" />
              分类
            </button>
          )}
          {!isDefensePinned && (
            <button
              type="button"
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-sm"
              onClick={() => setIsDefenseOpen(true)}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              安全审计
            </button>
          )}
        </div>
        {/* 废纸篓模式横幅 或 正常模式保险库总览 HUD */}
        {isTrashMode ? (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-tactical-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-rose-900 text-sm">密码废纸篓 (已软删除凭据)</h4>
                <p className="text-xs text-rose-600 mt-0.5">
                  已移入废纸篓的凭据已从主库隔离，不参与安全体检。您可以随时一键恢复，或彻底粉碎。
                </p>
              </div>
            </div>
            {trashItems.length > 0 && onEmptyTrash && (
              <button
                onClick={onEmptyTrash}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-colors shrink-0 shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空废纸篓 ({trashItems.length})</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mobile-overview">
            <VaultOverview
              totalItems={activeItems.length}
              favoriteCount={audit.favoriteCount}
              weakCount={audit.weakCount}
              reusedCount={audit.reusedCount}
              healthScore={audit.healthScore}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        )}

        {/* 核心置顶凭据展示区 (专业密码管理器设计) */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>核心置顶凭据</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">// PINNED CREDENTIAL</span>
            </div>
            {corePinnedItem && (
              <span className="text-[11px] text-slate-400 font-mono">
                {items.filter(i => i.isFavorite).length} 项已置顶
              </span>
            )}
          </div>

          {corePinnedItem ? (
            <div className="relative bg-white border border-amber-300 rounded-lg p-4 shadow-tactical-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-brand-lime shrink-0 shadow-sm">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-base text-slate-900">{corePinnedItem.title}</h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                      ★ 核心置顶
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      AES-256 加密
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {corePinnedItem.notes || '核心关键凭据，保障关键业务与管理后台的身份鉴权。'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-700 font-bold">账号:</span> {corePinnedItem.username || '(无)'}
                    </span>
                    {corePinnedItem.website && (
                      <>
                        <span className="w-1 h-3 bg-slate-200" />
                        <a
                          href={corePinnedItem.website.startsWith('http') ? corePinnedItem.website : `https://${corePinnedItem.website}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-slate-600 hover:text-slate-900 underline flex items-center gap-0.5"
                        >
                          <span>访问官网</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => {
                    if (isSecondaryAuthRequired && onRequestSecondaryAuth) {
                      onRequestSecondaryAuth(() => onCopyPassword(corePinnedItem.password));
                    } else {
                      onCopyPassword(corePinnedItem.password);
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  复制核心密码
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-5 text-center">
              <KeyRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                暂无核心置顶凭据。在任意密码卡片上点击星标 ★，即可将其置顶于此处。
              </p>
            </div>
          )}
        </div>

        {/* 密码凭据列表专区 */}
        <div className="pb-8">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                密码档案库 ({filteredItems.length}/{items.length})
              </h3>
              <span className="text-[10px] font-mono text-slate-400">// CREDENTIAL VAULT</span>
            </div>

            <div className="flex items-center gap-2">
              {/* 排序选择 */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-600">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent focus:outline-none cursor-pointer text-xs font-medium"
                >
                  <option value="favorites_first">置顶优先</option>
                  <option value="updated_desc">最近更新</option>
                  <option value="title_asc">名称 A-Z</option>
                  <option value="strength_asc">弱密码优先</option>
                </select>
              </div>

              {/* 快速新建按钮 */}
              <button
                onClick={onAddNew}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium flex items-center gap-1 shadow-sm transition-colors font-mono"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>录入新凭据</span>
              </button>
            </div>
          </div>

          {/* 骨架屏加载状态 */}
          {isLoading && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* 已录入凭据卡片 */}
              {filteredItems.map((item, idx) => {
                const numStr = (idx + 1).toString().padStart(2, '0');
                const isWeak = audit.weakItemIds.includes(item.id);
                const isReused = audit.reusedItemIds.includes(item.id);

                return (
                  <PasswordCard
                    key={item.id}
                    item={item}
                    indexNumber={numStr}
                    isWeak={isWeak}
                    isReused={isReused}
                    isSecondaryAuthRequired={isSecondaryAuthRequired}
                    isTrashMode={isTrashMode}
                    onRequestSecondaryAuth={onRequestSecondaryAuth}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    onRestore={onRestoreItem}
                    onPermanentDelete={onPermanentDeleteItem}
                    onToggleFavorite={onToggleFavorite}
                    onCopyUsername={onCopyUsername}
                    onCopyPassword={onCopyPassword}
                    onCopyTotp={onCopyTotp}
                  />
                );
              })}

              {/* 空置录入槽位卡片 (仅在正常库模式下展示) */}
              {!isTrashMode && (
                <EmptySlotCard
                  slotNumber={(filteredItems.length + 1).toString().padStart(2, '0')}
                  onClick={onAddNew}
                />
              )}
            </div>
          )}

          {/* 搜索/筛选无结果 */}
          {!isLoading && items.length > 0 && filteredItems.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 mb-1">未检索到匹配的凭据条目</p>
              <p className="text-xs text-slate-400 mb-3">当前筛选条件下没有符合条目</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-semibold"
              >
                重置筛选条件
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 手机端底部导航只保留三个独立入口；置顶属于分类筛选，不再重复占用一个导航位。 */}
      <nav className="mobile-bottom-nav safevault-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 items-end border-t border-slate-200 bg-white/95 px-5 pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md sm:hidden" aria-label="移动端主导航">
        <button type="button" onClick={() => setSelectedCategory('all')} className={`mobile-nav-item ${selectedCategory === 'all' ? 'text-slate-950' : 'text-slate-400'}`}>
          <KeyRound className="h-5 w-5" />
          <span>密码库</span>
        </button>
        <button type="button" onClick={() => setIsDefenseOpen(true)} className="mobile-nav-item text-slate-400">
          <Shield className="h-5 w-5" />
          <span>安全</span>
        </button>
        <button type="button" onClick={() => setIsSidebarOpen(true)} className="mobile-nav-item text-slate-400">
          <Menu className="h-5 w-5" />
          <span>分类</span>
        </button>
      </nav>

      {/* 右下角新增按钮，避开底部 Home Indicator 并保持拇指可达。 */}
      <button type="button" onClick={onAddNew} className="mobile-fab fixed bottom-[max(4.75rem,calc(4.3rem+env(safe-area-inset-bottom,0px)))] right-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-brand-lime shadow-[0_10px_24px_rgba(15,23,42,0.24)] ring-4 ring-white/90 transition-transform hover:scale-105 active:scale-95 sm:hidden" aria-label="新增凭据" title="新增凭据">
        <Plus className="h-7 w-7" />
      </button>

      {/* 3. 右侧安全审计与防御面板 */}
      <div className={`${isDefensePinned ? 'flex' : 'hidden 2xl:flex'} shrink-0 h-full`}>
        {isDefenseCollapsed ? (
          <div className="w-10 h-full bg-white border-l border-slate-200 flex flex-col items-center pt-4 gap-3">
            <button
              type="button"
              aria-label="展开安全审计栏"
              title="展开安全审计栏"
              className="text-slate-500 hover:text-slate-900 hover:bg-slate-50 p-1"
              onClick={() => setIsDefenseCollapsed(false)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={isDefensePinned ? '取消安全栏常驻' : '安全栏常驻'}
              title={isDefensePinned ? '取消安全栏常驻' : '安全栏常驻'}
              className="text-slate-400 hover:text-slate-900 p-1"
              onClick={() => setIsDefensePinned((value) => !value)}
            >
              {isDefensePinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <TacticalDefensePanel
            weakCount={audit.weakCount}
            reusedCount={audit.reusedCount}
            remainingLockSeconds={remainingLockSeconds}
            lockTimeoutMinutes={lockTimeoutMinutes}
            hasSecondaryPassword={hasSecondaryPassword}
            isSecondaryAuthorized={isSecondaryAuthorized}
            isPrivacyShieldEnabled={isPrivacyShieldEnabled}
            isPinned={isDefensePinned}
            onOpenSecondaryPasswordModal={onOpenSecondaryPasswordModal}
            onChangeLockTimeout={onChangeLockTimeout}
            onTogglePrivacyShield={onTogglePrivacyShield}
            onTogglePinned={() => setIsDefensePinned((value) => !value)}
            onToggleCollapsed={() => setIsDefenseCollapsed(true)}
            onOpenGenerator={onOpenGenerator}
            onOpenBackup={onOpenBackup}
            onFilterRisky={() => setSelectedCategory('risky')}
            onOpenChangeMasterPassword={onOpenChangeMasterPassword}
            onOpenEmergencyKit={onOpenEmergencyKit}
            isNasConnected={isNasConnected}
            onOpenSyncModal={onOpenSyncModal}
            onOpenUpdateModal={onOpenUpdateModal}
            onOpenUserManual={onOpenUserManual}
          />
        )}
      </div>

      {/* 窄窗口下按需打开安全审计侧栏 */}
      {isDefenseOpen && !isDefensePinned && (
        <div className="fixed inset-0 z-50 2xl:hidden flex">
          <button
            type="button"
            aria-label="关闭安全审计侧栏"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsDefenseOpen(false)}
          />
          <div className="relative h-full w-80 max-w-[92vw] bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="android-safe-overlay-header shrink-0 h-12 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">安全审计与防御中枢</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="安全栏常驻"
                  title="安全栏常驻"
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                  onClick={() => {
                    setIsDefensePinned(true);
                    setIsDefenseOpen(false);
                  }}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="关闭安全审计侧栏"
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                  onClick={() => setIsDefenseOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <TacticalDefensePanel
                weakCount={audit.weakCount}
                reusedCount={audit.reusedCount}
                remainingLockSeconds={remainingLockSeconds}
                lockTimeoutMinutes={lockTimeoutMinutes}
                hasSecondaryPassword={hasSecondaryPassword}
                isSecondaryAuthorized={isSecondaryAuthorized}
                isPrivacyShieldEnabled={isPrivacyShieldEnabled}
                isPinned={isDefensePinned}
                onOpenSecondaryPasswordModal={onOpenSecondaryPasswordModal}
                onChangeLockTimeout={onChangeLockTimeout}
                onTogglePrivacyShield={onTogglePrivacyShield}
                onTogglePinned={() => setIsDefensePinned((value) => !value)}
                onOpenGenerator={onOpenGenerator}
                onOpenBackup={onOpenBackup}
                onFilterRisky={() => {
                  setSelectedCategory('risky');
                  setIsDefenseOpen(false);
                }}
                onOpenChangeMasterPassword={onOpenChangeMasterPassword}
                onOpenEmergencyKit={onOpenEmergencyKit}
                isNasConnected={isNasConnected}
                onOpenSyncModal={onOpenSyncModal}
                onOpenUpdateModal={onOpenUpdateModal}
                onOpenUserManual={onOpenUserManual}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
