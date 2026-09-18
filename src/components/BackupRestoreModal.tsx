import React, { useState, useRef } from 'react';
import { X, Download, Upload, ShieldAlert, FileCheck, AlertTriangle } from 'lucide-react';
import { exportVaultBackup, parseAndValidateBackup } from '../utils/storage';
import { VaultBackupFile } from '../types/vault';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: (backup: VaultBackupFile) => void;
  onResetVaultConfirm: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
  onResetVaultConfirm
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'reset'>('backup');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      exportVaultBackup();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '导出备份失败');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setRestoreError('');
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedFile) {
      setRestoreError('请先选择 .safevault.json 备份文件');
      return;
    }

    try {
      setIsProcessing(true);
      setRestoreError('');
      const text = await selectedFile.text();
      const backup = parseAndValidateBackup(text);
      onRestoreSuccess(backup);
      onClose();
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : '解析备份文件失败');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative bg-white border border-slate-300 rounded-lg w-full max-w-md shadow-2xl p-6 overflow-hidden">
        {/* 四角刻度 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 头部 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="border-l-4 border-brand-lime pl-2.5">
            <h3 className="text-base font-bold text-slate-900">备份与数据恢复</h3>
            <span className="text-[10px] font-mono text-slate-400">DISASTER RECOVERY // NAS READY</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标签 */}
        <div className="flex border border-slate-200 rounded p-1 bg-slate-50 text-xs font-bold mb-4">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 py-1.5 rounded transition-colors ${
              activeTab === 'backup'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            导出密文备份
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-1.5 rounded transition-colors ${
              activeTab === 'restore'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            恢复备份文件
          </button>
          <button
            onClick={() => setActiveTab('reset')}
            className={`flex-1 py-1.5 rounded transition-colors ${
              activeTab === 'reset'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            重置金库
          </button>
        </div>

        <div className="text-xs">
          {activeTab === 'backup' && (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center mx-auto">
                <Download className="w-6 h-6" />
              </div>
              <p className="text-slate-600 leading-relaxed">
                备份文件保留您的端到端 AES-256 强加密结构（.safevault.json），不含任何明文密码，可安全备份至 NAS 或网盘。
              </p>
              <button
                onClick={handleExport}
                className="w-full flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all"
              >
                <div className="w-8 h-10 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                  <span className="text-sm font-mono">&gt;</span>
                </div>
                <span className="flex-1 font-bold">立即下载加密备份文件</span>
              </button>
            </div>
          )}

          {activeTab === 'restore' && (
            <div className="space-y-4 py-2">
              <p className="text-slate-600">
                导入后将替换当前的本地数据，并需要输入该备份原本的主密码进行解密。
              </p>

              {restoreError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.safevault.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-800 rounded p-6 text-center cursor-pointer transition-colors bg-slate-50"
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-slate-900 font-bold">
                    <FileCheck className="w-5 h-5 text-brand-lime" />
                    <span className="font-mono truncate">{selectedFile.name}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-slate-800 font-bold">点击选择 .safevault.json 备份</p>
                    <p className="text-slate-400 font-mono text-[10px]">VERIFIED BACKUP ONLY</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleExecuteRestore}
                disabled={!selectedFile || isProcessing}
                className="w-full flex items-center bg-slate-900 hover:bg-slate-800 text-white rounded overflow-hidden shadow-sm transition-all disabled:opacity-50"
              >
                <div className="w-8 h-10 bg-brand-lime flex items-center justify-center font-bold text-slate-900 shrink-0">
                  <span className="text-sm font-mono">&gt;</span>
                </div>
                <span className="flex-1 font-bold">
                  {isProcessing ? '校验并恢复中...' : '确认恢复此备份'}
                </span>
              </button>
            </div>
          )}

          {activeTab === 'reset' && (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <p className="text-slate-600">
                重置操作将彻底抹除本地存储中的所有密文数据和主密码。此操作不可逆！
              </p>
              <button
                onClick={() => {
                  if (window.confirm('警告：此操作将永久清空本地所有密码数据！是否确认重置？')) {
                    onResetVaultConfirm();
                    onClose();
                  }
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold transition-colors"
              >
                确认清空金库所有数据
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
