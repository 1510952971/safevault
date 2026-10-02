/**
 * SafeVault v2/v3 安全边界回归测试：
 * - 主密码只解包随机金库数据密钥（DEK）
 * - 服务器可见的条目外壳不包含标题、网址或敏感字段
 * - 错误密码、篡改密文、篡改条目标识均必须失败
 *
 * 这是协议级测试，不依赖浏览器 window，因此可在 CI/NAS 构建阶段直接执行。
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const cryptoApi = webcrypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 600000;
const WRAP_AAD = encoder.encode('SafeVault:VaultKey:Wrap:v2');

function b64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function fromB64(value) {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function deriveKek(password, salt) {
  const material = await cryptoApi.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function createVaultEnvelope(password, record) {
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const kek = await deriveKek(password, salt);
  const rawVaultKey = cryptoApi.getRandomValues(new Uint8Array(32));
  const wrapIv = cryptoApi.getRandomValues(new Uint8Array(12));
  const wrapped = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: wrapIv, additionalData: WRAP_AAD },
    kek,
    rawVaultKey
  );
  const vaultKey = await cryptoApi.subtle.importKey(
    'raw',
    rawVaultKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const id = '3a6f7d77-6e52-4ec4-9de3-37f9f0ca0fd9';
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const payload = { id, ...record, createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z' };
  const encryptedPayload = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(`SafeVault:VaultItem:v3:${id}`) },
    vaultKey,
    encoder.encode(JSON.stringify(payload))
  );

  return {
    meta: {
      version: '2.0',
      keyEnvelopeVersion: 2,
      salt: b64(salt),
      wrappedVaultKey: b64(new Uint8Array(wrapped)),
      wrappedVaultKeyIv: b64(wrapIv)
    },
    item: {
      encryptionVersion: 3,
      id,
      encryptedPayload: b64(new Uint8Array(encryptedPayload)),
      iv: b64(iv)
    }
  };
}

async function unwrapVaultKey(password, meta) {
  const kek = await deriveKek(password, fromB64(meta.salt));
  const raw = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(meta.wrappedVaultKeyIv), additionalData: WRAP_AAD },
    kek,
    fromB64(meta.wrappedVaultKey)
  );
  return cryptoApi.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptItem(vaultKey, item) {
  const plaintext = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(item.iv), additionalData: encoder.encode(`SafeVault:VaultItem:v3:${item.id}`) },
    vaultKey,
    fromB64(item.encryptedPayload)
  );
  return JSON.parse(decoder.decode(plaintext));
}

async function runTests() {
  console.log('--- 开始 SafeVault v2/v3 零知识安全边界测试 ---');
  const record = {
    title: '金融账户',
    category: 'finance',
    username: 'finance@example.test',
    password: 'Never-logged-Secret-2026!',
    website: 'https://bank.example.test/login',
    notes: '只有客户端解锁后可见',
    tags: ['重要'],
    isFavorite: true
  };
  const envelope = await createVaultEnvelope('Correct horse battery staple #2026', record);

  assert.deepEqual(Object.keys(envelope.item).sort(), ['encryptedPayload', 'encryptionVersion', 'id', 'iv']);
  assert.ok(!envelope.item.encryptedPayload.includes('金融账户'));
  assert.ok(!JSON.stringify(envelope.item).includes(record.username));
  assert.ok(!JSON.stringify(envelope.item).includes(record.website));
  console.log('  ✓ v3 条目外壳不泄露标题、网址、用户名或密码');

  const vaultKey = await unwrapVaultKey('Correct horse battery staple #2026', envelope.meta);
  const decrypted = await decryptItem(vaultKey, envelope.item);
  assert.equal(decrypted.title, record.title);
  assert.equal(decrypted.password, record.password);
  assert.equal(decrypted.website, record.website);
  console.log('  ✓ 正确主密码可解包 DEK 并还原完整记录');

  await assert.rejects(
    () => unwrapVaultKey('Wrong password', envelope.meta),
    /OperationError|InvalidAccessError|operation/i
  );
  console.log('  ✓ 忘记主密码/输入错误时无法恢复 DEK');

  const tampered = { ...envelope.item, encryptedPayload: `${envelope.item.encryptedPayload.slice(0, -2)}AA` };
  await assert.rejects(() => decryptItem(vaultKey, tampered));
  await assert.rejects(() => decryptItem(vaultKey, { ...envelope.item, id: 'different-random-id' }));
  console.log('  ✓ AES-GCM 密文或条目标识被篡改时均被拒绝');

  console.log('🎉 v2/v3 密钥包裹与全记录加密安全边界测试通过！');
}

runTests().catch((error) => {
  console.error('安全边界测试失败:', error);
  process.exitCode = 1;
});
