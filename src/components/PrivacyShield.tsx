import React from 'react';
import { EyeOff, ShieldCheck, Lock, Shield } from 'lucide-react';

interface PrivacyShieldProps {
  isActive: boolean;
  onResume: () => void;
}

export const PrivacyShield: React.FC<PrivacyShieldProps> = ({ isActive, onResume }) => {
  if (!isActive) return null;

  return (
    <div
      onClick={onResume}
      className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-2xl flex flex-col items-center justify-center p-6 select-none transition-all duration-300 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-sm w-full bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4 backdrop-blur-md"
      >
        {/* 顶部四角战术标 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 护盾与雷达波纹图标 */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-[#161922] text-brand-lime flex items-center justify-center shadow-lg border border-slate-800">
          <EyeOff className="w-8 h-8 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white ring-2 ring-emerald-400/40" />
        </div>

        {/* 标题 */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-brand-lime rounded-full inline-block" />
            <span>SAFEVAULT // PRIVACY SHIELD</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            防肩窥隐私幕布已激活
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed font-mono">
            检测到当前窗口失焦或已切换至后台。为防止凭据遭到旁人窥视或投屏录制泄露，界面已自动完成高斯模糊遮蔽。
          </p>
        </div>

        {/* 唤醒恢复按钮 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-brand-lime font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 group"
          >
            <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>点击恢复正常浏览 // RESUME</span>
          </button>
          <p className="text-[10px] font-mono text-slate-400 mt-2">
            * 亦可直接点击遮罩空白区域或按任意键退出防窥
          </p>
        </div>
      </div>
    </div>
  );
};
