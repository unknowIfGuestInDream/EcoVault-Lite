import crypto from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import config from '../../../src/config/index.js';
import { generateToken, verifyToken } from '../../../src/security/jwt.js';

/**
 * @file JWT 签发与验签测试。
 */

function signingKey(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

test('generateToken 生成的令牌可还原关键载荷字段', () => {
  const generated = generateToken({ userId: 42, username: 'alice' });
  const claims = verifyToken(generated.token);

  assert.equal(claims.uid, 42);
  assert.equal(claims.sub, 'alice');
  assert.equal(claims.jti, generated.jti);
  assert.equal(typeof claims.iat, 'number');
  assert.equal(typeof claims.exp, 'number');
  assert.ok(generated.issuedAt <= generated.expiresAt);
});

test('verifyToken 拒绝过期令牌', () => {
  const expired = jwt.sign({ uid: 1 }, signingKey(config.jwt.secret), {
    algorithm: 'HS256',
    subject: 'expired-user',
    jwtid: 'expired-token',
    expiresIn: -1,
  });

  assert.throws(() => verifyToken(expired), /jwt expired/);
});

test('verifyToken 拒绝被篡改的令牌', () => {
  const { token } = generateToken({ userId: 7, username: 'bob' });
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ uid: 8, sub: 'bob' })).toString('base64url');
  const tampered = [parts[0], tamperedPayload, parts[2]].join('.');

  assert.throws(() => verifyToken(tampered), /invalid signature/);
});

test('verifyToken 拒绝使用错误密钥签名的令牌', () => {
  const wrongSecretToken = jwt.sign({ uid: 3 }, signingKey('错误密钥'), {
    algorithm: 'HS256',
    subject: 'mallory',
    jwtid: 'wrong-secret',
    expiresIn: '1h',
  });

  assert.throws(() => verifyToken(wrongSecretToken), /invalid signature/);
});
