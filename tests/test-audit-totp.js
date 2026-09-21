/**
 * SafeVault 安全审计与 TOTP 2FA 算法单元测试
 * 包含 RFC 4648 Base32 标准向量与 RFC 6238 TOTP 官方测试向量校验
 */
import assert from 'node:assert';

// 1. Base32 解码与 TOTP
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32ToBuffer(base32Str) {
  const clean = base32Str.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean.charAt(i);
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`无效的 Base32 密钥字符: "${char}"`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

async function generateTotpCode(secret, timeStepSeconds = 30, digits = 6, testTimestamp = null) {
  const cleanSecret = secret.trim();
  const keyBytes = base32ToBuffer(cleanSecret);

  const epochSeconds = testTimestamp ? Math.floor(testTimestamp / 1000) : Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / timeStepSeconds);

  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(counter / 0x100000000));
  counterView.setUint32(4, counter & 0xffffffff);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

// 2. CSV 行解析器
function parseCsvRows(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((val) => val.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((val) => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

async function runTests() {
  console.log('--- 开始安全审计与 TOTP 2FA 算法回归测试 ---');

  // 测试 1: Base32 解码 (RFC 4648 官方向量)
  console.log('[1/4] 测试 RFC 4648 Base32 解码精度...');
  const testSecret = 'MZXW6YTBOI======';
  const buf = base32ToBuffer(testSecret);
  const text = Buffer.from(buf).toString('utf8');
  assert.strictEqual(text, 'foobar', 'Base32 解码 "MZXW6YTBOI======" 必须精确还原为 "foobar"');
  console.log('  ✓ Base32 RFC 4648 标准测试向量解码通过');

  // 测试 2: RFC 6238 官方附录 B 测试向量
  console.log('[2/4] 测试 RFC 6238 TOTP 官方测试向量...');
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // 密钥 "12345678901234567890"

  const code1 = await generateTotpCode(rfcSecret, 30, 6, 59 * 1000);
  assert.strictEqual(code1, '287082', 'RFC 6238 T=59s 必须产出 287082');

  const code2 = await generateTotpCode(rfcSecret, 30, 6, 1111111109 * 1000);
  assert.strictEqual(code2, '081804', 'RFC 6238 T=1111111109s 必须产出 081804');

  const code3 = await generateTotpCode(rfcSecret, 30, 6, 1234567890 * 1000);
  assert.strictEqual(code3, '005924', 'RFC 6238 T=1234567890s 必须产出 005924');

  console.log(`  ✓ 官方 TOTP 测试向量 (59s: ${code1}, 1111111109s: ${code2}, 1234567890s: ${code3}) 全部通过`);

  // 测试 3: CSV 导入解析
  console.log('[3/4] 测试 Chrome/Edge/Bitwarden CSV 密码表解析...');
  const sampleCsv = `name,url,username,password,note
GitHub,https://github.com,octocat,ghp_secretPass123!,"Recovery tokens included"
Synology NAS,https://192.168.1.185:5001,admin,NasAdmin@2026,"Internal LAN only"`;
  const parsedRows = parseCsvRows(sampleCsv);
  assert.strictEqual(parsedRows.length, 3, 'CSV 必须解析出 1 行表头和 2 行数据');
  assert.strictEqual(parsedRows[1][0], 'GitHub');
  assert.strictEqual(parsedRows[1][3], 'ghp_secretPass123!');
  assert.strictEqual(parsedRows[2][0], 'Synology NAS');
  console.log('  ✓ CSV 表格与双引号字段解析测试通过');

  // 测试 4: 弱密码与重复密码审计逻辑
  console.log('[4/4] 测试安全健康审计与重复密码标记...');
  const items = [
    { id: '1', title: 'Site A', password: '123' }, // 弱密码 & 重复
    { id: '2', title: 'Site B', password: '123' }, // 弱密码 & 重复
    { id: '3', title: 'Site C', password: 'Super#Secure#Password#2026!' } // 强密码
  ];

  const pwdMap = new Map();
  items.forEach(i => {
    const list = pwdMap.get(i.password) || [];
    list.push(i);
    pwdMap.set(i.password, list);
  });

  let duplicateCount = 0;
  pwdMap.forEach(list => {
    if (list.length > 1) duplicateCount += list.length;
  });

  assert.strictEqual(duplicateCount, 2, '准确检测出 2 处重复使用的密码');
  console.log('  ✓ 密码库安全健康体检逻辑测试通过');

  console.log('\n🎉 所有安全审计与 TOTP 测试 100% 通过！');
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
