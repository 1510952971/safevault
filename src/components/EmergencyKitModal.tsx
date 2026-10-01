import React, { useRef } from 'react';
import { X, Printer, Download, ShieldAlert, Terminal, ShieldCheck, Key, FileText, AlertTriangle } from 'lucide-react';
import { VaultMeta } from '../types/vault';

interface EmergencyKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultMeta: VaultMeta | null;
  totalItemsCount: number;
}

export const EmergencyKitModal: React.FC<EmergencyKitModalProps> = ({
  isOpen,
  onClose,
  vaultMeta,
  totalItemsCount
}) => {
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const createdAtFormatted = vaultMeta?.createdAt
    ? new Date(vaultMeta.createdAt).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>SafeVault 应急救援卡</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px; margin: 0; }
    .card { max-width: 720px; margin: 0 auto; background: white; border: 2px solid #0f172a; border-radius: 12px; padding: 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-family: monospace; font-size: 11px; color: #64748b; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 12px; margin-bottom: 24px; }
    .meta-item b { display: block; font-size: 10px; color: #64748b; font-family: monospace; }
    .warning-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #9f1239; margin-bottom: 24px; }
    .handwriting-zone { border: 2px dashed #94a3b8; border-radius: 8px; padding: 24px; background: #f8fafc; margin-bottom: 24px; }
    .handwriting-title { font-weight: 700; font-size: 13px; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; }
    .handwriting-lines { border-bottom: 1px dashed #cbd5e1; height: 36px; margin-top: 12px; }
    .instructions { font-size: 12px; color: #475569; line-height: 1.6; }
    .instructions ol { padding-left: 20px; margin: 8px 0; }
    .footer { border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; font-family: monospace; }
    @media print { body { background: white; padding: 0; } .card { box-shadow: none; border: 1px solid #000; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1 class="title">SafeVault 离线应急救援凭证</h1>
        <div class="subtitle">OFFLINE EMERGENCY RECOVERY KIT // ZERO-KNOWLEDGE</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><b>CREATED AT // 初始建档时间</b>${createdAtFormatted}</div>
      <div class="meta-item"><b>CREDENTIALS // 当前凭据体量</b>${totalItemsCount} 项</div>
    </div>

    <div class="warning-box">
      <strong>⚠️ 绝密离线凭证使用准则：</strong>
      由于 SafeVault 采用纯前端零知识加密（PBKDF2 100,000 轮 + AES-GCM-256），主密码绝不上传任何服务器。若遗忘主密码且未备份，数据将永久不可恢复。请将本页妥善存放于实体保险箱中。
    </div>

    <div class="handwriting-zone">
      <div class="handwriting-title">
        <span>主密码 / 助记提示手写留存区 (MASTER PASSWORD HINT)</span>
        <span style="font-size: 11px; color: #64748b; font-weight: normal;">建议打印后使用铅笔亲笔抄录</span>
      </div>
      <div class="handwriting-lines"></div>
      <div class="handwriting-lines"></div>
    </div>

    <div class="instructions">
      <strong>如何使用本单据执行灾难恢复：</strong>
      <ol>
        <li>在任何离线或离场电脑的现代浏览器中打开 SafeVault 程序。</li>
        <li>点击「导入备份恢复」，载入您的 <code>.safevault.json</code> 密文备份文件。</li>
        <li>输入上方您亲笔手写的主密码，系统将全自动瞬时解密还原您的全部账号凭据。</li>
      </ol>
    </div>

    <div class="footer">
      SAFEVAULT DEFENSE OS // CONFIDENTIAL AND PROPRIETARY // GENERATED: ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SafeVault_Emergency_Kit_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white border border-slate-300 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden my-6">
        {/* 操作顶栏 (打印时自动隐藏) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#161922] text-brand-lime flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">离线应急救援单预览</h3>
              <p className="text-[10px] font-mono text-slate-400">EMERGENCY RECOVERY KIT PREVIEW</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-brand-lime font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
              title="直接调用系统打印机打印本页"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>打印纸质救援单</span>
            </button>
            <button
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded transition-colors flex items-center gap-1.5 shadow-sm"
              title="下载为单文件独立 HTML 救援文件"
            >
              <Download className="w-3.5 h-3.5" />
              <span>保存 HTML 救援卡</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 救援卡主体 (自适应 A4 打印区域) */}
        <div ref={printableRef} className="p-6 sm:p-8 space-y-6 text-slate-900 bg-white">
          {/* 卡片头部 */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#161922] text-brand-lime flex items-center justify-center font-bold">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">SafeVault 离线应急救援单</h1>
                <div className="text-[10px] font-mono text-slate-500 font-semibold tracking-wider">
                  EMERGENCY RECOVERY SHEET // ZERO-KNOWLEDGE VAULT
                </div>
              </div>
            </div>
          </div>

          {/* 金库关键参数格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">建档时间 / CREATED AT</span>
              <span className="font-bold text-slate-800">{createdAtFormatted}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">当前密码条目 / ITEMS</span>
              <span className="font-bold text-slate-800">{totalItemsCount} 项凭据已加密入库</span>
            </div>
          </div>

          {/* 红色防范警告 */}
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>绝密凭证保管准则：</strong>
              SafeVault 采用客户端零知识端到端加密体系，不设任何云端明文备份。<strong>若遗失主密码且无法回忆，任何机构均无法找回数据！</strong>
              建议打印本单据后，在下方手写留存并存放于实体保险箱或抽屉等私密物理空间。
            </div>
          </div>

          {/* 手写主密码专属框 */}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Key className="w-4 h-4 text-slate-600" />
                <span>主密码备忘亲笔手写区 (MASTER PASSWORD MANUAL RECORD)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">建议使用铅笔手写记录</span>
            </div>

            <div className="pt-2 space-y-4">
              <div className="border-b border-dashed border-slate-300 h-8 flex items-end pb-1 text-xs font-mono text-slate-400">
                主密码或提示词线索 (Hint)：
              </div>
              <div className="border-b border-dashed border-slate-300 h-8 flex items-end pb-1 text-xs font-mono text-slate-400">
                二级独立安全 PIN 备忘 (Optional)：
              </div>
            </div>
          </div>

          {/* 灾备恢复说明 */}
          <div className="space-y-2 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>灾难恢复与跨设备迁移操作指南</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed font-mono pl-1">
              <li>若更换新电脑或清空了浏览器缓存，打开 SafeVault 后点击「导入备份恢复」；</li>
              <li>载入您离线保存的 <code>.safevault.json</code> 密文备份文件；</li>
              <li>输入上方手写记录的正确主密码，系统即可瞬时完整恢复全量凭据库。</li>
            </ol>
          </div>

          {/* 水印底栏 */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>SECURE VAULT ARCHITECTURE // PBKDF2-100K // AES-GCM-256</span>
            <span>SAFEVAULT DEFENSE SYSTEM</span>
          </div>
        </div>
      </div>
    </div>
  );
};
