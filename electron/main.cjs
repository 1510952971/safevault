const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (!existingWindow) return;

    // 更新启动会把最新构建交给已存在的单实例进程，重启主进程以加载最新的 main.cjs 和 dist。
    // 普通重复启动仍只激活现有窗口，不会创建新的缓存进程。
    if (commandLine.includes('--safevault-refresh')) {
      app.relaunch({
        args: process.argv.slice(1).filter((arg) => arg !== '--safevault-refresh')
      });
      app.exit(0);
      return;
    }

    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
  });

  function createWindow() {
    const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'SafeVault 密码数据库 // 终端 #0027',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
    });

    // 移除原生菜单栏，保持赛博战术风格纯粹性
    Menu.setApplicationMenu(null);

    // 生产环境下直接载入本地静态包，开发环境可读取环境变量。
    // 本地文件使用 loadFile，避免 Windows 路径中的非 ASCII 字符被 file:// URL 拼接误处理。
    const startUrl = process.env.ELECTRON_START_URL;
    if (startUrl) {
      win.loadURL(startUrl);
    } else {
      win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    // 外部链接默认使用系统默认浏览器打开
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
