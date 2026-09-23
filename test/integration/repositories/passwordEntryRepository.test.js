import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser } from '../../helpers/db.js';
import { PasswordEntryRepository } from '../../../src/repositories/passwordEntryRepository.js';

/**
 * @file 密码条目仓储集成测试。
 */

let db;
let repository;
let user;
let otherUser;

beforeEach(() => {
  db = createTestDatabase();
  repository = new PasswordEntryRepository(db);
  user = insertUser(db, { username: 'password-user' });
  otherUser = insertUser(db, { username: 'other-password-user' });
});

test('insert 使用默认值并支持归属查询', () => {
  const entry = repository.insert({ userId: user.id, title: 'GitHub', secret: 'encrypted-secret' });

  assert.equal(entry.title, 'GitHub');
  assert.equal(entry.account, null);
  assert.equal(entry.url, null);
  assert.equal(entry.notes, null);
  assert.equal(entry.category, null);
  assert.equal(entry.tags, null);
  assert.equal(entry.strengthScore, 0);
  assert.equal(entry.strengthLevel, null);
  assert.equal(repository.findByIdAndUser(entry.id, user.id).id, entry.id);
  assert.equal(repository.findByIdAndUser(entry.id, otherUser.id), null);
  assert.equal(repository.findByIdAndUser(404, user.id), null);
});

test('findByUser 按更新时间和 id 降序且隔离其他用户', () => {
  const older = repository.insert({ userId: user.id, title: 'Older', secret: 's1' });
  const sameTimeLowerId = repository.insert({ userId: user.id, title: 'Same A', secret: 's2' });
  const sameTimeHigherId = repository.insert({ userId: user.id, title: 'Same B', secret: 's3' });
  repository.insert({ userId: otherUser.id, title: 'Other', secret: 's4' });
  db.prepare('UPDATE password_entries SET updated_at = ? WHERE id = ?').run(
    '2024-01-01 00:00:00',
    older.id
  );
  db.prepare('UPDATE password_entries SET updated_at = ? WHERE id IN (?, ?)').run(
    '2024-02-01 00:00:00',
    sameTimeLowerId.id,
    sameTimeHigherId.id
  );

  assert.deepEqual(
    repository.findByUser(user.id).map((entry) => entry.title),
    ['Same B', 'Same A', 'Older']
  );
});

test('searchByTitle 不区分大小写并支持无匹配结果', () => {
  const github = repository.insert({ userId: user.id, title: 'GitHub 主账号', secret: 's1' });
  repository.insert({ userId: user.id, title: '邮箱', secret: 's2' });
  repository.insert({ userId: otherUser.id, title: 'github 别人', secret: 's3' });

  assert.deepEqual(
    repository.searchByTitle(user.id, 'GITHUB').map((entry) => entry.id),
    [github.id]
  );
  assert.deepEqual(repository.searchByTitle(user.id, '不存在'), []);
});

test('update 覆盖完整字段并对可选字段使用默认值', () => {
  const entry = repository.insert({ userId: user.id, title: '原始', secret: 'old' });

  const full = repository.update(entry.id, user.id, {
    title: '更新后',
    account: 'alice',
    secret: 'new-secret',
    url: 'https://example.com',
    notes: 'notes',
    category: 'work',
    tags: 'encrypted-tags',
    strengthScore: 95,
    strengthLevel: 'strong',
  });
  assert.equal(full.account, 'alice');
  assert.equal(full.url, 'https://example.com');
  assert.equal(full.strengthScore, 95);
  assert.equal(full.strengthLevel, 'strong');

  const defaults = repository.update(entry.id, user.id, { title: '默认值', secret: 'again' });
  assert.equal(defaults.account, null);
  assert.equal(defaults.url, null);
  assert.equal(defaults.notes, null);
  assert.equal(defaults.category, null);
  assert.equal(defaults.tags, null);
  assert.equal(defaults.strengthScore, 0);
  assert.equal(defaults.strengthLevel, null);
  assert.equal(repository.update(entry.id, otherUser.id, { title: '越权', secret: 'x' }), null);
});

test('deleteByIdAndUser 只删除归属匹配的条目', () => {
  const entry = repository.insert({ userId: user.id, title: '删除', secret: 's' });

  assert.equal(repository.deleteByIdAndUser(entry.id, otherUser.id), false);
  assert.equal(repository.deleteByIdAndUser(entry.id, user.id), true);
  assert.equal(repository.findByIdAndUser(entry.id, user.id), null);
  assert.equal(repository.deleteByIdAndUser(entry.id, user.id), false);
});
