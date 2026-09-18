import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Edit3,
  Trash2,
  FileText,
  Globe,
  Briefcase,
  CreditCard,
  MessageCircle,
  Gamepad2,
  Key
} from 'lucide-react';
import { DecryptedVaultItem, CategoryType } from '../types/vault';
import { getCategoryMeta } from '../utils/storage';

interface PasswordCardProps {
  item: DecryptedVaultItem;
  indexNumber: string; // 如 "01", "02"
  onEdit: (item: DecryptedVaultItem) => void;
  onDelete: (id: string, title: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
}

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  website: <Globe className="w-3.5 h-3.5" />,
  work: <Briefcase className="w-3.5 h-3.5" />,
  finance: <CreditCard className="w-3.5 h-3.5" />,
  social: <MessageCircle className="w-3.5 h-3.5" />,
  game: <Gamepad2 className="w-3.5 h-3.5" />,
  other: <Key className="w-3.5 h-3.5" />
};

export const PasswordCard: React.FC<PasswordCardProps> = ({
  item,
  indexNumber,
  onEdit,
  onDelete,
  onCopyUsername,
  onCopyPassword
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const meta = getCategoryMeta(item.category);

  return (
    <div className="relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-4 transition-all duration-200 shadow-tactical-sm hover:shadow-tactical-md flex flex-col justify-between group">
      {/* 战术微切角装饰标线 */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-slate-300"></div>

      <div>
        {/* 卡片顶栏：槽位编号、标题、运行状态 */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {indexNumber}
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight group-hover:text-slate-950">
                {item.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  {CATEGORY_ICONS[item.category]}
                  <span>{meta.label}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-lime/20 border border-brand-lime/50 text-[10px] font-semibold text-slate-800 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime inline-block"></span>
              <span>已加密</span>
            </span>

            {item.website && (
              <a
                href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                title="访问网站"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="编辑凭据"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(item.id, item.title)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
              title="删除凭据"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 凭据信息行 */}
        <div className="space-y-2 bg-slate-50/80 border border-slate-100 rounded p-2.5">
          {/* 账号 */}
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                ACCOUNT // 账号
              </span>
              <p className="text-xs font-medium text-slate-800 truncate select-all">
                {item.username || '(未填写账号)'}
              </p>
            </div>
            {item.username && (
              <button
                onClick={() => onCopyUsername(item.username)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded transition-colors shrink-0"
                title="复制账号"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 密码 (脱敏防窥) */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
            <div className="min-w-0 flex-1 pr-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                CIPHER // 密码凭据
              </span>
              <p className="text-xs font-mono font-medium text-slate-900 truncate">
                {showPassword ? item.password : '••••••••••••'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded transition-colors"
                title={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-800" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onCopyPassword(item.password)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded transition-colors"
                title="安全复制密码 (30秒后清空)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 底部备注与战术元数据 */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          {item.notes ? (
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800"
            >
              <FileText className="w-3 h-3 text-brand-lime/80" />
              <span>{showNotes ? '收起备注' : '私密备注'}</span>
            </button>
          ) : (
            <span className="text-slate-400 font-mono">ID: {item.id.slice(0, 8)}</span>
          )}
        </div>
        <span className="font-mono text-[10px]">
          UP: {new Date(item.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* 展开的私密备注内容 */}
      {showNotes && item.notes && (
        <div className="mt-2 p-2 bg-slate-100 border border-slate-200 rounded text-xs text-slate-700 whitespace-pre-wrap">
          {item.notes}
        </div>
      )}
    </div>
  );
};
