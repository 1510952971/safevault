/**
 * RFC 6238 标准 TOTP 动态双因素身份验证口令生成器
 * 使用 Web Crypto API 原生 SubtleCrypto HMAC-SHA1 实现
 */

// Base32 字符表 (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 字符串解码为 Uint8Array
 */
export function base32ToBuffer(base32Str: string): Uint8Array {
  const clean = base32Str.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

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

/**
 * 校验 TOTP Secret 是否有效
 */
export function isValidTotpSecret(secret: string): boolean {
  if (!secret || secret.trim().length < 8) return false;
  try {
    const buf = base32ToBuffer(secret);
    return buf.length > 0;
  } catch {
    return false;
  }
}

/**
 * 根据 RFC 6238 生成当前 6 位 TOTP 验证码与剩余有效秒数
 */
export async function generateTotpCode(
  secret: string,
  timeStepSeconds: number = 30,
  digits: number = 6
): Promise<{ code: string; secondsRemaining: number; period: number }> {
  const cleanSecret = secret.trim();
  const keyBytes = base32ToBuffer(cleanSecret);

  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / timeStepSeconds);
  const secondsRemaining = timeStepSeconds - (epochSeconds % timeStepSeconds);

  // 计数器转化为 8 字节大端序 Buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(counter / 0x100000000));
  counterView.setUint32(4, counter & 0xffffffff);

  // 导入 HMAC-SHA1 密钥
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // 执行 HMAC 签名
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);

  // RFC 4226 动态截断 (Dynamic Truncation)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  const code = otp.toString().padStart(digits, '0');

  return {
    code,
    secondsRemaining,
    period: timeStepSeconds
  };
}
