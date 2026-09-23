import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser } from '../../helpers/db.js';
import { UserSessionRepository } from '../../../src/repositories/userSessionRepository.js';

/**
 * @file 用户会话仓储集成测试。
 */

let db;
let repository;
let user;
let otherUser;

beforeEach(() => {
  db = createTestDatabase();
  repository = new UserSessionRepository(db);
  user = insertUser(db, { username: 'session-user' });
  otherUser = insertUser(db, { username: 'other-session-user' });
});

test('insert 使用可选字段默认值并支持按 jti 查询', () => {
  const session = repository.insert({ userId: user.id, jti: 'jti-defaults' });

  assert.equal(session.userId, user.id);
  assert.equal(session.jti, 'jti-defaults');
  assert.equal(session.deviceInfo, null);
  assert.equal(session.ip, null);
  assert.equal(session.active, true);
  assert.equal(repository.findByJti('jti-defaults').id, session.id);
  assert.equal(repository.findByJti('missing-jti'), null);
});

test('findActiveByUser 仅返回活跃会话并按创建时间与 id 升序', () => {
  const newest = repository.insert({
    userId: user.id,
    jti: 'newest',
    deviceInfo: 'Chrome',
    ip: '127.0.0.1',
  });
  const oldest = repository.insert({ userId: user.id, jti: 'oldest' });
  const sameTimeLaterId = repository.insert({ userId: user.id, jti: 'same-time' });
  repository.insert({ userId: otherUser.id, jti: 'other-user' });
  repository.deactivateByJti('newest');
  db.prepare('UPDATE user_sessions SET created_at = ? WHERE id = ?').run(
    '2024-02-01 00:00:00',
    newest.id
  );
  db.prepare('UPDATE user_sessions SET created_at = ? WHERE id = ?').run(
    '2024-01-01 00:00:00',
    oldest.id
  );
  db.prepare('UPDATE user_sessions SET created_at = ? WHERE id = ?').run(
    '2024-01-01 00:00:00',
    sameTimeLaterId.id
  );

  assert.deepEqual(
    repository.findActiveByUser(user.id).map((session) => session.jti),
    ['oldest', 'same-time']
  );
  assert.equal(repository.findByJti('newest').active, false);
});

test('touch 刷新活跃时间且重复 jti 触发唯一约束', () => {
  const session = repository.insert({ userId: user.id, jti: 'touch-me' });
  db.prepare('UPDATE user_sessions SET last_active_at = ? WHERE id = ?').run(
    '2000-01-01 00:00:00',
    session.id
  );

  repository.touch('touch-me');
  assert.notEqual(repository.findByJti('touch-me').lastActiveAt, '2000-01-01 00:00:00');
  assert.doesNotThrow(() => repository.touch('missing-jti'));
  assert.throws(
    () => repository.insert({ userId: user.id, jti: 'touch-me' }),
    /UNIQUE constraint failed/
  );
});

test('deactivateByJti 与 deactivateAllByUser 返回准确变更结果', () => {
  repository.insert({ userId: user.id, jti: 'one' });
  repository.insert({ userId: user.id, jti: 'two' });
  repository.insert({ userId: otherUser.id, jti: 'three' });

  assert.equal(repository.deactivateByJti('one'), true);
  assert.equal(repository.deactivateByJti('missing'), false);
  assert.equal(repository.deactivateAllByUser(user.id), 1);
  assert.equal(repository.deactivateAllByUser(user.id), 0);
  assert.deepEqual(repository.findActiveByUser(user.id), []);
  assert.deepEqual(
    repository.findActiveByUser(otherUser.id).map((session) => session.jti),
    ['three']
  );
});
