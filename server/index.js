/**
 * SafeVault 极空间 NAS 轻量同步服务端
 * 
 * 核心特性：
 * 1. 纯原生 Node.js 实现（零第三方外部依赖，内存占用 < 30MB，极速冷启）；
 * 2. 静态托管：无缝提供前端 Single Page App 静态文件及 SPA 路由重定向；
 * 3. 零知识密文同步 API：服务端仅存储认证摘要与客户端加密后的密文 Blob，主密码绝不上云；
 * 4. 原子持久化：数据安全存储于 /app/data/vault-store.json，支持掉电防丢与 Docker 卷映射。
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
const PORT = process.env.PORT || 8088;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'vault-store.json');
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'dist');
const SERVER_VERSION = '1.1.0';

// 确保持久化数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 内存数据库与持久化
let db = {
  users: {},
  sessions: {}
};

// 加载持久化数据
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      if (!db.users) db.users = {};
      if (!db.sessions) db.sessions = {};
      console.log(`[SafeVault DB] 成功载入数据，当前注册用户数: ${Object.keys(db.users).length}`);
    } catch (e) {
      console.error('[SafeVault DB] 载入数据库文件失败，将使用空库:', e);
    }
  } else {
    saveDatabase();
  }
}

// 原子写入持久化数据
function saveDatabase() {
  try {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (e) {
    console.error('[SafeVault DB] 持久化落盘失败:', e);
  }
}

loadDatabase();

// 简单的 Session 管理
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30天有效
  db.sessions[token] = { username, expiresAt };
  saveDatabase();
  return token;
}

function verifyToken(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-access-token']) {
    token = String(req.headers['x-access-token']).trim();
  }

  if (!token || !db.sessions[token]) return null;

  const session = db.sessions[token];
  if (session.expiresAt < Date.now()) {
    delete db.sessions[token];
    saveDatabase();
    return null;
  }
  return session.username;
}

// MIME 映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// 辅助工具：解析请求 JSON Body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 限制 50MB
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// 辅助工具：响应 JSON
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

// 处理静态文件
function serveStaticFile(req, res, pathname) {
  let filePath = path.join(STATIC_DIR, pathname);

  // 安全检查：防止目录穿越
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: 若不是具体静态文件，全部回退到 index.html
      const indexPath = path.join(STATIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('SafeVault 静态页面未编译或缺失，请在工程中运行 npm run build 后重新构建容器。');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexData);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutable = ext === '.js' || ext === '.css' || ext === '.woff2';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 全局 CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // --- API 路由分发 ---
  if (pathname.startsWith('/api/')) {
    try {
      // 1. 服务健康与版本
      if ((pathname === '/api/version' || pathname === '/api/health') && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          status: 'healthy',
          name: 'SafeVault NAS Sync Server',
          version: SERVER_VERSION,
          userCount: Object.keys(db.users).length,
          timestamp: new Date().toISOString()
        });
      }

      // 2. 账号注册 (零知识：仅接收 authHash 与 salt，绝无明文密码)
      if (pathname === '/api/auth/register' && req.method === 'POST') {
        const { username, authHash, salt } = await parseJsonBody(req);
        if (!username || !authHash || !salt) {
          return sendJson(res, 400, { success: false, message: '注册参数不完整 (username, authHash, salt 必填)' });
        }
        const cleanUser = String(username).trim().toLowerCase();
        if (cleanUser.length < 3) {
          return sendJson(res, 400, { success: false, message: '账号名称长度不得少于 3 个字符' });
        }
        if (db.users[cleanUser]) {
          return sendJson(res, 409, { success: false, message: '该账号已在极空间服务器中注册' });
        }

        const now = new Date().toISOString();
        db.users[cleanUser] = {
          username: cleanUser,
          authHash,
          salt,
          createdAt: now,
          updatedAt: now,
          vaultMeta: null,
          encryptedItems: [],
          version: 1
        };
        saveDatabase();

        const token = createSession(cleanUser);
        return sendJson(res, 200, {
          success: true,
          message: '极空间账号注册成功',
          token,
          username: cleanUser,
          salt
        });
      }

      // 3. 获取用户公开盐值 (用于多端登录时本地计算 AuthHash)
      if (pathname === '/api/auth/salt' && req.method === 'GET') {
        const username = reqUrl.searchParams.get('username') || '';
        const cleanUser = String(username).trim().toLowerCase();
        const user = db.users[cleanUser];
        if (!user) {
          return sendJson(res, 404, { success: false, message: '未找到该账号，请先注册' });
        }
        return sendJson(res, 200, {
          success: true,
          username: cleanUser,
          salt: user.salt
        });
      }

      // 4. 账号登录
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const { username, authHash } = await parseJsonBody(req);
        const cleanUser = String(username).trim().toLowerCase();
        const user = db.users[cleanUser];
        if (!user || user.authHash !== authHash) {
          return sendJson(res, 401, { success: false, message: '账号或密码认证摘要错误' });
        }

        const token = createSession(cleanUser);
        return sendJson(res, 200, {
          success: true,
          message: '登录极空间成功',
          token,
          username: cleanUser,
          salt: user.salt,
          version: user.version,
          updatedAt: user.updatedAt
        });
      }

      // 需要登录鉴权的路由
      const authUsername = verifyToken(req);
      if (!authUsername) {
        return sendJson(res, 401, { success: false, message: '身份凭证失效或未提供 Token，请重新登录' });
      }
      const currentUser = db.users[authUsername];

      // 5. 查询同步状态
      if (pathname === '/api/sync/status' && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          username: authUsername,
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          hasData: Boolean(currentUser.vaultMeta && currentUser.vaultMeta.testCipher),
          itemsCount: currentUser.encryptedItems.length
        });
      }

      // 6. 推送密文数据至云端 (Push)
      if (pathname === '/api/sync/push' && req.method === 'POST') {
        const { vaultMeta, encryptedItems, clientVersion, deviceName } = await parseJsonBody(req);
        if (!vaultMeta) {
          return sendJson(res, 400, { success: false, message: '推送数据必须包含 vaultMeta' });
        }

        currentUser.vaultMeta = vaultMeta;
        currentUser.encryptedItems = Array.isArray(encryptedItems) ? encryptedItems : [];
        currentUser.version = (currentUser.version || 0) + 1;
        currentUser.updatedAt = new Date().toISOString();
        saveDatabase();

        console.log(`[SafeVault Sync] 用户 [${authUsername}] 来自设备 [${deviceName || 'Unknown'}] 成功推送 ${currentUser.encryptedItems.length} 条加密凭据 (版本: v${currentUser.version})`);

        return sendJson(res, 200, {
          success: true,
          message: '已成功将加密金库同步至极空间',
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          itemsCount: currentUser.encryptedItems.length
        });
      }

      // 7. 从云端拉取密文数据 (Pull)
      if (pathname === '/api/sync/pull' && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          vaultMeta: currentUser.vaultMeta,
          encryptedItems: currentUser.encryptedItems || [],
          version: currentUser.version,
          updatedAt: currentUser.updatedAt
        });
      }

      return sendJson(res, 404, { success: false, message: 'API 接口不存在' });
    } catch (apiErr) {
      console.error('[SafeVault API Error]', apiErr);
      return sendJson(res, 500, { success: false, message: apiErr.message || '服务端内部异常' });
    }
  }

  // --- 静态文件服务 ---
  serveStaticFile(req, res, pathname);
});

// 监听启动
server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 SafeVault 极空间 NAS 同步中枢服务已启动`);
  console.log(`🌐 本地监听端口: http://0.0.0.0:${PORT}`);
  console.log(`📁 数据持久化路径: ${DB_FILE}`);
  console.log(`📦 前端静态资源目录: ${STATIC_DIR}`);
  console.log('====================================================');
});
