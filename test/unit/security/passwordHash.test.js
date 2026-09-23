import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../../src/security/passwordHash.js';

/**
 * @file BCrypt 密码哈希辅助工具测试。
 */

test('hashPassword 生成哈希后可验证正确密码并拒绝错误密码', () => {
  const hash = hashPassword('S3cret!');

  assert.notEqual(hash, 'S3cret!');
  assert.equal(verifyPassword('S3cret!', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('verifyPassword 在缺少存储哈希时返回 false', () => {
  assert.equal(verifyPassword('S3cret!', ''), false);
  assert.equal(verifyPassword('S3cret!', null), false);
  assert.equal(verifyPassword('S3cret!', undefined), false);
});

test('verifyPassword 遇到非法哈希参数时捕获异常并返回 false', () => {
  assert.equal(verifyPassword('S3cret!', {}), false);
});
