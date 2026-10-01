import React, { useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { CURRENT_APP_VERSION } from '../utils/updateChecker';
import { USER_MANUAL_SECTIONS } from '../content/userManual';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(USER_MANUAL_SECTIONS[0].id);

  const filteredSections = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return USER_MANUAL_SECTIONS;
    return USER_MANUAL_SECTIONS.filter((section) => JSON.stringify(section).toLowerCase().includes(keyword));
  }, [query]);

  if (!isOpen) return null;

  const scrollToSection = (id: string) => {
    setActiveId(id);
    document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-slate-950/55 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="user-manual-title">
      <div className="m-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[94vh] sm:rounded-lg sm:border sm:border-slate-200">
        <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-900 text-brand-lime">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="user-manual-title" className="truncate text-base font-bold text-slate-950 sm:text-lg">SafeVault 使用与运维说明手册</h2>
            <p className="text-[11px] text-slate-500">适用版本 {CURRENT_APP_VERSION} · 功能说明、更新、备份、恢复与故障排查</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="关闭说明手册" title="关闭说明手册">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="shrink-0 border-b border-slate-200 bg-slate-50 p-3 md:w-72 md:border-b-0 md:border-r md:p-4">
            <label className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 focus-within:border-slate-400">
              <Search className="h-4 w-4 shrink-0" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索功能、更新或恢复步骤" className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400" />
            </label>
            <div className="mt-3 flex max-h-28 gap-1 overflow-x-auto md:max-h-[calc(94vh-9rem)] md:flex-col md:overflow-y-auto md:overflow-x-hidden">
              {filteredSections.map((section) => (
                <button key={section.id} type="button" onClick={() => scrollToSection(section.id)} className={`shrink-0 rounded px-3 py-2 text-left text-xs transition-colors md:w-full ${activeId === section.id ? 'bg-slate-900 font-semibold text-white' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-950'}`}>
                  {section.title}
                </button>
              ))}
              {filteredSections.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">没有匹配章节</p>}
            </div>
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6 sm:px-8 md:px-10">
            <div className="mx-auto max-w-3xl">
              <p className="mb-8 border-l-4 border-brand-lime pl-4 text-sm leading-7 text-slate-600">
                本手册以 NAS 作为权威数据源的当前架构为准。正常使用只需登录同一账号，数据会自动同步；手动上传、合并与回滚仅用于迁移或恢复。
              </p>
              {filteredSections.map((section) => (
                <article key={section.id} id={`manual-${section.id}`} className="scroll-mt-6 border-b border-slate-200 pb-10 pt-2 last:border-b-0" onMouseEnter={() => setActiveId(section.id)}>
                  <h3 className="text-xl font-bold text-slate-950">{section.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{section.summary}</p>
                  <div className="mt-6 space-y-6">
                    {section.blocks.map((block, index) => (
                      <section key={`${section.id}-${index}`}>
                        {block.heading && <h4 className="mb-2 text-sm font-bold text-slate-900">{block.heading}</h4>}
                        {block.paragraphs?.map((paragraph) => <p key={paragraph} className="mb-2 text-sm leading-7 text-slate-700">{paragraph}</p>)}
                        {block.steps && (
                          <ol className="space-y-2 pl-5 text-sm leading-7 text-slate-700">
                            {block.steps.map((step) => <li key={step} className="list-decimal pl-1">{step}</li>)}
                          </ol>
                        )}
                        {block.bullets && (
                          <ul className="space-y-2 pl-5 text-sm leading-7 text-slate-700">
                            {block.bullets.map((bullet) => <li key={bullet} className="list-disc pl-1">{bullet}</li>)}
                          </ul>
                        )}
                        {block.warning && <p className="mt-3 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-950"><strong>注意：</strong>{block.warning}</p>}
                      </section>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
