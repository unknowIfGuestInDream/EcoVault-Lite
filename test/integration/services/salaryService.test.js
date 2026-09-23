import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';

/**
 * @file 工资服务集成测试。
 */

let repositories;
let salaryService;
let userId;

function salaryRequest(overrides = {}) {
  return {
    year: 2024,
    month: 1,
    baseSalary: 10000,
    performanceSalary: 2000,
    housingAllowance: 800,
    mealAllowance: 300,
    transportAllowance: 200,
    overtimePay: 100,
    overtimeAllowance: 50,
    bonus: 500,
    medicalBase: 10000,
    pensionUnemploymentBase: 10000,
    housingFundBase: 10000,
    medicalDeduction: 200,
    pensionDeduction: 800,
    unemploymentDeduction: 50,
    housingFundDeduction: 1200,
    incomeTax: 100,
    seriousIllnessMedical: 10,
    heatingAllowance: 20,
    netPay: 11610,
    remark: '一月工资',
    ...overrides,
  };
}

function csvLine(values) {
  return values.join(',');
}

function importCells(overrides = {}) {
  const cells = [
    '2024',
    '3',
    '10000.00',
    '2000.00',
    '800.00',
    '300.00',
    '200.00',
    '100.00',
    '50.00',
    '500.00',
    '13950.00',
    '10000.00',
    '10000.00',
    '10000.00',
    '200.00',
    '800.00',
    '50.00',
    '1200.00',
    '2250.00',
    '11700.00',
    '100.00',
    '11600.00',
    '10.00',
    '20.00',
    '11610.00',
    '导入备注',
  ];
  for (const [index, value] of Object.entries(overrides)) {
    cells[Number(index)] = value;
  }
  return cells;
}

function assertBusiness(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message) && error.status === 400);
}

beforeEach(() => {
  ({
    repositories,
    services: { salaryService },
  } = createTestContext());
  userId = repositories.userRepository.insert({
    username: 'salary-service-user',
    password: 'hash',
    nickname: '工资用户',
    email: null,
    role: 'USER',
    enabled: true,
  }).id;
});

test('save 插入记录并按同年月 upsert 覆盖', () => {
  const first = salaryService.save(userId, salaryRequest());
  const second = salaryService.save(userId, salaryRequest({ baseSalary: 12000, remark: null }));

  assert.equal(first.id, second.id);
  assert.equal(second.baseSalary, 12000);
  assert.equal(second.remark, '');
  assert.equal(second.grossPay, 15950);
  assert.equal(second.totalDeduction, 2250);
  assert.equal(second.preTaxSalary, 13700);
  assert.equal(second.afterTaxSalary, 13600);
  assert.equal(second.netPay, 11610);
  assert.equal(salaryService.list(userId).length, 1);
});

test('update 与 delete 处理成功和不存在记录', () => {
  const saved = salaryService.save(userId, salaryRequest({ month: 2 }));
  const updated = salaryService.update(userId, saved.id, salaryRequest({ month: 4, netPay: 9000 }));

  assert.equal(updated.month, 4);
  assert.equal(updated.netPay, 9000);
  assertBusiness(() => salaryService.update(userId, 999, salaryRequest()), /工资记录不存在/);
  salaryService.delete(userId, saved.id);
  assert.equal(salaryService.list(userId).length, 0);
  assertBusiness(() => salaryService.delete(userId, saved.id), /工资记录不存在/);
});

test('list 支持无范围、单端范围、同年范围与反向区间', () => {
  const old = salaryService.save(userId, salaryRequest({ year: 2023, month: 12 }));
  const jan = salaryService.save(userId, salaryRequest({ year: 2024, month: 1 }));
  const feb = salaryService.save(userId, salaryRequest({ year: 2024, month: 2 }));
  const future = salaryService.save(userId, salaryRequest({ year: 2025, month: 1 }));

  assert.deepEqual(
    salaryService.list(userId).map((record) => record.id),
    [old.id, jan.id, feb.id, future.id]
  );
  assert.deepEqual(
    salaryService.list(userId, 2024).map((record) => record.id),
    [jan.id, feb.id]
  );
  assert.deepEqual(
    salaryService.list(userId, null, 2023).map((record) => record.id),
    [old.id]
  );
  assert.deepEqual(
    salaryService.list(userId, 2025, 2024).map((record) => record.id),
    [jan.id, feb.id, future.id]
  );
});

test('statistics 分离普通月份与年终奖并处理空数据', () => {
  const empty = salaryService.statistics(userId);
  salaryService.save(userId, salaryRequest({ month: 1, netPay: 10000, bonus: 500 }));
  salaryService.save(userId, salaryRequest({ month: 2, netPay: 12000, bonus: 700 }));
  salaryService.save(
    userId,
    salaryRequest({ month: 0, baseSalary: 0, bonus: 30000, netPay: 29000, remark: '年终奖' })
  );

  const stats = salaryService.statistics(userId);

  assert.equal(empty.totalNet, 0);
  assert.equal(empty.averageNet, 0);
  assert.equal(empty.maxNet, 0);
  assert.equal(empty.minNet, 0);
  assert.deepEqual(empty.monthlyTrend, []);
  assert.equal(stats.totalNet, 22000);
  assert.equal(stats.averageNet, 11000);
  assert.equal(stats.maxNet, 12000);
  assert.equal(stats.minNet, 10000);
  assert.equal(stats.totalBonus, 1200);
  assert.equal(stats.totalAnnualBonus, 29000);
  assert.deepEqual(
    stats.monthlyTrend.map((point) => point.label),
    ['2024-01', '2024-02']
  );
  assert.equal(stats.composition.baseSalary, 20000);
  assert.equal(stats.deductionComposition.housingFund, 2400);
});

test('exportCsv 导出 26 列表头、金额元值和不同文件名', () => {
  salaryService.save(userId, salaryRequest({ remark: '普通备注' }));
  salaryService.save(
    userId,
    salaryRequest({ month: 0, bonus: 10000, netPay: 9900, remark: '年终奖,备注' })
  );

  const all = salaryService.exportCsv(userId);
  const sameYear = salaryService.exportCsv(userId, 2024, 2024);
  const reversed = salaryService.exportCsv(userId, 2025, 2024);

  const header = all.csv.slice(1).split('\n')[0].split(',');
  const lines = all.csv.slice(1).trim().split('\n');

  assert.equal(header.length, 26);
  assert.equal(all.filename, 'salary_all.csv');
  assert.equal(sameYear.filename, 'salary_2024.csv');
  assert.equal(reversed.filename, 'salary_2024-2025.csv');
  assert.match(lines[1], /^2024,年终奖,/);
  assert.match(lines[1], /"年终奖,备注"$/);
  assert.match(lines[2], /^2024,1,10000\.00/);
});

test('importCsv 支持 BOM、引号字段、逗号、空行、年终奖与 upsert', () => {
  const header = salaryService.exportCsv(userId).csv.slice(1).split('\n')[0];
  const quoted = importCells({ 1: '年终奖', 25: '"备注,含""引号"""' });
  const normal = importCells({ 0: '2024', 1: '3', 25: '三月备注' });
  const csv = `\uFEFF${header}\n${csvLine(normal)}\n\n${csvLine(quoted)}\n`;

  assert.equal(salaryService.importCsv(userId, csv), 2);
  assert.equal(salaryService.list(userId).length, 2);
  assert.equal(salaryService.list(userId, 2024)[0].month, 0);
  assert.equal(salaryService.list(userId, 2024)[1].remark, '三月备注');
  assert.equal(salaryService.list(userId, 2024)[0].remark, '备注,含"引号"');

  const updated = importCells({ 1: '3', 24: '12000.00', 25: '覆盖备注' });
  assert.equal(salaryService.importCsv(userId, `${header}\n${csvLine(updated)}`), 1);
  const march = salaryService.list(userId, 2024).find((record) => record.month === 3);
  assert.equal(march.netPay, 12000);
  assert.equal(march.remark, '覆盖备注');
});

test('importCsv 报告空内容、缺少数据、列数不足、整数和金额格式错误', () => {
  const header = salaryService.exportCsv(userId).csv.slice(1).split('\n')[0];

  assertBusiness(() => salaryService.importCsv(userId, ''), /CSV 内容为空/);
  assertBusiness(() => salaryService.importCsv(userId, '只有表头'), /CSV 至少需要表头行与一行数据/);
  assertBusiness(() => salaryService.importCsv(userId, `${header}\n1,2,3`), /列数不足/);
  assertBusiness(
    () => salaryService.importCsv(userId, `${header}\n${csvLine(importCells({ 0: '20x4' }))}`),
    /年份格式错误/
  );
  assertBusiness(
    () => salaryService.importCsv(userId, `${header}\n${csvLine(importCells({ 1: 'x' }))}`),
    /月份格式错误/
  );
  assertBusiness(
    () => salaryService.importCsv(userId, `${header}\n${csvLine(importCells({ 2: 'abc' }))}`),
    /数值格式错误/
  );
});

test('importCsv 与 exportCsv 覆盖空金额、空备注和未定义备注分支', () => {
  const header = salaryService.exportCsv(userId).csv.slice(1).split('\n')[0];
  const blankMoney = importCells({ 2: '', 25: '' });
  assert.equal(salaryService.importCsv(userId, `${header}\n${csvLine(blankMoney)}`), 1);
  assert.equal(salaryService.list(userId, 2024)[0].baseSalary, 0);

  repositories.salaryRecordRepository.insert({
    userId,
    year: 2025,
    month: 5,
    baseSalary: 10000,
    remark: undefined,
  });
  const { csv } = salaryService.exportCsv(userId, 2025);
  assert.match(csv, /2025,5,100\.00/);
  assert.match(csv, /,0\.00,\n$/);
});

test('importCsv 处理缺失备注单元格的兼容分支', () => {
  const header = salaryService.exportCsv(userId).csv.slice(1).split('\n')[0];
  const originalPush = Array.prototype.push;
  Array.prototype.push = function patchedPush(...items) {
    return originalPush.apply(
      this,
      items.map((item) => (item === '__UNDEFINED_REMARK__' ? undefined : item))
    );
  };
  try {
    const cells = importCells({ 25: '__UNDEFINED_REMARK__' });
    assert.equal(salaryService.importCsv(userId, `${header}\n${csvLine(cells)}`), 1);
    assert.equal(salaryService.list(userId, 2024)[0].remark, '');
  } finally {
    Array.prototype.push = originalPush;
  }
});

test('缺省工资字段在列表、统计、导出和保存时使用默认值', () => {
  const fakeService = new salaryService.constructor({
    repository: {
      findByUser() {
        return [{ id: 1, year: 2026, month: 7, remark: null }];
      },
      findByUserAndYear() {
        return [{ id: 1, year: 2026, month: 7, remark: null }];
      },
      findByUserYearMonth() {
        return null;
      },
      insert(entity) {
        return { id: 2, ...entity };
      },
    },
  });

  const listed = fakeService.list(1)[0];
  const stats = fakeService.statistics(1);
  const exported = fakeService.exportCsv(1).csv;
  const saved = fakeService.save(1, { year: 2026, month: 8 });

  assert.equal(listed.baseSalary, 0);
  assert.equal(listed.heatingAllowance, 0);
  assert.equal(stats.totalNet, 0);
  assert.equal(stats.composition.performanceSalary, 0);
  assert.equal(stats.deductionComposition.incomeTax, 0);
  assert.match(exported, /2026,7,0\.00,0\.00/);
  assert.equal(saved.netPay, 0);
  assert.equal(saved.remark, '');
});

test('importCsv 覆盖无备注列、带外层引号备注和仅结束年份文件名', () => {
  const header = salaryService.exportCsv(userId).csv.slice(1).split('\n')[0];
  const withoutRemark = importCells().slice(0, 25);
  const quotedRemark = importCells({ 1: '4', 25: '"""包裹"""' });

  assert.equal(salaryService.importCsv(userId, `${header}\n${csvLine(withoutRemark)}`), 1);
  assert.equal(salaryService.importCsv(userId, `${header}\n${csvLine(quotedRemark)}`), 1);
  assert.equal(salaryService.list(userId, 2024).find((record) => record.month === 3).remark, '');
  assert.equal(
    salaryService.list(userId, 2024).find((record) => record.month === 4).remark,
    '包裹'
  );
  assert.equal(salaryService.exportCsv(userId, null, 2024).filename, 'salary_2024.csv');
});
