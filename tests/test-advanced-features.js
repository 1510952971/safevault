/**
 * SafeVault 成熟密码管理套件单元测试
 * 涵盖：
 * 1. 自定义扩展安全字段加解密往返测试 (Custom Fields AES-GCM-256 Round-Trip)
 * 2. 密码修改历史版本轮转测试 (Password Revision History FIFO max 10)
 * 3. 废纸篓软删除、隔离与一键恢复机制 (Recycle Bin & Restore & Audit Exclusion)
 * 4. 零知识加密隔离测试 (Zero-Knowledge Ciphertext Verification)
 */
import assert from 'node:assert';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const PBKDF2_ITERATIONS = 100000;

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function base64ToBuffer(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function deriveMasterKey(password, salt) {
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

async function encryptVaultItem(masterKey, itemData, existingId) {
  const id = existingId || 'vault-' + Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();

  const payload = {
    username: itemData.username,
    password: itemData.password,
    website: itemData.website,
    notes: itemData.notes,
    totpSecret: itemData.totpSecret,
    customFields: itemData.customFields,
    passwordHistory: itemData.passwordHistory,
    isDeleted: itemData.isDeleted,
    deletedAt: itemData.deletedAt
  };

  const payloadString = JSON.stringify(payload);
  const payloadBytes = textEncoder.encode(payloadString);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    payloadBytes
  );

  return {
    id,
    title: itemData.title,
    category: itemData.category,
    cipherText: bufferToBase64(new Uint8Array(cipherBuffer)),
    iv: bufferToBase64(iv),
    createdAt: itemData.createdAt || now,
    updatedAt: now,
    isFavorite: itemData.isFavorite
  };
}

async function decryptVaultItem(masterKey, encryptedItem) {
  const iv = base64ToBuffer(encryptedItem.iv);
  const cipherBytes = base64ToBuffer(encryptedItem.cipherText);

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    cipherBytes
  );

  const payloadString = textDecoder.decode(decryptedBuffer);
  const payload = JSON.parse(payloadString);

  return {
    id: encryptedItem.id,
    title: encryptedItem.title,
    category: encryptedItem.category,
    username: payload.username,
    password: payload.password,
    website: payload.website,
    notes: payload.notes,
    totpSecret: payload.totpSecret,
    customFields: payload.customFields,
    passwordHistory: payload.passwordHistory,
    isDeleted: payload.isDeleted,
    deletedAt: payload.deletedAt,
    isFavorite: encryptedItem.isFavorite,
    createdAt: encryptedItem.createdAt,
    updatedAt: encryptedItem.updatedAt
  };
}

function mockAudit(items) {
  const activeItems = items.filter((i) => !i.isDeleted);
  const weakItems = activeItems.filter((i) => i.password.length < 8);
  return {
    totalActive: activeItems.length,
    weakCount: weakItems.length
  };
}

async function runTests() {
  console.log('--- 开始成熟密码管理高级功能单元测试 ---');

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const masterKey = await deriveMasterKey('SafePassphrase#2026', salt);

  // 1. 自定义扩展安全字段加解密往返测试
  console.log('[1/4] 测试自定义安全键值对扩展字段 (AES-GCM-256 加密与解密)...');
  const customFieldsData = [
    { id: 'f-1', label: '安全取款 PIN', value: '984211', isMasked: true },
    { id: 'f-2', label: '紧急恢复助记词', value: 'apple banana orange grape', isMasked: true },
    { id: 'f-3', label: 'API 授权 Token', value: 'sk_live_99a8b7c6d5e4', isMasked: false }
  ];

  const itemWithCustomFields = {
    title: '银行金融金库',
    category: 'finance',
    username: 'finance_master',
    password: 'MasterSecretPass999!',
    website: 'https://bank.example.com',
    notes: '核心财务凭据',
    customFields: customFieldsData
  };

  const encryptedItem = await encryptVaultItem(masterKey, itemWithCustomFields);
  assert.strictEqual(typeof encryptedItem.cipherText, 'string');
  assert.strictEqual(typeof encryptedItem.iv, 'string');

  const decryptedItem = await decryptVaultItem(masterKey, encryptedItem);
  assert.strictEqual(decryptedItem.title, '银行金融金库');
  assert.strictEqual(decryptedItem.customFields?.length, 3);
  assert.strictEqual(decryptedItem.customFields[0].label, '安全取款 PIN');
  assert.strictEqual(decryptedItem.customFields[0].value, '984211');
  assert.strictEqual(decryptedItem.customFields[0].isMasked, true);
  assert.strictEqual(decryptedItem.customFields[2].value, 'sk_live_99a8b7c6d5e4');
  console.log('  -> 验证通过：自定义扩展安全字段加解密往返无损一致');

  // 2. 密码修改历史归档与 FIFO 最多 10 条轮转测试
  console.log('[2/4] 测试密码修改历史追踪与容量上限轮转 (FIFO Max 10)...');
  let currentPassword = 'Password_v1';
  let history = [];

  for (let version = 2; version <= 15; version++) {
    const newPassword = `Password_v${version}`;
    const newEntry = {
      password: currentPassword,
      changedAt: new Date(Date.now() - (15 - version) * 60000).toISOString()
    };
    history = [newEntry, ...history].slice(0, 10);
    currentPassword = newPassword;
  }

  assert.strictEqual(history.length, 10, '历史记录容量必须被精准限制为 10 条');
  assert.strictEqual(history[0].password, 'Password_v14', '最新历史应为上一版本 (v14)');
  assert.strictEqual(history[9].password, 'Password_v5', '最旧历史应为第 10 个有效版本 (v5)');

  // 加密并解密带历史记录的条目
  const itemWithHistory = {
    title: '服务器运维账号',
    category: 'work',
    username: 'root',
    password: currentPassword,
    passwordHistory: history
  };

  const encHist = await encryptVaultItem(masterKey, itemWithHistory);
  const decHist = await decryptVaultItem(masterKey, encHist);
  assert.strictEqual(decHist.passwordHistory?.length, 10);
  assert.strictEqual(decHist.passwordHistory[0].password, 'Password_v14');
  console.log('  -> 验证通过：密码修改历史记录自动归档并精准保留最新 10 条');

  // 3. 废纸篓软删除、安全隔离与一键恢复机制
  console.log('[3/4] 测试废纸篓软删除、安全隔离与恢复机制...');
  const testItems = [
    { id: '1', title: '正常凭据 A', username: 'userA', password: 'SafePassword123!', category: 'work', isDeleted: false },
    { id: '2', title: '弱密码凭据 B', username: 'userB', password: '123', category: 'social', isDeleted: false }
  ];

  let initialAudit = mockAudit(testItems);
  assert.strictEqual(initialAudit.totalActive, 2);
  assert.strictEqual(initialAudit.weakCount, 1);

  // 软删除条目 2 (移至废纸篓)
  testItems[1].isDeleted = true;
  testItems[1].deletedAt = new Date().toISOString();

  let trashAudit = mockAudit(testItems);
  assert.strictEqual(trashAudit.totalActive, 1, '已删除凭据必须从活跃统计中隔离');
  assert.strictEqual(trashAudit.weakCount, 0, '已删除的弱密码凭据不得污染安全审计指标');

  // 一键恢复条目 2
  testItems[1].isDeleted = false;
  testItems[1].deletedAt = undefined;

  let restoredAudit = mockAudit(testItems);
  assert.strictEqual(restoredAudit.totalActive, 2, '恢复后凭据重回活跃金库');
  assert.strictEqual(restoredAudit.weakCount, 1, '恢复后审计恢复原状');
  console.log('  -> 验证通过：废纸篓隔离生效，软删除与一键恢复运作完美');

  // 4. 零知识端到端加密验证
  console.log('[4/4] 测试零知识端到端加密防护 (敏感字段不得泄露在明文外壳)...');
  const rawOuterKeys = Object.keys(encryptedItem);
  assert.ok(!rawOuterKeys.includes('customFields'), '外壳绝对不能出现明文 customFields');
  assert.ok(!rawOuterKeys.includes('passwordHistory'), '外壳绝对不能出现明文 passwordHistory');
  assert.ok(!rawOuterKeys.includes('password'), '外壳绝对不能出现明文 password');
  assert.ok(!rawOuterKeys.includes('username'), '外壳绝对不能出现明文 username');
  console.log('  -> 验证通过：自定义字段与历史记录皆深藏于 AES-GCM 密文载荷中');

  console.log('--- 全部高级密码管理功能单元测试顺利通过！---');
}

runTests().catch((err) => {
  console.error('高级功能测试异常:', err);
  process.exit(1);
});
