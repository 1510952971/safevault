import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Edit3,
  Trash2,
  FileText,
  Star,
  Globe,
  Briefcase,
  CreditCard,
  MessageCircle,
  Gamepad2,
  Key,
  ShieldAlert,
  ShieldCheck,
  Timer
} from 'lucide-react';
import { DecryptedVaultItem, CategoryType } from '../types/vault';
import { getCategoryMeta } from '../utils/storage';
import { calculatePasswordStrength } from '../utils/crypto';
import { generateTotpCode, isValidTotpSecret } from '../utils/totp';

interface PasswordCardProps {
  item: DecryptedVaultItem;
  indexNumber: string;
  isWeak?: boolean;
  isReused?: boolean;
  onEdit: (item: DecryptedVaultItem) => void;
  onDelete: (id: string, title: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopyUsername: (username: string) => void;
  onCopyPassword: (password: string) => void;
  onCopyTotp?: (code: string) => void;
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
  isWeak = false,
  isReused = false,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopyUsername,
  onCopyPassword,
  onCopyTotp
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [totpData, setTotpData] = useState<{ code: string; secondsRemaining: number } | null>(null);

  const meta = getCategoryMeta(item.category);
  const strength = calculatePasswordStrength(item.password);

  // TOTP 动态口令轮询刷新
  useEffect(() => {
    if (!item.totpSecret || !isValidTotpSecret(item.totpSecret)) {
      setTotpData(null);
      return;
    }

    let isMounted = true;

    const updateTotp = async () => {
      try {
        const res = await generateTotpCode(item.totpSecret!);
        if (isMounted) {
          setTotpData({ code: res.code, secondsRemaining: res.secondsRemaining });
        }
      } catch (_e) {
        if (isMounted) setTotpData(null);
      }
    };

    updateTotp();
    const interval = setInterval(updateTotp, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [item.totpSecret]);

  return (
    <div className={`relative bg-white border ${
      item.isFavorite ? 'border-amber-400 shadow-sm' : 'border-slate-200'
    } hover:border-slate-300 rounded-lg p-4 transition-all duration-200 shadow-tactical-sm hover:shadow-tactical-md flex flex-col justify-between group`}>
      {/* 战术微切角装饰标线 */}
      <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${
        item.isFavorite ? 'border-amber-400' : 'border-slate-300'
      }`} />

      <div>
        {/* 卡片顶栏：置顶星标、槽位编号、标题、操作按钮 */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {/* 置顶切换按钮 */}
            <button
              onClick={() => onToggleFavorite(item.id)}
              className="p-1 text-slate-300 hover:text-amber-500 rounded transition-colors"
              title={item.isFavorite ? '取消核心置顶' : '设为核心置顶'}
            >
              <Star
                className={`w-4 h-4 ${
                  item.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                }`}
              />
            </button>

            <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {indexNumber}
            </span>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight group-hover:text-slate-950">
                  {item.title}
                </h3>
                {item.isFavorite && (
                  <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-300 text-[10px] font-bold rounded">
                    核心置顶
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  {CATEGORY_ICONS[item.category]}
                  <span>{meta.label}</span>
                </span>
                {/* 风险标 */}
                {isWeak && (
                  <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded font-semibold">
                    弱密码
                  </span>
                )}
                {isReused && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                    重复使用
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {item.website && (
              <a
                href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                title="在新标签页访问官网"
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
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  CIPHER // 密码
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${strength.colorClass}`} title={`强度: ${strength.label}`} />
              </div>
              <p className="text-xs font-mono font-medium text-slate-900 truncate mt-0.5">
                {showPassword ? item.password : '••••••••••••'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded transition-colors"
                title={showPassword ? '隐藏明文' : '显示明文'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5 text-slate-800" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onCopyPassword(item.password)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded transition-colors"
                title="安全复制密码 (30秒后自动清空剪贴板)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TOTP 2FA 动态双重验证码展示区 (若配置了 2FA) */}
          {totpData && (
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 bg-brand-lime/10 px-2 py-1.5 rounded">
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-600">
                  <Timer className="w-3 h-3 text-slate-700 animate-spin" />
                  <span>2FA 动态验证码 ({totpData.secondsRemaining}s)</span>
                </div>
                <p className="text-sm font-mono font-extrabold tracking-widest text-slate-900 mt-0.5">
                  {totpData.code.slice(0, 3)} {totpData.code.slice(3)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onCopyTotp && onCopyTotp(totpData.code)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-mono font-bold transition-colors shrink-0 flex items-center gap-1 shadow-sm"
                title="复制 6 位动态验证码"
              >
                <Copy className="w-3 h-3" />
                <span>复制验证码</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部备注与元数据 */}
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
            <span className="text-slate-400 font-mono">AES-256</span>
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
