import React, { useState, useMemo } from 'react';
import { Plus, ShieldAlert, KeyRound, Shield, Star, ExternalLink, ArrowUpDown } from 'lucide-react';
import { DecryptedVaultItem, SortOption } from '../types/vault';
import { Sidebar } from './Sidebar';
import { VaultOverview } from './VaultOverview';
import { PasswordCard } from './PasswordCard';
import { EmptySlotCard } from './EmptySlotCard';
import { TacticalDefensePanel } from './TacticalDefensePanel';
import { performSecurityAudit } from '../utils/audit';
import { calculatePasswordStrength } from '../utils/crypto';

interface VaultListProps {
  items: DecryptedVaultItem[];
  isLoading: boolean;
  remainingLockSeconds: number;
  lockTimeoutMinutes: number;
  onChangeLockTimeout: (mins: number) => void;
  onAddNew: () => void;
  onEditItem: (item: DecryptedVaultItem) => void;
  onDeleteItem: (id: string, title: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
  onCopyTotp: (code: string) => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
}

export const VaultList: React.FC<VaultListProps> = ({
  items,
  isLoading,
  remainingLockSeconds,
  lockTimeoutMinutes,
  onChangeLockTimeout,
  onAddNew,
  onEditItem,
  onDeleteItem,
  onToggleFavorite,
  onCopyUsername,
  onCopyPassword,
  onCopyTotp,
  onOpenGenerator,
  onOpenBackup
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('favorites_first');

  // 全局密码安全审计
  const audit = useMemo(() => performSecurityAudit(items), [items]);

  // 过滤条目
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      // 分类与特殊视图过滤
      let matchesCategory = true;
      if (selectedCategory === 'favorites') {
        matchesCategory = !!item.isFavorite;
      } else if (selectedCategory === 'risky') {
        matchesCategory = audit.riskyItemIds.includes(item.id);
      } else if (selectedCategory !== 'all') {
        matchesCategory = item.category === selectedCategory;
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
  }, [items, searchQuery, selectedCategory, sortBy, audit]);

  // 核心置顶凭据（优先选择第一个被用户加星置顶的凭据）
  const corePinnedItem = items.find((i) => i.isFavorite) || (items.length > 0 ? items[0] : null);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* 1. 左侧竖向分类与快捷索引 */}
      <Sidebar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        favoritesCount={audit.favoriteCount}
        riskyCount={audit.riskyItemIds.length}
      />

      {/* 2. 中部核心主监控看板与凭据列表 */}
      <section className="flex-1 min-w-0 w-full space-y-6">
        {/* 顶部保险库总览 HUD */}
        <VaultOverview
          totalItems={items.length}
          favoriteCount={audit.favoriteCount}
          weakCount={audit.weakCount}
          reusedCount={audit.reusedCount}
          healthScore={audit.healthScore}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* 核心置顶凭据展示区 (专业密码管理器设计) */}
        <div>
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
                  onClick={() => onCopyPassword(corePinnedItem.password)}
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
        <div>
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
                const isWeak = audit.weakItemIds.includes(item.id);
                const isReused = audit.reusedItemIds.includes(item.id);

                return (
                  <PasswordCard
                    key={item.id}
                    item={item}
                    indexNumber={numStr}
                    isWeak={isWeak}
                    isReused={isReused}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    onToggleFavorite={onToggleFavorite}
                    onCopyUsername={onCopyUsername}
                    onCopyPassword={onCopyPassword}
                    onCopyTotp={onCopyTotp}
                  />
                );
              })}

              {/* 空置录入槽位卡片 */}
              <EmptySlotCard
                slotNumber={(filteredItems.length + 1).toString().padStart(2, '0')}
                onClick={onAddNew}
              />
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

      {/* 3. 右侧安全审计与防御面板 */}
      <TacticalDefensePanel
        weakCount={audit.weakCount}
        reusedCount={audit.reusedCount}
        remainingLockSeconds={remainingLockSeconds}
        lockTimeoutMinutes={lockTimeoutMinutes}
        onChangeLockTimeout={onChangeLockTimeout}
        onOpenGenerator={onOpenGenerator}
        onOpenBackup={onOpenBackup}
        onFilterRisky={() => setSelectedCategory('risky')}
      />
    </div>
  );
};
