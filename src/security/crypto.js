import crypto from 'node:crypto';
import config from '../config/index.js';

/**
 * @file 用于加密敏感保险箱字段的 AES-256-GCM 辅助工具。
 *
 * 与原始 Java `AesUtil` 逐字节兼容：
 * - 密钥为已配置 secret 的 UTF-8 字节，并以零填充或
 *   截断为恰好 32 字节（等价于 `Arrays.copyOf(raw, 32)`）。
 * - 每次加密都会生成新的随机 12 字节 IV。
 * - GCM 认证标签为 128 位（16 字节）。
 * - 存储的载荷为 `Base64(IV[12] || ciphertext || tag[16])`。
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ALGORITHM = 'aes-256-gcm';

/**
 * 从 secret 字符串派生 32 字节 AES 密钥。
 *
 * @param {string} secret - 原始 secret 字符串。
 * @returns {Buffer} 32 字节密钥缓冲区。
 */
function deriveKey(secret) {
  const key = Buffer.alloc(KEY_LENGTH);
  Buffer.from(secret, 'utf8').copy(key);
  return key;
}

const KEY = deriveKey(config.crypto.secret);

/**
 * 加密明文字符串。
 *
 * @param {string | null | undefined} plainText - 要加密的文本。
 * @returns {string | null} Base64 载荷；输入为 null/undefined 时返回 null。
 */
export function encrypt(plainText) {
  if (plainText === null || plainText === undefined) {
    return null;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * 解密由 {@link encrypt} 生成的 Base64 载荷。
 *
 * @param {string | null | undefined} cipherText - Base64 载荷。
 * @returns {string | null} 解密后的明文；输入为 null/undefined 时返回 null。
 * @throws {Error} 载荷格式错误或认证失败时抛出。
 */
export function decrypt(cipherText) {
  if (cipherText === null || cipherText === undefined) {
    return null;
  }
  const raw = Buffer.from(String(cipherText), 'base64');
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('密文格式不正确');
  }
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(raw.length - TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export default { encrypt, decrypt };
