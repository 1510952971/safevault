/**
 * SafeVault 极空间 NAS 轻量同步服务端
 * 
 * 核心特性：
 * 1. 纯原生 Node.js 实现（零第三方外部依赖，内存占用 < 30MB，极速冷启）；
 * 2. 静态托管：无缝提供前端 Single Page App 静态文件及 SPA 路由重定向；
 * 3. 零知识密文同步 API：服务端仅存储认证摘要与客户端加密后的密文 Blob，主密码绝不上云；
 * 4. 双目录灾备：运行数据库与外部备份分别挂载，data 整体丢失时可自动恢复。
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
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'safevault-backup');
const USER_BACKUP_DIR = path.join(BACKUP_DIR, 'users');
const DATABASE_BACKUP_DIR = path.join(BACKUP_DIR, 'database');
const LATEST_DATABASE_BACKUP = path.join(DATABASE_BACKUP_DIR, 'vault-store-latest.json');
const LEGACY_BACKUP_DIR = path.join(DATA_DIR, 'backups');
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'dist');
const REQUIRE_HTTPS = process.env.REQUIRE_HTTPS === 'true';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://localhost,capacitor://localhost,null,file://').split(',').map((origin) => origin.trim()).filter(Boolean);
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const SERVER_VERSION = packageInfo.version;

function getFrontendVersion() {
  try {
    const buildInfo = JSON.parse(fs.readFileSync(path.join(STATIC_DIR, 'build-info.json'), 'utf8'));
    return String(buildInfo.version || 'unknown');
  } catch {
    return 'unknown';
  }
}
const MAX_SNAPSHOTS = 30;
const MAX_DATABASE_BACKUPS = 30;
const CURRENT_AUTH_KDF_ITERATIONS = 600000;
const LEGACY_AUTH_KDF_ITERATIONS = 10000;
const MAX_BODY_BYTES = Number.isSafeInteger(Number(process.env.MAX_BODY_BYTES))
  ? Math.max(1024 * 1024, Number(process.env.MAX_BODY_BYTES))
  : 10 * 1024 * 1024;
const MAX_SYNC_ITEMS = 10000;
const MAX_ENCRYPTED_FIELD_BYTES = 8 * 1024 * 1024;

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

function forwardedProto(req) {
  if (!TRUST_PROXY) return req.socket.encrypted ? 'https' : 'http';
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
    || (req.socket.encrypted ? 'https' : 'http');
}

function isHttpsRequest(req) {
  return forwardedProto(req) === 'https';
}
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
for (const directory of [BACKUP_DIR, USER_BACKUP_DIR, DATABASE_BACKUP_DIR]) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

// 内存数据库与持久化
let db = {
  users: {},
  sessions: {}
};

// 加载持久化数据
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    let content;
    try {
      content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      if (!db.users) db.users = {};
      if (!db.sessions) db.sessions = {};
    } catch (e) {
      console.error('[SafeVault DB] 主数据库损坏，尝试从外部备份恢复:', e);
      if (restoreDatabaseFromExternalBackup()) return;
      throw new Error('主数据库损坏且没有可用的外部备份，服务已停止以防止空库覆盖');
    }

    migrateLegacyUserSnapshots();
    saveFullDatabaseBackup(JSON.stringify(db, null, 2));
    console.log(`[SafeVault DB] 成功载入数据并完成外部灾备，当前注册用户数: ${Object.keys(db.users).length}`);
    return;
  }

  if (restoreDatabaseFromExternalBackup()) return;
  console.warn('[SafeVault DB] 未找到主数据库或外部备份，将初始化全新空库');
  saveDatabase();
}

function isValidDatabase(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && candidate.users && candidate.sessions);
}

function writeFileAtomic(filePath, content) {
  const tmpFile = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmpFile, content, 'utf-8');
  try {
    fs.renameSync(tmpFile, filePath);
  } catch (_renameErr) {
    fs.writeFileSync(filePath, content, 'utf-8');
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

function saveFullDatabaseBackup(content) {
  const parsed = JSON.parse(content);
  if (!isValidDatabase(parsed)) throw new Error('拒绝备份无效数据库结构');
  const fileName = `vault-store-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.json`;
  writeFileAtomic(path.join(DATABASE_BACKUP_DIR, fileName), content);
  writeFileAtomic(LATEST_DATABASE_BACKUP, content);

  const archives = fs.readdirSync(DATABASE_BACKUP_DIR)
    .filter((name) => /^vault-store-\d.*\.json$/.test(name))
    .sort()
    .reverse();
  for (const oldFile of archives.slice(MAX_DATABASE_BACKUPS)) {
    try { fs.unlinkSync(path.join(DATABASE_BACKUP_DIR, oldFile)); } catch {}
  }
}

function restoreDatabaseFromExternalBackup() {
  if (!fs.existsSync(LATEST_DATABASE_BACKUP)) return false;
  try {
    const content = fs.readFileSync(LATEST_DATABASE_BACKUP, 'utf-8');
    const restored = JSON.parse(content);
    if (!isValidDatabase(restored)) throw new Error('外部备份结构无效');
    db = restored;
    writeFileAtomic(DB_FILE, content);
    console.warn(`[SafeVault Disaster Recovery] 已从外部备份自动恢复数据库，用户数: ${Object.keys(db.users).length}`);
    return true;
  } catch (error) {
    console.error('[SafeVault Disaster Recovery] 外部备份恢复失败，拒绝静默覆盖:', error);
    throw error;
  }
}

// 原子写入运行数据库，并在独立挂载目录保存完整灾备副本。
function saveDatabase() {
  const content = JSON.stringify(db, null, 2);
  try {
    // 先写独立备份，备份失败时不允许更新主库。
    saveFullDatabaseBackup(content);
    writeFileAtomic(DB_FILE, content);
  } catch (error) {
    console.error('[SafeVault DB] 数据库或外部备份写入失败:', error);
    throw error;
  }
}

function writeJsonAtomic(filePath, value) {
  writeFileAtomic(filePath, JSON.stringify(value, null, 2));
}

function backupDirectoryFor(username) {
  const userKey = crypto.createHash('sha256').update(String(username)).digest('hex').slice(0, 24);
  const directory = path.join(USER_BACKUP_DIR, userKey);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function normalizeDeviceName(value) {
  const normalized = String(value || 'Unknown')
    .replace(/[^\p{L}\p{N} _.:/@+\-]/gu, '?')
    .trim()
    .slice(0, 128);
  return normalized || 'Unknown';
}

// 只返回密文载荷的指纹，便于 NAS 与 AWS 之间判断“是否仍是上次已复制的同一份数据”。
// 指纹不包含明文，也不允许客户端在未知远端状态下盲目覆盖另一端。
function vaultDataHash(vaultMeta, encryptedItems) {
  if (!vaultMeta || !Array.isArray(encryptedItems)) return null;
  return crypto.createHash('sha256')
    .update(JSON.stringify({ vaultMeta, encryptedItems }))
    .digest('hex');
}

function currentVaultDataHash(user) {
  return vaultDataHash(user?.vaultMeta, user?.encryptedItems || []);
}

function migrateLegacyUserSnapshots() {
  if (!fs.existsSync(LEGACY_BACKUP_DIR)) return;
  for (const [username, user] of Object.entries(db.users || {})) {
    const userKey = crypto.createHash('sha256').update(String(username)).digest('hex').slice(0, 24);
    const legacyDirectory = path.join(LEGACY_BACKUP_DIR, userKey);
    if (!fs.existsSync(legacyDirectory)) continue;
    const externalDirectory = backupDirectoryFor(username);
    for (const entry of Array.isArray(user.snapshots) ? user.snapshots : []) {
      if (!entry.fileName) continue;
      const source = path.join(legacyDirectory, entry.fileName);
      const destination = path.join(externalDirectory, entry.fileName);
      if (fs.existsSync(source) && !fs.existsSync(destination)) fs.copyFileSync(source, destination);
    }
  }
}

/**
 * 在覆盖云端当前版本前生成外部历史快照。
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
    deviceName: normalizeDeviceName(deviceName),
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
    const userKey = crypto.createHash('sha256').update(String(username)).digest('hex').slice(0, 24);
    const candidates = [
      path.join(backupDirectoryFor(username), entry.fileName),
      path.join(LEGACY_BACKUP_DIR, userKey, entry.fileName)
    ];
    const filePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!filePath) return null;
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
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
      req.resume();
    };
    req.on('data', (chunk) => {
      if (settled) return;
      const nextSize = Buffer.byteLength(body) + Buffer.byteLength(chunk);
      if (nextSize > MAX_BODY_BYTES) {
        fail(new Error('Payload Too Large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
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

function securityHeaders(req, cacheControl = 'no-store') {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://192.168.* http://10.* http://172.16.* http://172.17.* http://172.18.* http://172.19.* http://172.2* http://172.30.* http://172.31.*",
    'Cache-Control': cacheControl
  };
  if (isHttpsRequest(req)) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  const origin = getCorsOrigin(req);
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Access-Token';
  }
  return headers;
}

// 辅助工具：响应 JSON
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...securityHeaders(res.req)
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
  if (!origin) return null;
  // Electron 使用 file://；Capacitor Android/iOS 使用 localhost 或 capacitor://localhost。
  // 所有客户端同步同时使用 Bearer Token，不依赖跨域 Cookie。
  if (origin === 'null' || origin.startsWith('file://')) return origin || 'null';
  return CORS_ORIGINS.includes(origin) ? origin : null;
}

function sessionCookie(token, req) {
  const secure = REQUIRE_HTTPS || isHttpsRequest(req);
  return `safevault_session=${encodeURIComponent(token)}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

function isBase64(value, maxBytes = MAX_ENCRYPTED_FIELD_BYTES) {
  if (typeof value !== 'string' || value.length === 0 || value.length > Math.ceil(maxBytes * 4 / 3) + 8) return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').length <= maxBytes;
  } catch {
    return false;
  }
}

function validateVaultPayload(vaultMeta, encryptedItems) {
  if (!vaultMeta || typeof vaultMeta !== 'object' || Array.isArray(vaultMeta)) return 'vaultMeta 格式无效';
  if (!isBase64(vaultMeta.salt, 64) || !isBase64(vaultMeta.testIv, 64) || !isBase64(vaultMeta.testCipher, 1024)) {
    return 'vaultMeta 加密字段格式无效';
  }
  if (vaultMeta.keyEnvelopeVersion === 2
    && (!isBase64(vaultMeta.wrappedVaultKey, 128) || !isBase64(vaultMeta.wrappedVaultKeyIv, 64))) {
    return '金库密钥包裹字段格式无效';
  }
  if (!Array.isArray(encryptedItems) || encryptedItems.length > MAX_SYNC_ITEMS) return '密文条目数量超出限制';
  for (const item of encryptedItems) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return '密文条目格式无效';
    if (typeof item.id !== 'string' || item.id.length < 8 || item.id.length > 128) return '密文条目标识无效';
    if (item.encryptionVersion !== undefined && item.encryptionVersion !== 2 && item.encryptionVersion !== 3) {
      return '密文条目版本无效';
    }
    if (!isBase64(item.iv, 64) || !isBase64(item.encryptedPayload, MAX_ENCRYPTED_FIELD_BYTES)) {
      return '密文条目加密字段格式无效';
    }
    // v3 的设计要求整条记录进入密文；若外壳又携带可读元数据，拒绝写入，
    // 避免服务器端逐步积累意外泄露的标题/网址/分类。
    if (item.encryptionVersion === 3 && ['title', 'category', 'website', 'tags', 'isFavorite', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt']
      .some((field) => Object.prototype.hasOwnProperty.call(item, field))) {
      return 'v3 密文条目不得包含明文元数据';
    }
  }
  return null;
}

// 处理静态文件
function serveStaticFile(req, res, pathname) {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { ...securityHeaders(req), 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad Request');
  }
  const staticRoot = path.resolve(STATIC_DIR);
  const relativePath = decodedPathname.replace(/^[/\\]+/, '');
  const filePath = path.resolve(staticRoot, relativePath);
  const relativeToRoot = path.relative(staticRoot, filePath);

  // 安全检查：防止目录穿越
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    res.writeHead(403, { ...securityHeaders(req), 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: 若不是具体静态文件，全部回退到 index.html
      const indexPath = path.join(STATIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404, { ...securityHeaders(req), 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('SafeVault 静态页面未编译或缺失，请在工程中运行 npm run build 后重新构建容器。');
        }
        res.writeHead(200, { ...securityHeaders(req, 'no-cache'), 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexData);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutable = ext === '.js' || ext === '.css' || ext === '.woff2';

    res.writeHead(200, {
      'Content-Type': contentType,
      ...securityHeaders(req, isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache')
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  if (REQUIRE_HTTPS && !isHttpsRequest(req)) {
    return sendJson(res, 426, { success: false, message: '此同步服务要求通过 HTTPS 反向代理访问' });
  }
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 全局 CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...securityHeaders(req), 'Access-Control-Max-Age': '86400' });
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
          serverVersion: SERVER_VERSION,
          frontendVersion: getFrontendVersion(),
          versionsMatch: getFrontendVersion() === SERVER_VERSION,
          disasterBackupReady: fs.existsSync(LATEST_DATABASE_BACKUP),
          disasterBackupCount: fs.readdirSync(DATABASE_BACKUP_DIR).filter((name) => /^vault-store-\d.*\.json$/.test(name)).length,
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
        if (!/^[0-9a-f]{64}$/i.test(String(authHash)) || !/^[0-9a-f]{32}$/i.test(String(salt))) {
          return sendJson(res, 400, { success: false, message: '注册认证参数格式无效' });
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
          authKdfIterations: CURRENT_AUTH_KDF_ITERATIONS,
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
          salt: user.salt,
          authKdfIterations: Number(user.authKdfIterations) || LEGACY_AUTH_KDF_ITERATIONS
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
          authKdfIterations: Number(user.authKdfIterations) || LEGACY_AUTH_KDF_ITERATIONS,
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
        currentUser.authKdfIterations = CURRENT_AUTH_KDF_ITERATIONS;
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

      // 主密码变更的原子提交：认证摘要与新密文金库必须在同一次
      // 版本锁/灾备事务中切换，避免“能登录但打不开库”或反向半成功状态。
      if (pathname === '/api/auth/change-password' && req.method === 'POST') {
        const { authHash, vaultMeta, encryptedItems, clientVersion, deviceName } = await parseJsonBody(req);
        const cleanAuthHash = String(authHash || '').trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(cleanAuthHash)) {
          return sendJson(res, 400, { success: false, message: '认证摘要格式无效' });
        }
        const payloadError = validateVaultPayload(vaultMeta, encryptedItems);
        if (payloadError) {
          return sendJson(res, 400, { success: false, message: `改密数据校验失败：${payloadError}` });
        }
        if (!currentUser.vaultMeta || !Number.isInteger(clientVersion) || clientVersion !== currentUser.version) {
          return sendJson(res, 409, {
            success: false,
            code: 'VERSION_CONFLICT',
            version: currentUser.version,
            message: '云端版本已变化，请先拉取最新金库后再修改主密码'
          });
        }

        const previousState = {
          authHash: currentUser.authHash,
          authKdfIterations: currentUser.authKdfIterations,
          vaultMeta: currentUser.vaultMeta,
          encryptedItems: currentUser.encryptedItems,
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          snapshots: currentUser.snapshots
        };
        try {
          createUserSnapshot(authUsername, currentUser, 'before-password-change', deviceName);
          const now = new Date().toISOString();
          currentUser.authHash = cleanAuthHash;
          currentUser.authKdfIterations = CURRENT_AUTH_KDF_ITERATIONS;
          currentUser.vaultMeta = vaultMeta;
          currentUser.encryptedItems = encryptedItems;
          currentUser.version += 1;
          currentUser.updatedAt = now;
          saveDatabase();
        } catch (error) {
          Object.assign(currentUser, previousState);
          console.error('[SafeVault Password Change] 原子改密提交失败:', error);
          return sendJson(res, 507, { success: false, code: 'PASSWORD_CHANGE_COMMIT_FAILED', message: '改密提交失败，云端数据未改变' });
        }

        console.log(`[SafeVault Sync] 用户 [${authUsername}] 已完成原子改密，密文金库更新至 v${currentUser.version}`);
        return sendJson(res, 200, {
          success: true,
          message: '主密码与加密金库已原子更新',
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          itemsCount: currentUser.encryptedItems.length
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
          backupCount: Array.isArray(currentUser.snapshots) ? currentUser.snapshots.length : 0,
          dataHash: currentVaultDataHash(currentUser)
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
        const payloadError = validateVaultPayload(vaultMeta, encryptedItems);
        if (payloadError) {
          return sendJson(res, 400, { success: false, message: `推送数据校验失败：${payloadError}` });
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
        currentUser.encryptedItems = encryptedItems;
        currentUser.version = (currentUser.version || 0) + 1;
        currentUser.updatedAt = new Date().toISOString();
        saveDatabase();

        console.log(`[SafeVault Sync] 用户 [${authUsername}] 来自设备 [${normalizeDeviceName(deviceName)}] 成功推送 ${currentUser.encryptedItems.length} 条加密凭据 (版本: v${currentUser.version})`);

        return sendJson(res, 200, {
          success: true,
          message: '已成功将加密金库同步至极空间',
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          itemsCount: currentUser.encryptedItems.length,
          dataHash: currentVaultDataHash(currentUser)
        });
      }

      // 7. 从云端拉取密文数据 (Pull)
      if (pathname === '/api/sync/pull' && req.method === 'GET') {
        return sendJson(res, 200, {
          success: true,
          vaultMeta: currentUser.vaultMeta,
          encryptedItems: currentUser.encryptedItems || [],
          version: currentUser.version,
          updatedAt: currentUser.updatedAt,
          dataHash: currentVaultDataHash(currentUser)
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

      // 10. 更新状态说明。容器内不允许自行替换运行代码，避免伪更新与数据损坏。
      if (pathname === '/api/system/update' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const targetVersion = body.version || `v${SERVER_VERSION}`;
        return sendJson(res, 409, {
          success: false,
          code: 'DEPLOYMENT_UPDATE_REQUIRED',
          currentVersion: SERVER_VERSION,
          targetVersion,
          message: '极空间版本更新必须覆盖最新 dist、server 与 package.json 后重启容器；data 与 safevault-backup 两个目录都必须保留并独立挂载。'
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
  console.log(`🛟 独立灾备路径: ${BACKUP_DIR}`);
  console.log(`📦 前端静态资源目录: ${STATIC_DIR}`);
  console.log('====================================================');
});
