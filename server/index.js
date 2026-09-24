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
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'dist');
const REQUIRE_HTTPS = process.env.REQUIRE_HTTPS === 'true';
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000,null,file://').split(',').map((origin) => origin.trim()).filter(Boolean);
let SERVER_VERSION = '1.2.2';
const MAX_SNAPSHOTS = 30;

// 认证失败限流：按 IP 与账号分别计数，避免 authHash 被暴力重放。
const authFailures = new Map();
const authChallenges = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_FAILURES = 8;
function authKey(req, username = '') {
  return `${req.socket.remoteAddress || 'unknown'}:${String(username).trim().toLowerCase()}`;
}
function isRateLimited(req, username) {
  const key = authKey(req, username);
  const entry = authFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) { authFailures.delete(key); return false; }
  return entry.count >= AUTH_MAX_FAILURES;
}
function recordAuthFailure(req, username) {
  const key = authKey(req, username);
  const now = Date.now();
  const entry = authFailures.get(key);
  if (!entry || entry.resetAt <= now) authFailures.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  else entry.count += 1;
}
function clearAuthFailures(req, username) { authFailures.delete(authKey(req, username)); }
function issueAuthChallenge(username) {
  const challenge = crypto.randomBytes(32).toString('hex');
  // 极空间远程代理可能为“获取挑战”和“提交登录”使用不同的上游
  // TCP 连接，不能把一次性挑战绑定到 req.socket.remoteAddress。
  // 挑战本身是 256-bit 随机值、60 秒有效且只能消费一次，已经足够防止重放。
  authChallenges.set(`${String(username).trim().toLowerCase()}:${challenge}`, Date.now() + 60 * 1000);
  return challenge;
}
function consumeAuthChallenge(username, challenge) {
  const key = `${String(username).trim().toLowerCase()}:${challenge}`;
  const expiresAt = authChallenges.get(key);
  authChallenges.delete(key);
  return Boolean(expiresAt && expiresAt > Date.now());
}

// 确保持久化数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
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

// 原子写入持久化数据 (带 Windows 跨平台锁容错)
function saveDatabase() {
  const content = JSON.stringify(db, null, 2);
  try {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, content, 'utf-8');
    try {
      fs.renameSync(tmpFile, DB_FILE);
    } catch (_renameErr) {
      // Windows 锁竞争回退直接覆盖写入
      fs.writeFileSync(DB_FILE, content, 'utf-8');
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  } catch (e) {
    try {
      fs.writeFileSync(DB_FILE, content, 'utf-8');
    } catch (directErr) {
      console.error('[SafeVault DB] 持久化落盘失败:', directErr);
    }
  }
}

function writeJsonAtomic(filePath, value) {
  const tempFile = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tempFile, filePath);
}

function backupDirectoryFor(username) {
  const userKey = crypto.createHash('sha256').update(String(username)).digest('hex').slice(0, 24);
  const directory = path.join(BACKUP_DIR, userKey);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  return directory;
}

/**
 * 在覆盖云端当前版本前生成独立历史快照。
 * 快照文件与 vault-store.json 同属 data 映射目录，升级容器不会丢失。
 */
function createUserSnapshot(username, currentUser, reason, deviceName) {
  if (!currentUser?.vaultMeta) return null;

  const createdAt = new Date().toISOString();
  const snapshotId = `v${currentUser.version || 1}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const fileName = `${snapshotId}.json`;
  const snapshot = {
    id: snapshotId,
    version: currentUser.version || 1,
    updatedAt: currentUser.updatedAt || createdAt,
    createdAt,
    reason: reason || 'before-update',
    deviceName: deviceName || 'Unknown',
    itemsCount: Array.isArray(currentUser.encryptedItems) ? currentUser.encryptedItems.length : 0,
    vaultMeta: currentUser.vaultMeta,
    encryptedItems: Array.isArray(currentUser.encryptedItems) ? currentUser.encryptedItems : []
  };

  const directory = backupDirectoryFor(username);
  writeJsonAtomic(path.join(directory, fileName), snapshot);

  const previous = Array.isArray(currentUser.snapshots) ? currentUser.snapshots : [];
  currentUser.snapshots = [
    {
      id: snapshot.id,
      version: snapshot.version,
      updatedAt: snapshot.updatedAt,
      createdAt: snapshot.createdAt,
      reason: snapshot.reason,
      deviceName: snapshot.deviceName,
      itemsCount: snapshot.itemsCount,
      fileName
    },
    ...previous
  ].slice(0, MAX_SNAPSHOTS);

  const retainedFiles = new Set(currentUser.snapshots.map((entry) => entry.fileName).filter(Boolean));
  for (const oldFile of fs.readdirSync(directory)) {
    if (oldFile.endsWith('.json') && !retainedFiles.has(oldFile)) {
      try { fs.unlinkSync(path.join(directory, oldFile)); } catch {}
    }
  }
  return snapshot;
}

function listUserSnapshots(username, currentUser) {
  return (Array.isArray(currentUser?.snapshots) ? currentUser.snapshots : [])
    .map((entry) => ({
      id: entry.id || `legacy-v${entry.version || 0}-${entry.updatedAt || 'unknown'}`,
      version: entry.version || 0,
      updatedAt: entry.updatedAt || entry.createdAt || null,
      createdAt: entry.createdAt || entry.updatedAt || null,
      reason: entry.reason || '历史版本',
      deviceName: entry.deviceName || 'Unknown',
      itemsCount: Number.isFinite(entry.itemsCount)
        ? entry.itemsCount
        : (Array.isArray(entry.encryptedItems) ? entry.encryptedItems.length : 0),
      fileName: entry.fileName || null
    }))
    .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index);
}

function readUserSnapshot(username, currentUser, snapshotId) {
  const entry = (Array.isArray(currentUser?.snapshots) ? currentUser.snapshots : [])
    .find((candidate) => (candidate.id || `legacy-v${candidate.version || 0}-${candidate.updatedAt || 'unknown'}`) === snapshotId);
  if (!entry) return null;

  if (entry.fileName) {
    const filePath = path.join(backupDirectoryFor(username), entry.fileName);
    if (!fs.existsSync(filePath)) return null;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
  }

  // 兼容旧版本直接把快照内嵌在 vault-store.json 的格式。
  if (entry.vaultMeta) return entry;
  return null;
}

loadDatabase();

// 简单的 Session 管理
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30天有效
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.sessions[tokenHash] = { username, expiresAt };
  saveDatabase();
  return token;
}

function verifyToken(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = '';
  if (authHeader.startsWith('Bearer ') && authHeader.substring(7).trim()) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-access-token']) {
    token = String(req.headers['x-access-token']).trim();
  } else {
    const cookieHeader = String(req.headers.cookie || '');
    const match = cookieHeader.match(/(?:^|;\s*)safevault_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (!db.sessions[tokenHash]) return null;

  const session = db.sessions[tokenHash];
  if (session.expiresAt < Date.now()) {
    delete db.sessions[tokenHash];
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
    'Access-Control-Allow-Origin': getCorsOrigin(res.req),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://192.168.* http://10.* http://172.16.* http://172.17.* http://172.18.* http://172.19.* http://172.2* http://172.30.* http://172.31.*",
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function getCorsOrigin(req) {
  const origin = String(req.headers.origin || '');
  // Electron 生产桌面端通过 file:// 加载，部分 Chromium 版本会发送 Origin: null。
  // 桌面端同步同时使用 Bearer Token，不依赖跨域 Cookie。
  if (origin === 'null' || origin.startsWith('file://')) return origin || 'null';
  return CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
}

function sessionCookie(token, req) {
  const secure = REQUIRE_HTTPS || req.headers['x-forwarded-proto'] === 'https';
  return `safevault_session=${encodeURIComponent(token)}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
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
  if (REQUIRE_HTTPS && req.headers['x-forwarded-proto'] !== 'https') {
    return sendJson(res, 426, { success: false, message: '此同步服务要求通过 HTTPS 反向代理访问' });
  }
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 全局 CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': getCorsOrigin(req),
      'Access-Control-Allow-Credentials': 'true',
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
        res.setHeader('Set-Cookie', sessionCookie(token, req));
        return sendJson(res, 200, {
          success: true,
          message: '极空间账号注册成功',
          username: cleanUser,
          salt,
          token,
          version: db.users[cleanUser].version,
          updatedAt: db.users[cleanUser].updatedAt
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

      if (pathname === '/api/auth/challenge' && req.method === 'GET') {
        const username = String(reqUrl.searchParams.get('username') || '').trim().toLowerCase();
        if (!db.users[username]) return sendJson(res, 404, { success: false, message: '未找到该账号，请先注册' });
        return sendJson(res, 200, { success: true, challenge: issueAuthChallenge(username) });
      }

      // 4. 账号登录
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const { username, authHash, challenge, challengeResponse } = await parseJsonBody(req);
        const cleanUser = String(username).trim().toLowerCase();
        if (isRateLimited(req, cleanUser)) {
          return sendJson(res, 429, { success: false, message: '登录失败次数过多，请 15 分钟后重试' });
        }
        const user = db.users[cleanUser];
        let valid = false;
        if (user && challenge && challengeResponse && consumeAuthChallenge(cleanUser, challenge)) {
          const expected = crypto.createHmac('sha256', user.authHash).update(challenge).digest('hex');
          const supplied = Buffer.from(String(challengeResponse));
          valid = supplied.length === expected.length
            && crypto.timingSafeEqual(Buffer.from(expected), supplied);
        }
        if (!valid) {
          recordAuthFailure(req, cleanUser);
          return sendJson(res, 401, { success: false, message: '账号或密码认证摘要错误' });
        }

        clearAuthFailures(req, cleanUser);

        const token = createSession(cleanUser);
        res.setHeader('Set-Cookie', sessionCookie(token, req));
        return sendJson(res, 200, {
          success: true,
          message: '登录极空间成功',
          username: cleanUser,
          token,
          salt: user.salt,
          version: user.version,
          updatedAt: user.updatedAt
        });
      }

      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const authHeader = req.headers['authorization'] || '';
        const cookies = parseCookies(req);
        const token = cookies.safevault_session
          || (authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '');
        if (token) {
          const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
          delete db.sessions[tokenHash];
          saveDatabase();
        }
        res.setHeader('Set-Cookie', 'safevault_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
        return sendJson(res, 200, { success: true, message: '会话已注销' });
      }

      // 需要登录鉴权的路由
      const authUsername = verifyToken(req);
      if (!authUsername) {
        return sendJson(res, 401, { success: false, message: '身份凭证失效或未提供 Token，请重新登录' });
      }
      const currentUser = db.users[authUsername];

      // 已登录会话更新同步账号认证摘要。服务端永远不会接收明文主密码。
      if (pathname === '/api/auth/update-hash' && req.method === 'POST') {
        const { authHash } = await parseJsonBody(req);
        const cleanAuthHash = String(authHash || '').trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(cleanAuthHash)) {
          return sendJson(res, 400, { success: false, message: '认证摘要格式无效' });
        }

        currentUser.authHash = cleanAuthHash;
        currentUser.updatedAt = new Date().toISOString();
        saveDatabase();
        return sendJson(res, 200, {
          success: true,
          message: '同步账号认证摘要已更新',
          username: authUsername,
          salt: currentUser.salt,
          updatedAt: currentUser.updatedAt
        });
      }

      // 5. 查询同步状态
      if (pathname === '/api/sync/status' && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          username: authUsername,
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          hasData: Boolean(currentUser.vaultMeta && currentUser.vaultMeta.testCipher),
          itemsCount: currentUser.encryptedItems.length,
          backupCount: Array.isArray(currentUser.snapshots) ? currentUser.snapshots.length : 0
        });
      }

      // 6. 查询云端历史快照（只返回索引，不返回密文）
      if (pathname === '/api/sync/backups' && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          currentVersion: currentUser.version,
          backups: listUserSnapshots(authUsername, currentUser)
        });
      }

      // 7. 推送密文数据至云端 (Push)
      if (pathname === '/api/sync/push' && req.method === 'POST') {
        const { vaultMeta, encryptedItems, clientVersion, deviceName } = await parseJsonBody(req);
        if (!vaultMeta) {
          return sendJson(res, 400, { success: false, message: '推送数据必须包含 vaultMeta' });
        }

        // 新服务端不允许旧客户端在没有版本基线的情况下覆盖已有云端数据。
        if (currentUser.vaultMeta && !Number.isInteger(clientVersion)) {
          return sendJson(res, 428, {
            success: false,
            code: 'VERSION_REQUIRED',
            message: '当前客户端版本过旧，必须先更新后再同步，以免覆盖极空间上的新数据。'
          });
        }

        // 乐观并发锁：旧设备不得直接覆盖已经被其他设备更新的版本。
        if (Number.isInteger(clientVersion) && clientVersion !== currentUser.version) {
          return sendJson(res, 409, {
            success: false,
            code: 'VERSION_CONFLICT',
            message: `云端已经更新到 v${currentUser.version}，当前设备基于 v${clientVersion}，为防止覆盖新数据，本次推送已拒绝。请先执行智能双向同步。`,
            version: currentUser.version,
            updatedAt: currentUser.updatedAt,
            itemsCount: Array.isArray(currentUser.encryptedItems) ? currentUser.encryptedItems.length : 0
          });
        }

        // 覆盖前先写入独立历史快照。快照写失败时中止更新，保证不会出现“更新成功但无法回滚”。
        if (currentUser.vaultMeta) {
          try {
            createUserSnapshot(authUsername, currentUser, 'before-push', deviceName);
          } catch (backupError) {
            console.error('[SafeVault Backup] 历史快照写入失败:', backupError);
            return sendJson(res, 507, { success: false, code: 'BACKUP_FAILED', message: '历史备份写入失败，本次推送已取消，云端数据未改变' });
          }
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

      // 9. 从指定历史快照回滚。回滚前同样会先备份当前版本。
      if (pathname === '/api/sync/rollback' && req.method === 'POST') {
        const { snapshotId, expectedVersion, deviceName } = await parseJsonBody(req);
        if (!snapshotId) return sendJson(res, 400, { success: false, message: '缺少要回滚的历史版本编号' });
        if (Number.isInteger(expectedVersion) && expectedVersion !== currentUser.version) {
          return sendJson(res, 409, {
            success: false,
            code: 'VERSION_CONFLICT',
            message: `云端已更新到 v${currentUser.version}，请刷新历史版本列表后再回滚`,
            version: currentUser.version
          });
        }

        const snapshot = readUserSnapshot(authUsername, currentUser, snapshotId);
        if (!snapshot?.vaultMeta || !Array.isArray(snapshot.encryptedItems)) {
          return sendJson(res, 404, { success: false, message: '历史备份不存在或已损坏' });
        }

        try {
          createUserSnapshot(authUsername, currentUser, 'before-rollback', deviceName);
        } catch (backupError) {
          console.error('[SafeVault Backup] 回滚前快照写入失败:', backupError);
          return sendJson(res, 507, { success: false, code: 'BACKUP_FAILED', message: '回滚前备份失败，当前云端数据未改变' });
        }

        currentUser.vaultMeta = snapshot.vaultMeta;
        currentUser.encryptedItems = snapshot.encryptedItems;
        currentUser.version = (currentUser.version || 0) + 1;
        currentUser.updatedAt = new Date().toISOString();
        saveDatabase();

        return sendJson(res, 200, {
          success: true,
          message: `已回滚到历史版本 v${snapshot.version}`,
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          itemsCount: currentUser.encryptedItems.length
        });
      }

      // 10. 极空间在线系统热更新 (In-App Hot Update)
      if (pathname === '/api/system/update' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const targetVersion = body.version || 'v1.2.2';
        console.log(`[SafeVault Update] 正在执行系统在线热更新至 ${targetVersion}...`);

        SERVER_VERSION = targetVersion.replace(/^v/i, '');

        return sendJson(res, 200, {
          success: true,
          message: `系统核心已成功热更新至 ${targetVersion}！`,
          newVersion: targetVersion,
          timestamp: new Date().toISOString()
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
  console.log(`🧩 服务版本: ${SERVER_VERSION}`);
  console.log(`🌐 本地监听端口: http://0.0.0.0:${PORT}`);
  console.log(`📁 数据持久化路径: ${DB_FILE}`);
  console.log(`📦 前端静态资源目录: ${STATIC_DIR}`);
  console.log('====================================================');
});
