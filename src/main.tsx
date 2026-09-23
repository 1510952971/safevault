import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 注册离线 PWA Service Worker。
// Electron 桌面端使用 file:// 加载本地资源，Service Worker 的 Cache API 不支持该协议。
// 仅在 HTTP/HTTPS 页面启用，避免桌面端启动时产生未处理的缓存异常。
if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  (window.location.protocol === 'http:' || window.location.protocol === 'https:')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service Worker 注册忽略:', err);
    });
  });
}
