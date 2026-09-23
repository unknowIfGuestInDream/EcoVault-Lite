import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser } from '../../helpers/db.js';
import { LedgerEntryRepository } from '../../../src/repositories/ledgerEntryRepository.js';

/**
 * @file 账本条目仓储集成测试。
 */

let db;
let repository;
let user;
let otherUser;

beforeEach(() => {
  db = createTestDatabase();
  repository = new LedgerEntryRepository(db);
  user = insertUser(db, { username: 'ledger-user' });
  otherUser = insertUser(db, { username: 'other-ledger-user' });
});

test('insert 保存默认金额、备注与清洗后的标签', () => {
  const entry = repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    entryDate: '2024-01-02',
    tags: [' 餐饮 ', '餐饮', '', null, '通勤'],
  });
  const noTags = repository.insert({
    userId: user.id,
    type: 'INCOME',
    amount: 88.8,
    entryDate: '2024-01-03',
  });

  assert.equal(entry.amount, 0);
  assert.equal(entry.remark, null);
  assert.deepEqual(entry.tags, ['餐饮', '通勤']);
  assert.equal(noTags.amount, 89);
  assert.deepEqual(noTags.tags, []);
  assert.equal(repository.findByIdAndUser(entry.id, user.id).id, entry.id);
  assert.equal(repository.findByIdAndUser(entry.id, otherUser.id), null);
  assert.equal(repository.findByIdAndUser(404, user.id), null);
});

test('search 无过滤时按日期和 id 降序并隔离用户', () => {
  const older = repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    amount: 100,
    entryDate: '2024-01-01',
  });
  const sameDayLowerId = repository.insert({
    userId: user.id,
    type: 'INCOME',
    amount: 200,
    entryDate: '2024-01-02',
  });
  const sameDayHigherId = repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    amount: 300,
    entryDate: '2024-01-02',
  });
  repository.insert({
    userId: otherUser.id,
    type: 'EXPENSE',
    amount: 400,
    entryDate: '2024-01-03',
  });

  assert.deepEqual(
    repository.search({ userId: user.id }).map((entry) => entry.id),
    [sameDayHigherId.id, sameDayLowerId.id, older.id]
  );
});

test('search 组合类型、日期和标签过滤并支持无匹配结果', () => {
  const match = repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    amount: 100,
    entryDate: '2024-03-10',
    tags: ['餐饮', '朋友'],
  });
  repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    amount: 200,
    entryDate: '2024-03-09',
    tags: ['交通'],
  });
  repository.insert({
    userId: user.id,
    type: 'INCOME',
    amount: 300,
    entryDate: '2024-03-10',
    tags: ['餐饮'],
  });

  assert.deepEqual(
    repository
      .search({
        userId: user.id,
        type: 'EXPENSE',
        start: '2024-03-10',
        end: '2024-03-10',
        tag: '餐饮',
      })
      .map((entry) => entry.id),
    [match.id]
  );
  assert.deepEqual(repository.search({ userId: user.id, tag: '不存在' }), []);
});

test('update 替换字段和标签，不存在记录返回 null', () => {
  const entry = repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    amount: 100,
    entryDate: '2024-04-01',
    remark: '旧备注',
    tags: ['旧'],
  });

  const updated = repository.update(entry.id, user.id, {
    type: 'INCOME',
    amount: undefined,
    entryDate: '2024-04-02',
    remark: undefined,
    tags: [undefined, ' 新 ', '新'],
  });
  assert.equal(updated.type, 'INCOME');
  assert.equal(updated.amount, 0);
  assert.equal(updated.remark, null);
  assert.deepEqual(updated.tags, ['新']);

  assert.equal(
    repository.update(999, user.id, {
      type: 'EXPENSE',
      amount: 1,
      entryDate: '2024-01-01',
      tags: null,
    }),
    null
  );
});

test('deleteByIdAndUser 删除归属匹配条目并级联标签', () => {
  const entry = repository.insert({
    userId: user.id,
    type: 'EXPENSE',
    amount: 100,
    entryDate: '2024-05-01',
    tags: ['待删'],
  });

  assert.equal(repository.deleteByIdAndUser(entry.id, otherUser.id), false);
  assert.equal(repository.deleteByIdAndUser(entry.id, user.id), true);
  assert.equal(repository.findByIdAndUser(entry.id, user.id), null);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS c FROM ledger_entry_tags WHERE entry_id = ?').get(entry.id).c,
    0
  );
  assert.equal(repository.deleteByIdAndUser(entry.id, user.id), false);
});

test('映射缺失金额列时使用 0', () => {
  const fakeDb = {
    prepare(sql) {
      if (sql.startsWith('SELECT tag')) {
        return { all: () => [] };
      }
      return {
        get: () => ({
          id: 1,
          user_id: 1,
          type: 'EXPENSE',
          entry_date: '2024-06-01',
          remark: null,
          created_at: '2024-06-01 00:00:00',
          updated_at: '2024-06-01 00:00:00',
        }),
      };
    },
  };
  const fakeRepository = new LedgerEntryRepository(fakeDb);

  assert.equal(fakeRepository.findByIdAndUser(1, 1).amount, 0);
});
