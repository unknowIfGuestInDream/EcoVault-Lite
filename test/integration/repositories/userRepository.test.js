import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../helpers/db.js';
import { UserRepository } from '../../../src/repositories/userRepository.js';

/**
 * @file 用户仓储集成测试。
 */

let db;
let repository;

beforeEach(() => {
  db = createTestDatabase();
  repository = new UserRepository(db);
});

test('insert 使用默认值并支持按 id、用户名与存在性查询', () => {
  const user = repository.insert({ username: 'alice', password: 'hash-a', role: 'USER' });

  assert.equal(user.username, 'alice');
  assert.equal(user.nickname, null);
  assert.equal(user.email, null);
  assert.equal(user.enabled, true);
  assert.equal(repository.findById(user.id).id, user.id);
  assert.equal(repository.findByUsername('alice').id, user.id);
  assert.equal(repository.findById(404), null);
  assert.equal(repository.findByUsername('missing'), null);
  assert.equal(repository.existsByUsername('alice'), true);
  assert.equal(repository.existsByUsername('missing'), false);
  assert.equal(repository.count(), 1);
});

test('findAll 按 id 升序返回且唯一用户名约束生效', () => {
  const first = repository.insert({ username: 'first', password: 'hash-1', role: 'USER' });
  const second = repository.insert({
    username: 'second',
    password: 'hash-2',
    nickname: '管理员',
    email: 'admin@example.com',
    role: 'ADMIN',
    enabled: false,
  });

  assert.deepEqual(
    repository.findAll().map((user) => user.id),
    [first.id, second.id]
  );
  assert.equal(repository.findById(second.id).enabled, false);
  assert.throws(
    () => repository.insert({ username: 'first', password: 'again', role: 'USER' }),
    /UNIQUE constraint failed/
  );
});

test('update 合并可选字段并处理不存在用户', () => {
  const user = repository.insert({
    username: 'editor',
    password: 'old-hash',
    nickname: '旧昵称',
    email: 'old@example.com',
    role: 'USER',
  });

  const disabled = repository.update(user.id, {
    nickname: '新昵称',
    email: null,
    role: 'ADMIN',
    enabled: false,
    password: 'new-hash',
  });
  assert.equal(disabled.nickname, '新昵称');
  assert.equal(disabled.email, null);
  assert.equal(disabled.role, 'ADMIN');
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.password, 'new-hash');

  const keptDisabled = repository.update(user.id, {});
  assert.equal(keptDisabled.enabled, false);
  assert.equal(keptDisabled.nickname, '新昵称');

  const enabled = repository.update(user.id, { enabled: true });
  assert.equal(enabled.enabled, true);
  const keptEnabled = repository.update(user.id, {});
  assert.equal(keptEnabled.enabled, true);
  assert.equal(repository.update(999, { nickname: '不存在' }), null);
});

test('deleteById 返回删除结果并移除用户', () => {
  const user = repository.insert({ username: 'delete-me', password: 'hash', role: 'USER' });

  assert.equal(repository.deleteById(user.id), true);
  assert.equal(repository.findById(user.id), null);
  assert.equal(repository.deleteById(user.id), false);
});
