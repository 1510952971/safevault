/**
 * SafeVault GitHub 版本更新检测引擎
 * 
 * 核心功能：
 * 1. 自动请求 GitHub Releases 开放接口；
 * 2. 语义化版本号（SemVer）比对；
 * 3. 提取更新日志、发版时间、以及 Windows 桌面端、安卓端与源码包下载链接。
 */

import packageInfo from '../../package.json';

export const CURRENT_APP_VERSION = `v${packageInfo.version}`;
export const DEFAULT_GITHUB_REPO = '1510952971/safevault';

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
}

export interface ReleaseCheckResult {
  success: boolean;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  versionMismatch: boolean;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  htmlUrl?: string;
  assets?: ReleaseAsset[];
  message?: string;
}

/**
 * 语义化版本比对
 * 返回 1 (vA > vB), -1 (vA < vB), 0 (vA == vB)
 */
export function compareSemVer(vA: string, vB: string): number {
  const cleanA = vA.replace(/^v/i, '').trim();
  const cleanB = vB.replace(/^v/i, '').trim();

  const partsA = cleanA.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = cleanB.split('.').map(n => parseInt(n, 10) || 0);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * 检查 GitHub Releases 最新版本
 */
export async function checkForGitHubUpdate(
  repo: string = DEFAULT_GITHUB_REPO
): Promise<ReleaseCheckResult> {
  try {
    const cleanRepo = repo.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
    const versionUrl = `https://raw.githubusercontent.com/${cleanRepo}/main/package.json?ts=${Date.now()}`;
    const apiUrl = `https://api.github.com/repos/${cleanRepo}/releases/latest`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const versionRes = await fetch(versionUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!versionRes.ok) {
      clearTimeout(timeoutId);
      return {
        success: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
        hasUpdate: false,
        versionMismatch: false,
        message: `获取 GitHub 版本失败 (HTTP ${versionRes.status})`
      };
    }

    const remotePackage = await versionRes.json();
    const latestTag = `v${String(remotePackage.version || '').replace(/^v/i, '')}`;
    if (!remotePackage.version) throw new Error('GitHub package.json 未提供有效版本号');
    const comparison = compareSemVer(latestTag, CURRENT_APP_VERSION);

    // Release 是可选的，只补充更新日志和安装包；版本判断始终以 main/package.json 为准。
    const releaseRes = await fetch(apiUrl, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = releaseRes.ok ? await releaseRes.json() : null;

    const assets: ReleaseAsset[] = Array.isArray(data?.assets)
      ? data.assets.map((a: any) => ({
          name: a.name,
          downloadUrl: a.browser_download_url,
          size: a.size
        }))
      : [];

    return {
      success: true,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latestTag,
      hasUpdate: comparison > 0,
      versionMismatch: comparison !== 0,
      releaseName: data?.name || latestTag,
      releaseNotes: data?.body || 'GitHub 主分支已有不同版本，请更新对应客户端与 NAS 部署包。',
      publishedAt: data?.published_at,
      htmlUrl: data?.html_url || `https://github.com/${cleanRepo}`,
      assets
    };
  } catch (err: unknown) {
    return {
      success: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      hasUpdate: false,
      versionMismatch: false,
      message: err instanceof Error ? err.message : '网络通信失败或离线'
    };
  }
}

/**
 * 应用自身不能安全替换正在运行的 Electron 程序或 Docker 容器。
 * 返回明确的平台更新说明，避免把“修改显示版本”误报为真实升级。
 */
export async function performSystemUpdate(
  targetVersion: string,
  _downloadUrl?: string
): Promise<{ success: boolean; message: string; newVersion?: string }> {
  return {
    success: false,
    message: `已检测到 ${targetVersion}。桌面端请运行“更新并启动桌面客户端.bat”；极空间端请生成并覆盖最新部署包后重启容器。data 目录必须保留。`
  };
}
