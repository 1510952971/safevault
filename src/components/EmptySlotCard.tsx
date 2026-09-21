import React from 'react';
import { Plus } from 'lucide-react';

interface EmptySlotCardProps {
  slotNumber: string;
  onClick: () => void;
}

export const EmptySlotCard: React.FC<EmptySlotCardProps> = ({
  slotNumber,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className="relative bg-white/80 hover:bg-white border-2 border-dashed border-slate-300 hover:border-[#161922] rounded-lg p-6 flex flex-col items-center justify-center min-h-[170px] cursor-pointer transition-all duration-200 group shadow-tactical-sm hover:shadow-tactical-md"
    >
      {/* 左上角槽位编号 (如 02) */}
      <span className="absolute top-3 left-3 font-mono text-xs font-bold text-slate-400 group-hover:text-slate-800 transition-colors">
        {slotNumber}
      </span>

      {/* 中央大圆形建造加号 */}
      <div className="w-12 h-12 rounded-full border border-slate-300 group-hover:border-[#161922] flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:scale-105 transition-all mb-2">
        <Plus className="w-6 h-6" />
      </div>

      {/* 标题与副标 */}
      <h4 className="font-bold text-sm text-slate-800 group-hover:text-slate-950 transition-colors">
        空置凭据槽位
      </h4>
      <p className="text-xs text-slate-400 mt-0.5">
        点击录入新账号与密码
      </p>

      {/* 战术右下角折角标记 ┘ */}
      <div className="absolute bottom-2 right-2 text-slate-300 group-hover:text-slate-500 font-mono text-[10px] transition-colors">
        ┘
      </div>
    </div>
  );
};
