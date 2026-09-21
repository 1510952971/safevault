import React, { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
  Download,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Server,
  Sparkles,
  FileCode,
  Smartphone,
  Monitor
} from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  DEFAULT_GITHUB_REPO,
  checkForGitHubUpdate,
  ReleaseCheckResult
} from '../utils/updateChecker';

interface UpdateCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateCheckModal: React.FC<UpdateCheckModalProps> = ({
  isOpen,
  onClose
}) => {
  const [repo, setRepo] = useState(DEFAULT_GITHUB_REPO);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ReleaseCheckResult | null>(null);

  const handleCheck = async (targetRepo = repo) => {
    setIsChecking(true);
    try {
      const res = await checkForGitHubUpdate(targetRepo);
      setResult(res);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                GitHub 程序版本更新中枢
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded">
                  {CURRENT_APP_VERSION}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                REPO // {repo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          
          {/* 版本对比看板 */}
          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">当前本地/容器版本</span>
              <span className="text-base font-bold font-mono text-slate-100">{CURRENT_APP_VERSION}</span>
            </div>
            <div className="text-center px-4">
              <span className="text-slate-600 font-mono text-xs">➔</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">GitHub 最新发布版本</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {isChecking ? '正在检测...' : (result?.latestVersion || CURRENT_APP_VERSION)}
              </span>
            </div>
            <div>
              <button
                onClick={() => handleCheck()}
                disabled={isChecking}
                className="p-2 text-slate-400 hover:text-white bg-slate-700/60 hover:bg-slate-700 rounded border border-slate-600 transition-colors disabled:opacity-50"
                title="重新检查"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* 状态徽章 */}
          {result && (
            <div>
              {result.hasUpdate ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-600/50 rounded-lg flex items-center justify-between text-emerald-200">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>检测到全新发布版本 {result.latestVersion}！</span>
                  </div>
                  {result.htmlUrl && (
                    <a
                      href={result.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <span>前往 GitHub Releases</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-800/40 border border-slate-700/80 rounded-lg flex items-center gap-2 text-slate-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>当前金库与客户端已是最新版本，无需更新。</span>
                </div>
              )}
            </div>
          )}

          {/* 更新日志 */}
          {result?.releaseNotes && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                发布更新日志 // CHANGELOG
              </label>
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {result.releaseNotes}
              </div>
            </div>
          )}

          {/* 客户端与安装包直接下载 */}
          {result?.assets && result.assets.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                跨端客户端安装包下载 // ASSETS
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.assets.map((asset, idx) => (
                  <a
                    key={idx}
                    href={asset.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors text-slate-200"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      {asset.name.endsWith('.exe') ? (
                        <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : asset.name.endsWith('.apk') ? (
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate text-[11px] font-mono">{asset.name}</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 极空间 NAS Docker 容器更新指引 */}
          <div className="p-3.5 bg-slate-800/30 border border-slate-700/60 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>极空间 NAS 容器无损更新指南</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed font-mono">
              <li>打开极空间客户端 ➔ 进入「Docker」应用 ➔ 点击「镜像库」拉取最新镜像；</li>
              <li>在「容器」列表中找到 <code className="text-slate-300">safevault-nas</code>，点击停止；</li>
              <li>点击「更多」➔ 选择「重置/更新容器」即可完成秒级升级；</li>
              <li><strong className="text-emerald-400">零丢数据保障</strong>：所有密码库密文保存在已映射的极空间文件夹中，更新镜像绝不丢失任何数据！</li>
            </ol>
          </div>

        </div>

        {/* 底部 */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>SOURCE // GITHUB OPEN ECOSYSTEM</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
