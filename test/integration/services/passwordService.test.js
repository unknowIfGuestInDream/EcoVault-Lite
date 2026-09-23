import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';
import { encrypt } from '../../../src/security/crypto.js';
import { MASKED_SECRET } from '../../../src/services/passwordService.js';

/**
 * @file 密码保险箱服务集成测试。
 */

let db;
let repositories;
let passwordService;
let userId;

function passwordRequest(overrides = {}) {
  return {
    title: 'GitHub',
    account: 'octo',
    secret: 'VeryStrong123!',
    url: 'https://github.com',
    notes: '私密备注',
    category: '开发',
    tags: [' 工作 ', '代码', '', null],
    ...overrides,
  };
}

function assertBusiness(fn, message) {
  assert.throws(fn, (error) => error.message === message && error.status === 400);
}

beforeEach(() => {
  ({
    db,
    repositories,
    services: { passwordService },
  } = createTestContext());
  userId = repositories.userRepository.insert({
    username: 'vault-user',
    password: 'hash',
    nickname: '保险箱用户',
    email: null,
    role: 'USER',
    enabled: true,
  }).id;
});

test('create 加密敏感字段并在详情中解密返回', () => {
  const created = passwordService.create(userId, passwordRequest());
  const row = db
    .prepare('SELECT secret, notes, tags FROM password_entries WHERE id = ?')
    .get(created.id);

  assert.equal(created.title, 'GitHub');
  assert.equal(created.secret, 'VeryStrong123!');
  assert.equal(created.notes, '私密备注');
  assert.deepEqual(created.tags, ['工作', '代码']);
  assert.ok(created.strengthScore > 0);
  assert.notEqual(row.secret, 'VeryStrong123!');
  assert.notEqual(row.notes, '私密备注');
  assert.notEqual(row.tags, '工作,代码');
});

test('create 支持空标签、空备注与默认可选字段', () => {
  const created = passwordService.create(
    userId,
    passwordRequest({
      title: '无标签',
      account: undefined,
      url: undefined,
      notes: null,
      category: undefined,
      tags: [],
    })
  );
  const row = db
    .prepare('SELECT account, url, notes, category, tags FROM password_entries WHERE id = ?')
    .get(created.id);

  assert.equal(created.account, null);
  assert.equal(created.url, null);
  assert.equal(created.notes, null);
  assert.equal(created.category, null);
  assert.deepEqual(created.tags, []);
  assert.equal(row.tags, null);

  const invalidOnly = passwordService.create(
    userId,
    passwordRequest({ title: '无有效标签', tags: [undefined, null, '   '] })
  );
  assert.deepEqual(invalidOnly.tags, []);
});

test('list 返回脱敏 secret 并支持标题与标签过滤', () => {
  const github = passwordService.create(userId, passwordRequest({ title: 'GitHub' }));
  passwordService.create(userId, passwordRequest({ title: '邮箱', tags: ['生活'] }));

  const all = passwordService.list(userId, null, undefined);
  const keyword = passwordService.list(userId, ' git ', '工作');
  const noTag = passwordService.list(userId, '', '不存在');

  assert.equal(all.length, 2);
  assert.equal(all[0].secret, MASKED_SECRET);
  assert.equal(all[0].notes, null);
  assert.equal(all[0].category, null);
  assert.equal(all[0].strengthScore, 0);
  assert.equal(all[0].strengthLevel, null);
  assert.deepEqual(
    keyword.map((entry) => entry.id),
    [github.id]
  );
  assert.deepEqual(noTag, []);
});

test('get 解密自定义标签密文中的空标签并处理不存在条目', () => {
  const inserted = repositories.passwordEntryRepository.insert({
    userId,
    title: '手工密文',
    account: null,
    secret: encrypt('plain'),
    url: null,
    notes: encrypt('note'),
    category: null,
    tags: encrypt('a,,b'),
    strengthScore: 1,
    strengthLevel: 'WEAK',
  });
  const emptyTags = repositories.passwordEntryRepository.insert({
    userId,
    title: '空标签密文',
    secret: encrypt('plain'),
    notes: null,
    tags: encrypt(''),
  });

  assert.deepEqual(passwordService.get(userId, inserted.id).tags, ['a', 'b']);
  assert.deepEqual(passwordService.get(userId, emptyTags.id).tags, []);
  assertBusiness(() => passwordService.get(userId, 999), '密码条目不存在');
});

test('update 替换所有字段并重新计算强度', () => {
  const created = passwordService.create(userId, passwordRequest());

  const updated = passwordService.update(
    userId,
    created.id,
    passwordRequest({
      title: '更新后',
      account: 'new-account',
      secret: 'tiny',
      url: null,
      notes: '新备注',
      category: '个人',
      tags: ['新', '新'],
    })
  );

  assert.equal(updated.title, '更新后');
  assert.equal(updated.secret, 'tiny');
  assert.equal(updated.url, null);
  assert.deepEqual(updated.tags, ['新', '新']);
  assert.notEqual(updated.strengthScore, created.strengthScore);
  assertBusiness(() => passwordService.update(userId, 999, passwordRequest()), '密码条目不存在');
});

test('delete 删除条目并拒绝不存在或非本人条目', () => {
  const created = passwordService.create(userId, passwordRequest());
  const otherUserId = repositories.userRepository.insert({
    username: 'other-vault',
    password: 'hash',
    nickname: '其他用户',
    email: null,
    role: 'USER',
    enabled: true,
  }).id;

  assertBusiness(() => passwordService.delete(otherUserId, created.id), '密码条目不存在');
  passwordService.delete(userId, created.id);
  assertBusiness(() => passwordService.get(userId, created.id), '密码条目不存在');
  assertBusiness(() => passwordService.delete(userId, created.id), '密码条目不存在');
});
