import crypto from 'node:crypto';
import config from '../config/index.js';

/**
 * @file AES-256-GCM helpers for encrypting sensitive vault fields.
 *
 * Byte-for-byte compatible with the original Java `AesUtil`:
 * - The key is the UTF-8 bytes of the configured secret, zero-padded or
 *   truncated to exactly 32 bytes (equivalent to `Arrays.copyOf(raw, 32)`).
 * - A fresh random 12-byte IV is generated per encryption.
 * - The GCM authentication tag is 128 bits (16 bytes).
 * - The stored payload is `Base64(IV[12] || ciphertext || tag[16])`.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ALGORITHM = 'aes-256-gcm';

/**
 * Derive the 32-byte AES key from a secret string.
 *
 * @param {string} secret - Raw secret string.
 * @returns {Buffer} 32-byte key buffer.
 */
function deriveKey(secret) {
  const key = Buffer.alloc(KEY_LENGTH);
  Buffer.from(secret, 'utf8').copy(key);
  return key;
}

const KEY = deriveKey(config.crypto.secret);

/**
 * Encrypt a plaintext string.
 *
 * @param {string | null | undefined} plainText - Text to encrypt.
 * @returns {string | null} Base64 payload, or null when the input is null/undefined.
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
 * Decrypt a Base64 payload produced by {@link encrypt}.
 *
 * @param {string | null | undefined} cipherText - Base64 payload.
 * @returns {string | null} Decrypted plaintext, or null when the input is null/undefined.
 * @throws {Error} When the payload is malformed or authentication fails.
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
