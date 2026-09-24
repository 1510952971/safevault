/**
 * SafeVault 极空间 NAS 容器化多端同步与版本更新算法自动化单元测试
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- 开始极空间 NAS 零知识同步协议与版本更新单元测试 ---');

// 1. 模拟客户端 AuthHash 派生算法 (使用 Node.js crypto 实现与 Web Crypto API PBKDF2 一致的逻辑)
function deriveAuthHashNode(username, masterPassword, saltHex) {
  const authSalt = `safevault:nas:auth:${username.toLowerCase()}:${saltHex}`;
  const derived = crypto.pbkdf2Sync(masterPassword, authSalt, 10000, 32, 'sha256');
  return derived.toString('hex');
}

// 2. 语义化版本比对算法
function compareSemVer(vA, vB) {
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

// 辅助 HTTP 请求函数
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  // [1/5] 测试客户端零知识 AuthHash 派生
  console.log('[1/5] 测试客户端零知识 AuthHash 派生与抗碰撞特性...');
  const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const hash1 = deriveAuthHashNode('admin', 'MasterPass@2026', salt);
  const hash2 = deriveAuthHashNode('admin', 'MasterPass@2026', salt);
  const hashDiffPass = deriveAuthHashNode('admin', 'WrongPass@2026', salt);
  const hashDiffUser = deriveAuthHashNode('guest', 'MasterPass@2026', salt);

  assert.strictEqual(hash1, hash2, '相同账号和主密码应派生一致的 AuthHash');
  assert.notStrictEqual(hash1, hashDiffPass, '错误主密码必须产生完全不同的 AuthHash');
  assert.notStrictEqual(hash1, hashDiffUser, '不同用户名必须产生域隔离的 AuthHash');
  assert.strictEqual(hash1.length, 64, 'AuthHash 应为 64 位 SHA-256 Hex 字符串');
  console.log('  ✓ 零知识认证哈希计算一致性与单向不可逆性验证通过');

  // [2/5] 测试语义化版本比对算法
  console.log('[2/5] 测试 GitHub 语义化版本号（SemVer）比对算法...');
  assert.strictEqual(compareSemVer('v1.2.0', 'v1.1.0'), 1, '新版本高于旧版本');
  assert.strictEqual(compareSemVer('v1.1.0', 'v1.1.0'), 0, '相同版本应相等');
  assert.strictEqual(compareSemVer('v1.0.9', 'v1.1.0'), -1, '旧版本低于新版本');
  assert.strictEqual(compareSemVer('1.10.0', 'v1.9.0'), 1, '大次版本号比对正确');
  console.log('  ✓ 语义化版本比对算法验证通过');

  // [3/5] 启动临时同步服务端并在端口 8099 运行 API 测试
  console.log('[3/5] 启动极空间轻量同步服务端 (Node.js 原生 HTTP 端口 8099)...');
  const TEST_PORT = 8099;
  const TEST_DATA_DIR = path.join(__dirname, '..', 'data', `test-data-${process.pid}-${Date.now()}`);
  const TEST_DB = path.join(TEST_DATA_DIR, 'vault-store.json');

  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  process.env.PORT = String(TEST_PORT);
  process.env.DATA_DIR = TEST_DATA_DIR;

  // 动态导入 server
  const serverModule = await import('../server/index.js');

  // 等待服务器就绪
  await new Promise(r => setTimeout(r, 600));

  // [4/5] 测试 API 注册与登录
  console.log('[4/5] 测试极空间同步 API：服务探活、注册、公开盐值获取与登录鉴权...');
  // 探活
  const verRes = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: '/api/version', method: 'GET' });
  assert.strictEqual(verRes.status, 200);
  assert.strictEqual(verRes.body.success, true);
  assert.strictEqual(verRes.body.version, '1.2.0');

  // 注册
  const testUser = 'zspace_tester';
  const testPass = 'SuperVaultPass#999';
  const testSalt = '11223344556677889900aabbccddeeff';
  const testAuthHash = deriveAuthHashNode(testUser, testPass, testSalt);

  const regRes = await makeRequest(
    { host: '127.0.0.1', port: TEST_PORT, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUser, authHash: testAuthHash, salt: testSalt }
  );
  assert.strictEqual(regRes.status, 200, '注册应当成功返回 200');
  assert.strictEqual(regRes.body.success, true);
  assert.ok(regRes.body.token, '注册应返回可跨远程地址使用的 Bearer Token');
  const registrationCookie = regRes.headers['set-cookie']?.[0]?.split(';')[0];
  assert.ok(registrationCookie, '注册应下发 HttpOnly Session Cookie');

  // 重复注册应阻断
  const dupReg = await makeRequest(
    { host: '127.0.0.1', port: TEST_PORT, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUser, authHash: testAuthHash, salt: testSalt }
  );
  assert.strictEqual(dupReg.status, 409, '重复注册应返回 409 Conflict');

  // 获取公开盐值 (多端登录拉取)
  const saltRes = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: `/api/auth/salt?username=${testUser}`, method: 'GET' });
  assert.strictEqual(saltRes.status, 200);
  assert.strictEqual(saltRes.body.salt, testSalt);

  // 登录鉴权
  const challengeRes = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: `/api/auth/challenge?username=${testUser}`, method: 'GET' });
  assert.strictEqual(challengeRes.status, 200);
  const challengeResponse = crypto.createHmac('sha256', testAuthHash).update(challengeRes.body.challenge).digest('hex');
  const loginRes = await makeRequest(
    { host: '127.0.0.1', port: TEST_PORT, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUser, challenge: challengeRes.body.challenge, challengeResponse }
  );
  assert.strictEqual(loginRes.status, 200);
  const tokenCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0];
  assert.ok(tokenCookie, '登录应下发 HttpOnly Session Cookie');

  // 一次性挑战不得重放
  const replayLogin = await makeRequest(
    { host: '127.0.0.1', port: TEST_PORT, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUser, challenge: challengeRes.body.challenge, challengeResponse }
  );
  assert.strictEqual(replayLogin.status, 401, '已使用的登录挑战不得重放');

  // 错误密码摘要登录应阻断
  const failChallenge = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: `/api/auth/challenge?username=${testUser}`, method: 'GET' });
  const failLogin = await makeRequest(
    { host: '127.0.0.1', port: TEST_PORT, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUser, challenge: failChallenge.body.challenge, challengeResponse: 'bad_auth_response' }
  );
  assert.strictEqual(failLogin.status, 401, '错误认证散列应被阻断 401');
  console.log('  ✓ 极空间服务连通、注册、公开盐值获取与登录鉴权测试通过');

  // [5/5] 测试密文推送 (Push) 与拉取 (Pull) 往返完整性
  console.log('[5/5] 测试加密金库密文包推送 (Push)、状态查询与拉取 (Pull)...');
  const mockVaultMeta = {
    salt: 'TEST_SALT_BASE64==',
    testCipher: 'CIPHER_TEST_TOKEN==',
    testIv: 'TEST_IV_BASE64==',
    hasSecondaryPassword: true,
    lockTimeoutMinutes: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const mockEncryptedItems = [
    { id: 'item-001', ciphertext: 'ENCRYPTED_PAYLOAD_1==', iv: 'IV_1==', updatedAt: new Date().toISOString() },
    { id: 'item-002', ciphertext: 'ENCRYPTED_PAYLOAD_2==', iv: 'IV_2==', updatedAt: new Date().toISOString() }
  ];

  // 推送 Push
  const pushRes = await makeRequest(
    {
      host: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/sync/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: tokenCookie
      }
    },
    {
      vaultMeta: mockVaultMeta,
      encryptedItems: mockEncryptedItems,
      deviceName: 'Test-Node-Runner',
      clientVersion: 1
    }
  );
  assert.strictEqual(pushRes.status, 200);
  assert.strictEqual(pushRes.body.success, true);
  assert.strictEqual(pushRes.body.itemsCount, 2);

  // 第二次推送前会自动生成 v2 历史快照；版本锁允许基于 v2 的设备更新。
  const updatedMockItems = [
    ...mockEncryptedItems,
    { id: 'item-003', ciphertext: 'ENCRYPTED_PAYLOAD_3==', iv: 'IV_3==', updatedAt: new Date().toISOString() }
  ];
  const secondPush = await makeRequest(
    {
      host: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/sync/push',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie }
    },
    { vaultMeta: mockVaultMeta, encryptedItems: updatedMockItems, deviceName: 'Second-Device', clientVersion: 2 }
  );
  assert.strictEqual(secondPush.status, 200);
  assert.strictEqual(secondPush.body.version, 3);

  // 旧设备基于 v2 的覆盖请求必须被拒绝，避免误操作抹掉新数据。
  const stalePush = await makeRequest(
    {
      host: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/sync/push',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie }
    },
    { vaultMeta: mockVaultMeta, encryptedItems: mockEncryptedItems, deviceName: 'Stale-Device', clientVersion: 2 }
  );
  assert.strictEqual(stalePush.status, 409);
  assert.strictEqual(stalePush.body.code, 'VERSION_CONFLICT');

  // 状态 Status
  const statusRes = await makeRequest({
    host: '127.0.0.1',
    port: TEST_PORT,
    path: '/api/sync/status',
    method: 'GET',
    headers: { Cookie: tokenCookie }
  });
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusRes.body.itemsCount, 3);
  assert.strictEqual(statusRes.body.hasData, true);
  assert.strictEqual(statusRes.body.version, 3);
  assert.strictEqual(statusRes.body.backupCount, 1);

  // 历史快照列表与回滚：回滚前再保护当前 v3，回滚后生成新版本 v4。
  const backupsRes = await makeRequest({
    host: '127.0.0.1',
    port: TEST_PORT,
    path: '/api/sync/backups',
    method: 'GET',
    headers: { Cookie: tokenCookie }
  });
  assert.strictEqual(backupsRes.status, 200);
  assert.strictEqual(backupsRes.body.backups.length, 1);
  assert.strictEqual(backupsRes.body.backups[0].version, 2);

  const rollbackRes = await makeRequest(
    {
      host: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/sync/rollback',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: tokenCookie }
    },
    { snapshotId: backupsRes.body.backups[0].id, expectedVersion: 3, deviceName: 'Test-Node-Runner' }
  );
  assert.strictEqual(rollbackRes.status, 200);
  assert.strictEqual(rollbackRes.body.version, 4);

  // 拉取 Pull
  const pullRes = await makeRequest({
    host: '127.0.0.1',
    port: TEST_PORT,
    path: '/api/sync/pull',
    method: 'GET',
    headers: { Cookie: tokenCookie }
  });
  assert.strictEqual(pullRes.status, 200);
  assert.strictEqual(pullRes.body.success, true);
  assert.strictEqual(pullRes.body.vaultMeta.testCipher, 'CIPHER_TEST_TOKEN==');
  assert.strictEqual(pullRes.body.version, 4);
  assert.strictEqual(pullRes.body.encryptedItems.length, 2);
  assert.strictEqual(pullRes.body.encryptedItems[0].ciphertext, 'ENCRYPTED_PAYLOAD_1==');

  // 未授权拉取应被阻断
  const unauthPull = await makeRequest({
    host: '127.0.0.1',
    port: TEST_PORT,
    path: '/api/sync/pull',
    method: 'GET'
  });
  assert.strictEqual(unauthPull.status, 401, '未携带 Token 应被阻断 401');

  // 清理临时测试数据
  try {
    if (fs.existsSync(TEST_DATA_DIR)) fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}

  console.log('  ✓ 加密金库推送、状态查询、拉取与权限防越权校验 100% 通过！');
  console.log('\n🎉 极空间 NAS 零知识同步服务端与 GitHub 更新检测单元测试全部顺利通过！\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
