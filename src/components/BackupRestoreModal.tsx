import React, { useState, useRef } from 'react';
import { X, Download, Upload, ShieldAlert, FileCheck, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { exportVaultBackup, parseAndValidateBackup, parseCsvPasswords, exportVaultAsCsv } from '../utils/storage';
import { VaultBackupFile, DecryptedVaultItem } from '../types/vault';

interface BackupRestoreModalProps {
  isOpen: boolean;
  items: DecryptedVaultItem[];
  onClose: () => void;
  onRestoreSuccess: (backup: VaultBackupFile) => void;
  onBatchImportCsv: (importedItems: Array<Omit<DecryptedVaultItem, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  onResetVaultConfirm: () => void;
  onVerifyMasterPassword?: (password: string) => Promise<boolean>;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  items,
  onClose,
  onRestoreSuccess,
  onBatchImportCsv,
  onResetVaultConfirm,
  onVerifyMasterPassword
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'csv' | 'reset'>('backup');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // 敏感操作二次核验主密码状态
  const [pendingExportType, setPendingExportType] = useState<'json' | 'csv' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);

  if (!isOpen) return null;

  const handleExportJson = () => {
    if (onVerifyMasterPassword) {
      setPendingExportType('json');
      setAuthPassword('');
      setAuthError('');
    } else {
      try {
        exportVaultBackup();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : '导出备份失败');
      }
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) {
      alert('当前保险箱无任何凭据，无需导出 CSV');
      return;
    }
    if (onVerifyMasterPassword) {
      setPendingExportType('csv');
      setAuthPassword('');
      setAuthError('');
    } else {
      if (window.confirm('安全提醒：CSV 文件包含明文密码！请在受信任设备上妥善保存。是否继续导出？')) {
        exportVaultAsCsv(items);
      }
    }
  };

  const handleConfirmExportWithAuth = async () => {
    if (!authPassword) {
      setAuthError('请输入主密码');
      return;
    }

    if (onVerifyMasterPassword) {
      setIsVerifyingAuth(true);
      setAuthError('');
      try {
        const ok = await onVerifyMasterPassword(authPassword);
        if (!ok) {
          setAuthError('主密码核验失败，操作已拒绝');
          setIsVerifyingAuth(false);
          return;
        }
      } catch (_e) {
        setAuthError('核验异常，请稍后重试');
        setIsVerifyingAuth(false);
        return;
      }
      setIsVerifyingAuth(false);
    }

    const type = pendingExportType;
    setPendingExportType(null);
    setAuthPassword('');

    if (type === 'json') {
      try {
        exportVaultBackup();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : '导出备份失败');
      }
    } else if (type === 'csv') {
      exportVaultAsCsv(items);
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedFile) {
      setErrorMessage('请先选择 .safevault.json 备份文件');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage('');
      const text = await selectedFile.text();
      const backup = parseAndValidateBackup(text);
      onRestoreSuccess(backup);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : '解析备份文件失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage('');
      const text = await file.text();
      const imported = parseCsvPasswords(text);
      if (imported.length === 0) {
        throw new Error('未在 CSV 文件中识别到有效密码行');
      }

      if (window.confirm(`解析成功！共识别到 ${imported.length} 条账号密码凭据，是否确认全部加密导入金库？`)) {
        await onBatchImportCsv(imported);
        onClose();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'CSV 解析导入失败，请检查文件格式');
    } finally {
      setIsProcessing(false);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="relative bg-white border border-slate-300 rounded-lg w-full max-w-lg shadow-2xl p-6 overflow-hidden">
        {/* 四角刻度 */}
        <div className="absolute top-2 left-2 text-slate-300 font-mono text-xs">┌</div>
        <div className="absolute top-2 right-2 text-slate-300 font-mono text-xs">┐</div>
        <div className="absolute bottom-2 left-2 text-slate-300 font-mono text-xs">└</div>
        <div className="absolute bottom-2 right-2 text-slate-300 font-mono text-xs">┘</div>

        {/* 头部 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="border-l-4 border-brand-lime pl-2.5">
            <h3 className="text-base font-bold text-slate-900">数据流转与灾备恢复</h3>
            <span className="text-[10px] font-mono text-slate-400">BACKUP & DATA PORTABILITY</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标签 */}
        <div className="grid grid-cols-4 gap-1 border border-slate-200 rounded p-1 bg-slate-50 text-xs font-bold mb-4">
          <button
            onClick={() => { setActiveTab('backup'); setErrorMessage(''); }}
            className={`py-1.5 rounded text-center transition-colors ${
              activeTab === 'backup'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            导出备份
          </button>
          <button
            onClick={() => { setActiveTab('restore'); setErrorMessage(''); }}
            className={`py-1.5 rounded text-center transition-colors ${
              activeTab === 'restore'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            恢复备份
          </button>
          <button
            onClick={() => { setActiveTab('csv'); setErrorMessage(''); }}
            className={`py-1.5 rounded text-center transition-colors ${
              activeTab === 'csv'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            CSV 导入
          </button>
          <button
            onClick={() => { setActiveTab('reset'); setErrorMessage(''); }}
            className={`py-1.5 rounded text-center transition-colors ${
              activeTab === 'reset'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            重置金库
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="text-xs">
          {/* 1. 导出备份 */}
          {activeTab === 'backup' && (
            <div className="space-y-4 py-1">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Download className="w-4 h-4 text-brand-lime" />
                  <span>选项 A：AES-256 密文备份 (.safevault.json)</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  端到端高强度密文包，完全不含明文，专为家庭 NAS、网盘或异地备份设计。
                </p>
                <button
                  onClick={handleExportJson}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>立即导出密文备份</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                  <span>选项 B：标准 CSV 表格导出 (.csv)</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  通用明文表格，便于打印封存或导入其他密码管理器。请妥善保管防泄露。
                </p>
                <button
                  onClick={handleExportCsv}
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700" />
                  <span>导出明文 CSV 表格</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. 恢复备份 */}
          {activeTab === 'restore' && (
            <div className="space-y-4 py-2">
              <p className="text-slate-600 leading-relaxed">
                导入后将替换当前的本地数据，并需要输入该备份原本的主密码进行解密验证。
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.safevault.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setErrorMessage('');
                  }
                }}
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
                    <p className="text-slate-800 font-bold">点击选择 .safevault.json 备份文件</p>
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

          {/* 3. CSV 批量导入 */}
          {activeTab === 'csv' && (
            <div className="space-y-4 py-2">
              <p className="text-slate-600 leading-relaxed">
                支持直接导入从 <strong>Chrome / Edge / Firefox / Bitwarden</strong> 导出的密码 CSV 文件。系统将即时逐条完成 AES-256 强加密入库。
              </p>

              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleExecuteCsvImport}
                className="hidden"
              />

              <div
                onClick={() => csvFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-800 rounded p-6 text-center cursor-pointer transition-colors bg-slate-50"
              >
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-800 font-bold">点击选择浏览器导出的 .csv 文件</p>
                <p className="text-slate-400 font-mono text-[10px] mt-1">CHROME / EDGE / BITWARDEN COMPATIBLE</p>
              </div>

              <p className="text-[11px] text-slate-400 font-mono text-center">
                * 建议导入完成后，立即在电脑上永久删除该明文 CSV 文件以确保安全。
              </p>
            </div>
          )}

          {/* 4. 重置金库 */}
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

        {/* 敏感操作二次核验主密码浮层 */}
        {pendingExportType && (
          <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm p-6 flex flex-col justify-center items-center">
            <div className="w-full max-w-sm bg-white border border-slate-300 rounded-xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-slate-800">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">敏感操作：身份二次核验</h4>
                  <p className="text-[11px] text-slate-500">
                    导出 {pendingExportType === 'json' ? '全量加密备份 (.json)' : '明文 CSV 密码表 (.csv)'} 前需核验主密码
                  </p>
                </div>
              </div>

              {authError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-600 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">主密码</label>
                <input
                  type="password"
                  autoFocus
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmExportWithAuth();
                    }
                  }}
                  placeholder="请输入主密码以确认操作..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-slate-800 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendingExportType(null);
                    setAuthPassword('');
                    setAuthError('');
                  }}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded text-xs font-medium hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isVerifyingAuth || !authPassword}
                  onClick={handleConfirmExportWithAuth}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-brand-lime font-bold rounded text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isVerifyingAuth ? '核验中...' : '确认核验并导出'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
