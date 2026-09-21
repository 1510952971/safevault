import React from 'react';
import { Clock, Cpu, HardDrive } from 'lucide-react';

interface TacticalDefensePanelProps {
  onOpenGenerator: () => void;
  onOpenBackup: () => void;
}

export const TacticalDefensePanel: React.FC<TacticalDefensePanelProps> = ({
  onOpenGenerator,
  onOpenBackup
}) => {
  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-tactical-sm">
        {/* 面板标题 (对齐参考图：| 升级到等级 2) */}
        <div className="border-l-4 border-brand-lime pl-2.5 mb-4">
          <h3 className="text-sm font-bold text-slate-900">升级到防卫等级 2</h3>
          <span className="text-[10px] font-mono text-slate-400">DEFENSE LEVEL 2 // READY</span>
        </div>

        {/* 强化条件列表 (对齐参考图：建立后天数 0/10，钢铁 0/200，原木 1/100) */}
        <div className="space-y-3 divide-y divide-slate-100 text-xs">
          {/* 日历: 自动锁屏 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>自动锁屏倒计时</span>
            </div>
            <span className="font-mono font-bold text-slate-800">03:00 / 03:00</span>
          </div>

          {/* 钢铁/算力: PBKDF2 轮数 */}
          <div className="flex items-center justify-between pt-2.5">
            <div className="flex items-center gap-2 text-slate-600">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>PBKDF2 算力拉伸</span>
            </div>
            <span className="font-mono font-bold text-slate-800">100,000 轮</span>
          </div>

          {/* 原木/介质: 离线密文备份 */}
          <div className="flex items-center justify-between pt-2.5">
            <div className="flex items-center gap-2 text-slate-600">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>离线密文备份包</span>
            </div>
            <span className="font-mono font-bold text-slate-800">就绪 (1/1)</span>
          </div>
        </div>

        {/* 战术推进按钮 (完全对齐设计图左侧带荧光绿色斜切块的“开始升级”按钮) */}
        <div className="mt-5 space-y-2.5">
          <button
            onClick={onOpenGenerator}
            className="w-full relative flex items-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded overflow-hidden transition-all group p-0 shadow-sm"
          >
            {/* 左侧斜切荧光黄色块 > */}
            <div className="w-9 h-11 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 px-3 text-left">
              <span className="text-xs font-bold text-slate-900 group-hover:text-slate-950 block">
                开始生成高熵密码
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">CSPRNG ENTROPY</span>
            </div>
          </button>

          <button
            onClick={onOpenBackup}
            className="w-full relative flex items-center bg-[#161922] hover:bg-slate-800 text-white rounded overflow-hidden transition-all group p-0 shadow-sm"
          >
            {/* 左侧斜切荧光黄色块 > */}
            <div className="w-9 h-11 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
              <span className="text-base font-mono">&gt;</span>
            </div>
            <div className="flex-1 px-3 text-left">
              <span className="text-xs font-bold text-white block">
                开始导出加密备份
              </span>
              <span className="text-[10px] text-slate-300 font-mono block">.SAFEVAULT.JSON</span>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};
