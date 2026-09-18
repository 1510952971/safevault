import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastNotification } from '../types/vault';

interface ToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-slate-900 shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          info: <Info className="w-4 h-4 text-slate-700 shrink-0" />
        };

        const borderMap = {
          success: 'border-l-4 border-l-brand-lime border-slate-200 bg-white text-slate-900 shadow-tactical-md',
          error: 'border-l-4 border-l-rose-500 border-slate-200 bg-white text-slate-900 shadow-tactical-md',
          warning: 'border-l-4 border-l-amber-500 border-slate-200 bg-white text-slate-900 shadow-tactical-md',
          info: 'border-l-4 border-l-slate-700 border-slate-200 bg-white text-slate-900 shadow-tactical-md'
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded border ${borderMap[toast.type]} transition-all duration-300`}
          >
            <div className="flex items-center gap-2.5">
              {iconMap[toast.type]}
              <p className="text-xs font-semibold tracking-wide">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-2"
              aria-label="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
