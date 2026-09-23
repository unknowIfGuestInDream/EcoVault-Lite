import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, insertUser } from '../../helpers/db.js';
import { SalaryRecordRepository } from '../../../src/repositories/salaryRecordRepository.js';

/**
 * @file 工资记录仓储集成测试。
 */

let db;
let repository;
let user;
let otherUser;

function salary(overrides = {}) {
  return {
    userId: user.id,
    year: 2024,
    month: 1,
    baseSalary: 100000,
    performanceSalary: 20000.4,
    grossPay: 120000.6,
    totalDeduction: null,
    preTaxSalary: 118000.2,
    remark: '一月工资',
    ...overrides,
  };
}

beforeEach(() => {
  db = createTestDatabase();
  repository = new SalaryRecordRepository(db);
  user = insertUser(db, { username: 'salary-user' });
  otherUser = insertUser(db, { username: 'other-salary-user' });
});

test('insert 保存金额分值、四舍五入并处理派生列空值', () => {
  const record = repository.insert(
    salary({
      afterTaxSalary: undefined,
      mealAllowance: 123.6,
      netPay: 99000.2,
    })
  );

  assert.equal(record.userId, user.id);
  assert.equal(record.performanceSalary, 20000);
  assert.equal(record.mealAllowance, 124);
  assert.equal(record.transportAllowance, 0);
  assert.equal(record.grossPay, 120001);
  assert.equal(record.totalDeduction, null);
  assert.equal(record.preTaxSalary, 118000);
  assert.equal(record.afterTaxSalary, null);
  assert.equal(record.netPay, 99000);
  assert.equal(record.remark, '一月工资');
});

test('findByUser、findByUserAndYear 与区间查询按年月升序排序', () => {
  const first = repository.insert(salary({ year: 2023, month: 12, remark: '2023-12' }));
  const second = repository.insert(salary({ year: 2024, month: 1, remark: '2024-01' }));
  const third = repository.insert(salary({ year: 2024, month: 2, remark: '2024-02' }));
  repository.insert(salary({ userId: otherUser.id, year: 2024, month: 1, remark: 'other' }));

  assert.deepEqual(
    repository.findByUser(user.id).map((record) => record.id),
    [first.id, second.id, third.id]
  );
  assert.deepEqual(
    repository.findByUserAndYear(user.id, 2024).map((record) => record.id),
    [second.id, third.id]
  );
  assert.deepEqual(
    repository.findByUserAndYearBetween(user.id, 2024, 2024).map((record) => record.id),
    [second.id, third.id]
  );
  assert.deepEqual(repository.findByUserAndYear(user.id, 1999), []);
});

test('findByIdAndUser 与 findByUserYearMonth 区分归属和不存在记录', () => {
  const record = repository.insert(salary({ month: 3 }));

  assert.equal(repository.findByIdAndUser(record.id, user.id).id, record.id);
  assert.equal(repository.findByIdAndUser(record.id, otherUser.id), null);
  assert.equal(repository.findByIdAndUser(999, user.id), null);
  assert.equal(repository.findByUserYearMonth(user.id, 2024, 3).id, record.id);
  assert.equal(repository.findByUserYearMonth(user.id, 2024, 4), null);
});

test('update 更新所有列并在归属不匹配时返回 null', () => {
  const record = repository.insert(salary({ month: 4 }));

  const updated = repository.update(
    record.id,
    user.id,
    salary({
      year: 2025,
      month: 5,
      baseSalary: 200000.9,
      performanceSalary: undefined,
      grossPay: undefined,
      totalDeduction: 30000.2,
      preTaxSalary: null,
      afterTaxSalary: 160000.8,
      remark: undefined,
    })
  );
  assert.equal(updated.year, 2025);
  assert.equal(updated.month, 5);
  assert.equal(updated.baseSalary, 200001);
  assert.equal(updated.performanceSalary, 0);
  assert.equal(updated.grossPay, null);
  assert.equal(updated.totalDeduction, 30000);
  assert.equal(updated.preTaxSalary, null);
  assert.equal(updated.afterTaxSalary, 160001);
  assert.equal(updated.remark, null);
  assert.equal(repository.update(record.id, otherUser.id, salary({ month: 6 })), null);
});

test('deleteByIdAndUser 返回删除结果且唯一自然键约束生效', () => {
  const record = repository.insert(salary({ month: 7 }));

  assert.throws(() => repository.insert(salary({ month: 7 })), /UNIQUE constraint failed/);
  assert.equal(repository.deleteByIdAndUser(record.id, otherUser.id), false);
  assert.equal(repository.deleteByIdAndUser(record.id, user.id), true);
  assert.equal(repository.findByIdAndUser(record.id, user.id), null);
  assert.equal(repository.deleteByIdAndUser(record.id, user.id), false);
});

test('映射缺失金额列时使用 0 且派生列为 null', () => {
  const fakeDb = {
    prepare() {
      return {
        get: () => ({
          id: 1,
          user_id: 1,
          year: 2024,
          month: 8,
          remark: null,
          created_at: '2024-08-01 00:00:00',
          updated_at: '2024-08-01 00:00:00',
        }),
      };
    },
  };
  const fakeRepository = new SalaryRecordRepository(fakeDb);
  const record = fakeRepository.findByIdAndUser(1, 1);

  assert.equal(record.baseSalary, 0);
  assert.equal(record.grossPay, null);
});
