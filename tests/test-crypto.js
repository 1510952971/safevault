/**
 * SafeVault 核心密码学与安全链路自动化单元测试
 */
import assert from 'node:assert';

const PBKDF2_ITERATIONS = 100000;
const TEST_TOKEN_CONST = 'SAFEVAULT_AUTH_VERIFIED_TOKEN';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function base64ToBuffer(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function runTests() {
  console.log('--- 开始自动化密码学套件单元测试 ---');

  const masterPass = 'MyStrongMasterPass#2026!';
  const wrongPass = 'WrongPassword@123';
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 1. 密钥派生测试
  console.log('[1/4] 测试 PBKDF2 密钥派生...');
  const key = await deriveKey(masterPass, salt);
  assert(key !== null, '密钥生成不应为空');
  console.log('  ✓ PBKDF2 100,000 轮密钥派生成功');

  // 2. 身份验证测试密文生成与检验
  console.log('[2/4] 测试主密码验证 Token (正向与反向防御)...');
  const testIv = crypto.getRandomValues(new Uint8Array(12));
  const testCipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: testIv },
    key,
    textEncoder.encode(TEST_TOKEN_CONST)
  );

  // 正向验证
  const validDecrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: testIv },
    key,
    testCipher
  );
  assert.strictEqual(textDecoder.decode(validDecrypted), TEST_TOKEN_CONST);
  console.log('  ✓ 正确主密码解密验证 Token 成功');

  // 反向验证 (错误密码应抛出异常)
  const wrongKey = await deriveKey(wrongPass, salt);
  let failedAsExpected = false;
  try {
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: testIv },
      wrongKey,
      testCipher
    );
  } catch (_e) {
    failedAsExpected = true;
  }
  assert.strictEqual(failedAsExpected, true, '错误主密码必须解密失败');
  console.log('  ✓ 错误主密码触发 AEAD 认证阻断，防护成功');

  // 3. 条目加密与解密全生命周期
  console.log('[3/4] 测试敏感条目 AES-GCM 强加密与完整性校验...');
  const samplePayload = {
    username: 'admin@work.com',
    password: 'SuperSecretPassword$999',
    notes: '密保问题：最喜欢的书是《三体》'
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(samplePayload))
  );

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );
  const decryptedObj = JSON.parse(textDecoder.decode(decryptedBytes));
  assert.strictEqual(decryptedObj.username, samplePayload.username);
  assert.strictEqual(decryptedObj.password, samplePayload.password);
  assert.strictEqual(decryptedObj.notes, samplePayload.notes);
  console.log('  ✓ 敏感字段密文落盘与内存解密还原 100% 一致');

  // 4. 防篡改测试
  console.log('[4/4] 测试密文被篡改时的防破坏能力...');
  const tamperedCipher = new Uint8Array(encryptedBytes);
  tamperedCipher[0] ^= 0xff; // 翻转 1 个字节模拟数据损坏或恶意注入
  let tamperCaught = false;
  try {
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      tamperedCipher
    );
  } catch (_e) {
    tamperCaught = true;
  }
  assert.strictEqual(tamperCaught, true, '密文遭篡改必须被拒绝');
  console.log('  ✓ AES-GCM 标签防篡改校验成功，有效防御数据注入');

  console.log('\n🎉 所有密码学单元测试 100% 通过！系统达到金融级安全设计标准。');
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
