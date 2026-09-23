import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt } from '../../../src/security/crypto.js';

/**
 * @file AES-256-GCM 加解密辅助工具测试。
 */

test('encrypt 对 null 与 undefined 透传为 null', () => {
  assert.equal(encrypt(null), null);
  assert.equal(encrypt(undefined), null);
});

test('encrypt 与 decrypt 可以完成明文往返', () => {
  const cipherText = encrypt('保险箱密码-123');

  assert.equal(decrypt(cipherText), '保险箱密码-123');
});

test('相同明文每次生成不同密文且均可解密', () => {
  const first = encrypt('同一段敏感字段');
  const second = encrypt('同一段敏感字段');

  assert.notEqual(first, second);
  assert.equal(decrypt(first), '同一段敏感字段');
  assert.equal(decrypt(second), '同一段敏感字段');
});

test('decrypt 对 null 与 undefined 透传为 null', () => {
  assert.equal(decrypt(null), null);
  assert.equal(decrypt(undefined), null);
});

test('decrypt 拒绝长度不足的密文载荷', () => {
  const tooShort = Buffer.alloc(27).toString('base64');

  assert.throws(() => decrypt(tooShort), /密文格式不正确/);
});

test('decrypt 拒绝被篡改的 GCM 密文', () => {
  const raw = Buffer.from(encrypt('不可篡改'), 'base64');
  raw[raw.length - 1] ^= 1;
  const tampered = raw.toString('base64');

  assert.throws(() => decrypt(tampered));
});
