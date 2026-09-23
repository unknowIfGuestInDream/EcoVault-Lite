import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';

/**
 * @file 账本服务集成测试。
 */

let ledgerService;
let repositories;
let userId;

function ledgerRequest(overrides = {}) {
  return {
    type: 'EXPENSE',
    amount: 12.345,
    entryDate: '2024-01-02',
    tags: [' 餐饮 ', '餐饮', '', null, '朋友'],
    remark: '午餐',
    ...overrides,
  };
}

function assertBusiness(fn, message) {
  assert.throws(fn, (error) => error.message === message && error.status === 400);
}

beforeEach(() => {
  ({
    repositories,
    services: { ledgerService },
  } = createTestContext());
  userId = repositories.userRepository.insert({
    username: 'ledger-service-user',
    password: 'hash',
    nickname: '账本用户',
    email: null,
    role: 'USER',
    enabled: true,
  }).id;
});

test('create 保存收入支出、金额分值和规范化标签', () => {
  const expense = ledgerService.create(userId, ledgerRequest());
  const income = ledgerService.create(
    userId,
    ledgerRequest({ type: ' income ', amount: 100, tags: undefined, remark: undefined })
  );

  assert.equal(expense.type, 'EXPENSE');
  assert.equal(expense.amount, 12.35);
  assert.deepEqual(expense.tags, ['餐饮', '朋友']);
  assert.equal(income.type, 'INCOME');
  assert.deepEqual(income.tags, []);
  assert.equal(income.remark, null);
  assert.equal(ledgerService.create(userId, ledgerRequest({ amount: undefined })).amount, 0);
  assertBusiness(() => ledgerService.create(userId, ledgerRequest({ type: '' })), '收支类型不合法');
  assertBusiness(
    () => ledgerService.create(userId, ledgerRequest({ type: 'BAD' })),
    '收支类型不合法'
  );
});

test('list 支持类型、日期、标签过滤和日期校验', () => {
  const match = ledgerService.create(
    userId,
    ledgerRequest({ type: 'EXPENSE', entryDate: '2024-03-10', tags: ['餐饮'] })
  );
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'INCOME', entryDate: '2024-03-10', tags: ['餐饮'] })
  );
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'EXPENSE', entryDate: '2024-03-09', tags: ['交通'] })
  );

  const filtered = ledgerService.list(userId, ' expense ', '2024-03-10', '2024-03-10', ' 餐饮 ');

  assert.deepEqual(
    filtered.map((entry) => entry.id),
    [match.id]
  );
  assert.equal(ledgerService.list(userId, null, '', undefined, '').length, 3);
  assert.deepEqual(ledgerService.list(userId, undefined, null, null, '不存在'), []);
  assertBusiness(() => ledgerService.list(userId, 'BAD'), '收支类型不合法');
  assertBusiness(
    () => ledgerService.list(userId, null, '2024-03-11', '2024-03-10'),
    '起始日期不能晚于结束日期'
  );
});

test('update 与 delete 处理成功、更新为空标签和不存在记录', () => {
  const created = ledgerService.create(userId, ledgerRequest());
  const updated = ledgerService.update(
    userId,
    created.id,
    ledgerRequest({ type: 'INCOME', amount: 88, entryDate: '2024-04-01', tags: [], remark: null })
  );

  assert.equal(updated.type, 'INCOME');
  assert.equal(updated.amount, 88);
  assert.deepEqual(updated.tags, []);
  assert.equal(updated.remark, null);
  assertBusiness(() => ledgerService.update(userId, 999, ledgerRequest()), '收支记录不存在');
  assertBusiness(() => ledgerService.delete(userId, 999), '收支记录不存在');
  ledgerService.delete(userId, created.id);
  assert.deepEqual(ledgerService.list(userId), []);
});

test('statistics 统计空数据、收入支出、未分类标签和月度趋势', () => {
  const empty = ledgerService.statistics(userId);
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'INCOME', amount: 100, entryDate: '2024-02-01', tags: ['工资'] })
  );
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'EXPENSE', amount: 30, entryDate: '2024-02-02', tags: ['餐饮'] })
  );
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'EXPENSE', amount: 20, entryDate: '2024-01-02', tags: [] })
  );

  const stats = ledgerService.statistics(userId);
  const filtered = ledgerService.statistics(userId, 'EXPENSE', undefined, undefined, '餐饮');

  assert.equal(empty.totalIncome, 0);
  assert.equal(empty.totalExpense, 0);
  assert.equal(empty.balance, 0);
  assert.equal(empty.count, 0);
  assert.deepEqual(empty.monthlyTrend, []);
  assert.equal(stats.totalIncome, 100);
  assert.equal(stats.totalExpense, 50);
  assert.equal(stats.balance, 50);
  assert.deepEqual(stats.incomeByTag, [{ tag: '工资', amount: 100 }]);
  assert.deepEqual(stats.expenseByTag, [
    { tag: '餐饮', amount: 30 },
    { tag: '未分类', amount: 20 },
  ]);
  assert.deepEqual(stats.monthlyTrend, [
    { label: '2024-01', income: 0, expense: 20 },
    { label: '2024-02', income: 100, expense: 30 },
  ]);
  assert.equal(filtered.count, 1);
});

test('exportCsv 导出 BOM、收入支出中文类型并转义备注和标签', () => {
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'INCOME', amount: 100, tags: ['工资', '副业'], remark: '工资收入' })
  );
  ledgerService.create(
    userId,
    ledgerRequest({ type: 'EXPENSE', amount: 9.9, tags: ['餐饮'], remark: '备注,含"引号"' })
  );
  ledgerService.create(userId, ledgerRequest({ type: 'EXPENSE', amount: 1, tags: [], remark: '' }));

  const csv = ledgerService.exportCsv(userId);
  const expenseOnly = ledgerService.exportCsv(userId, 'EXPENSE', null, null, '餐饮');

  assert.ok(csv.startsWith('\uFEFF日期,类型,金额,标签,备注\n'));
  assert.match(csv, /2024-01-02,收入,100\.00,工资\|副业,工资收入/);
  assert.match(csv, /2024-01-02,支出,9\.90,餐饮,"备注,含""引号"""/);
  assert.match(csv, /2024-01-02,支出,1\.00,,\n/);
  assert.equal(expenseOnly.trim().split('\n').length, 2);
});

test('空值实体分支使用默认响应和 CSV 值', () => {
  const fakeService = new ledgerService.constructor({
    repository: {
      search() {
        return [
          {
            id: 1,
            type: null,
            amount: undefined,
            entryDate: null,
            tags: null,
            remark: null,
          },
          {
            id: 2,
            type: 'INCOME',
            amount: undefined,
            entryDate: undefined,
            tags: undefined,
            remark: '',
          },
        ];
      },
    },
  });

  const list = fakeService.list(1);
  const stats = fakeService.statistics(1);
  const csv = fakeService.exportCsv(1);

  assert.deepEqual(list[0], {
    id: 1,
    type: null,
    amount: 0,
    entryDate: null,
    tags: [],
    remark: null,
  });
  assert.deepEqual(stats.monthlyTrend, [{ label: '', income: 0, expense: 0 }]);
  assert.match(csv, /\uFEFF日期,类型,金额,标签,备注\n,支出,0\.00,,\n,收入,0\.00,,\n/);
});
