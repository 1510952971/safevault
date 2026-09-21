import React, { useState, useMemo } from 'react';
import { Plus, ShieldAlert, KeyRound, Shield, CheckCircle2, ExternalLink } from 'lucide-react';
import { DecryptedVaultItem } from '../types/vault';
import { Sidebar } from './Sidebar';
import { VaultOverview } from './VaultOverview';
import { PasswordCard } from './PasswordCard';
import { EmptySlotCard } from './EmptySlotCard';
import { TacticalDefensePanel } from './TacticalDefensePanel';

interface VaultListProps {
  items: DecryptedVaultItem[];
  isLoading: boolean;
  onAddNew: () => void;
  onEditItem: (item: DecryptedVaultItem) => void;
  onDeleteItem: (id: string, title: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
}

export const VaultList: React.FC<VaultListProps> = ({
  items,
  isLoading,
  onAddNew,
  onEditItem,
  onDeleteItem,
  onCopyUsername,
  onCopyPassword,
  onOpenGenerator,
  onOpenBackup
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 过滤与排序
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        (item.website && item.website.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [items, searchQuery, selectedCategory]);

  // 核心置顶凭据（以列表首个条目或特定凭据作为核心设施展示）
  const coreItem = items.length > 0 ? items[0] : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* 1. 左侧机能战术竖向菜单栏 (完全对齐设计图：01 设施 / 02 防卫 ...) */}
      <Sidebar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* 2. 中部核心主监控看板与槽位区域 */}
      <section className="flex-1 min-w-0 w-full space-y-6">
        {/* 顶部设施总览 HUD (对齐设计图：等级 1/4、指标列、圆形雷达线) */}
        <VaultOverview
          totalItems={items.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* 核心设施展示区 (完全对齐参考图：| 核心设施 -> 城镇中心 核心设施 不可拆除) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
              <h3 className="text-sm font-bold text-slate-900">核心设施</h3>
              <span className="text-[10px] font-mono text-slate-400">// CORE FACILITY</span>
            </div>
          </div>

          {coreItem ? (
            <div className="relative bg-white border border-slate-200 rounded-lg p-4 shadow-tactical-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                {/* 战术微型基地建筑图标 */}
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-brand-lime shrink-0 shadow-sm">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-base text-slate-900">{coreItem.title}</h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-lime/20 text-slate-900 border border-brand-lime">
                      核心设施
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      AES强加密
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {coreItem.notes || '金库核心基准凭据，维系关键业务与主控账户的身份鉴权中枢。'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-700 font-bold">账号:</span> {coreItem.username}
                    </span>
                    <span className="w-1 h-3 bg-slate-200" />
                    <span>安全等级: 绝密</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => onCopyPassword(coreItem.password)}
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
                暂无核心设施，点击下方空槽位录入首个主密码凭据
              </p>
            </div>
          )}
        </div>

        {/* 扩建设施槽位列表 (完全对齐参考图：| 扩建设施 (1/2) 与 空槽位 [+] 建造卡片) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 border-l-4 border-brand-lime pl-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                扩建设施 ({filteredItems.length}/{Math.max(filteredItems.length + 1, 2)})
              </h3>
            </div>
            <button
              onClick={onAddNew}
              className="text-xs font-medium text-slate-700 hover:text-slate-950 flex items-center gap-1 font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>快速录入</span>
            </button>
          </div>

          {/* 骨架屏加载中 */}
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

          {/* 槽位卡片网格 + 建造空槽位卡片 */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 已录入凭据卡片 */}
              {filteredItems.map((item, idx) => {
                const numStr = (idx + 1).toString().padStart(2, '0');
                return (
                  <PasswordCard
                    key={item.id}
                    item={item}
                    indexNumber={numStr}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    onCopyUsername={onCopyUsername}
                    onCopyPassword={onCopyPassword}
                  />
                );
              })}

              {/* 空槽位 [+] 建造卡片 (完全对齐设计图：02 空槽位 [+] 选择设施进行建造) */}
              <EmptySlotCard
                slotNumber={(filteredItems.length + 1).toString().padStart(2, '0')}
                onClick={onAddNew}
              />
            </div>
          )}

          {/* 搜索无匹配状态 */}
          {!isLoading && items.length > 0 && filteredItems.length === 0 && (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 mb-1">未检索到匹配凭据</p>
              <p className="text-xs text-slate-400 mb-3">没有与 “{searchQuery}” 匹配的条目</p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs"
              >
                清除搜索
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3. 右侧防卫升级面板 (完全对齐设计图右侧：| 升级到等级 2 / 推进按钮) */}
      <TacticalDefensePanel
        onOpenGenerator={onOpenGenerator}
        onOpenBackup={onOpenBackup}
      />
    </div>
  );
};
