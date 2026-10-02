/**
 * SafeVault GitHub 版本更新检测引擎
 * 
 * 核心功能：
 * 1. 自动请求 GitHub Releases 开放接口；
 * 2. 语义化版本号（SemVer）比对；
 * 3. 提取更新日志、发版时间、以及 Windows 桌面端、安卓端与源码包下载链接。
 */

import packageInfo from '../../package.json';
import { Capacitor, registerPlugin } from '@capacitor/core';

export const CURRENT_APP_VERSION = `v${packageInfo.version}`;
export const DEFAULT_GITHUB_REPO = '1510952971/safevault';

interface SafeVaultUpdaterPlugin {
  installApk(options: { url: string; fileName?: string }): Promise<{
    started: boolean;
    message?: string;
  }>;
}

const SafeVaultUpdater = registerPlugin<SafeVaultUpdaterPlugin>('SafeVaultUpdater');

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

function openExternalDownload(asset: ReleaseAsset): void {
  if (typeof window === 'undefined') return;
  window.open(asset.downloadUrl, '_blank', 'noopener,noreferrer');
}

function isElectronRuntime(): boolean {
  return typeof navigator !== 'undefined' && /Electron\//i.test(navigator.userAgent);
}

function findAsset(assets: ReleaseAsset[], predicate: (asset: ReleaseAsset) => boolean): ReleaseAsset | undefined {
  return assets.find(predicate);
}

/**
 * 按运行平台开始更新：Android 由原生插件下载并交给系统安装器，桌面/NAS/iOS
 * 打开对应的官方安装包。任何平台都不修改 data 目录，也不把“版本显示变化”当作更新成功。
 */
export async function performSystemUpdate(
  targetVersion: string,
  assets: ReleaseAsset[] = []
): Promise<{ success: boolean; message: string; newVersion?: string }> {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    const apk = findAsset(assets, (asset) => asset.name.toLowerCase().endsWith('.apk'));
    if (!apk) return { success: false, message: `${targetVersion} 没有可用的 Android APK 安装包。` };
    try {
      const result = await SafeVaultUpdater.installApk({
        url: apk.downloadUrl,
        fileName: apk.name
      });
      return {
        success: Boolean(result?.started),
        newVersion: targetVersion,
        message: result?.message || '已下载 APK，正在打开系统安装确认。'
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Android APK 下载或安装启动失败。'
      };
    }
  }

  if (platform === 'ios') {
    const iosPackage = findAsset(assets, (asset) => /ios/i.test(asset.name));
    if (iosPackage) openExternalDownload(iosPackage);
    return {
      success: Boolean(iosPackage),
      newVersion: targetVersion,
      message: iosPackage
        ? '已打开 iOS 构建包下载。真机版本不能由 App 静默替换，请通过 TestFlight/App Store 安装；该 ZIP 仅用于 Xcode 模拟器。'
        : `${targetVersion} 没有可用的 iOS 构建包。`
    };
  }

  if (isElectronRuntime()) {
    const desktopPackage = findAsset(assets, (asset) => /windows.*\.zip$/i.test(asset.name));
    if (desktopPackage) openExternalDownload(desktopPackage);
    return {
      success: Boolean(desktopPackage),
      newVersion: targetVersion,
      message: desktopPackage
        ? '已开始下载 Windows 桌面安装包。下载完成后解压覆盖客户端目录，再运行“更新并启动桌面客户端.bat”重启；data 目录不要覆盖。'
        : `${targetVersion} 没有可用的 Windows 桌面安装包。`
    };
  }

  const nasPackage = findAsset(assets, (asset) => /nas.*\.zip$/i.test(asset.name));
  if (nasPackage) openExternalDownload(nasPackage);
  return {
    success: Boolean(nasPackage),
    newVersion: targetVersion,
    message: nasPackage
      ? '已开始下载 NAS 部署包。请仅替换 dist/server 和部署文件，保留 data 后重启容器。'
      : `${targetVersion} 没有可用的 NAS 部署包。`
  };
}
