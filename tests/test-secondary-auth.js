/**
 * SafeVault 二级独立安全密码单元测试套件
 */
import assert from 'node:assert';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PBKDF2_ITERATIONS = 600000;
const SECONDARY_TOKEN_CONST = 'SAFEVAULT_SECONDARY_AUTH_VERIFIED_TOKEN';

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function base64ToBuffer(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function deriveKey(password, salt) {
  const passwordBuffer = textEncoder.encode(password);
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function setupSecondaryPassword(secondaryPassword) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(secondaryPassword, salt);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const tokenBytes = textEncoder.encode(SECONDARY_TOKEN_CONST);

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    tokenBytes
  );

  return {
    secondarySalt: bufferToBase64(salt),
    secondaryTestCipher: bufferToBase64(new Uint8Array(cipherBuffer)),
    secondaryTestIv: bufferToBase64(iv)
  };
}

async function verifySecondaryPassword(secondaryPassword, meta) {
  if (!meta.hasSecondaryPassword || !meta.secondarySalt || !meta.secondaryTestCipher || !meta.secondaryTestIv) {
    return true;
  }

  try {
    const salt = base64ToBuffer(meta.secondarySalt);
    const testIv = base64ToBuffer(meta.secondaryTestIv);
    const testCipher = base64ToBuffer(meta.secondaryTestCipher);

    const key = await deriveKey(secondaryPassword, salt);
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: testIv },
      key,
      testCipher
    );

    const decryptedText = textDecoder.decode(decryptedBuffer);
    return decryptedText === SECONDARY_TOKEN_CONST;
  } catch (_err) {
    return false;
  }
}

async function runTests() {
  console.log('--- 开始二级安全密码密码学单元测试 ---');

  // 测试 1: 二级密码初始化与有效性验证
  console.log('[1/4] 测试二级密码特征加密与正确密码核验...');
  const secPass = 'Sec#PIN-8899';
  const setupRes = await setupSecondaryPassword(secPass);

  const mockMeta = {
    hasSecondaryPassword: true,
    secondarySalt: setupRes.secondarySalt,
    secondaryTestCipher: setupRes.secondaryTestCipher,
    secondaryTestIv: setupRes.secondaryTestIv
  };

  const verifyValid = await verifySecondaryPassword(secPass, mockMeta);
  assert.strictEqual(verifyValid, true, '正确二级密码必须验证通过');
  console.log('  ✓ 正确二级密码验证成功');

  // 测试 2: 错误二级密码认证阻断 (AEAD Tag 校验)
  console.log('[2/4] 测试错误二级密码认证阻断...');
  const verifyWrong = await verifySecondaryPassword('WrongPass123', mockMeta);
  assert.strictEqual(verifyWrong, false, '错误二级密码必须被拒绝');
  console.log('  ✓ 错误二级密码触发 AEAD 认证阻断，防护成功');

  // 测试 3: 修改二级密码验证
  console.log('[3/4] 测试修改二级密码后旧密码失效与新密码生效...');
  const newSecPass = 'New#PIN-2026';
  const newSetupRes = await setupSecondaryPassword(newSecPass);
  const updatedMeta = {
    ...mockMeta,
    secondarySalt: newSetupRes.secondarySalt,
    secondaryTestCipher: newSetupRes.secondaryTestCipher,
    secondaryTestIv: newSetupRes.secondaryTestIv
  };

  const verifyOld = await verifySecondaryPassword(secPass, updatedMeta);
  assert.strictEqual(verifyOld, false, '修改后旧二级密码必须失效');

  const verifyNew = await verifySecondaryPassword(newSecPass, updatedMeta);
  assert.strictEqual(verifyNew, true, '修改后新二级密码必须验证通过');
  console.log('  ✓ 修改二级密码新旧状态切换成功');

  // 测试 4: 停用二级密码时的无阻断兼容性
  console.log('[4/4] 测试未启用二级密码时的放行兼容性...');
  const disabledMeta = { hasSecondaryPassword: false };
  const verifyDisabled = await verifySecondaryPassword('AnyPass', disabledMeta);
  assert.strictEqual(verifyDisabled, true, '未启用二级密码时应当默认放行');
  console.log('  ✓ 未启用状态兼容性测试通过');

  console.log('\n🎉 所有二级独立安全密码单元测试 100% 通过！');
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
