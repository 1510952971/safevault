const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    title: 'SafeVault 个人密码保险箱 // 终端 #0027',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 移除原生菜单栏，保持赛博战术风格纯粹性
  Menu.setApplicationMenu(null);

  // 生产环境下直接载入本地静态包，开发环境可读取环境变量
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;
  win.loadURL(startUrl);

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
