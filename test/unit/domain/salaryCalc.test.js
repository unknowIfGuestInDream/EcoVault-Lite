import { test } from 'node:test';
import assert from 'node:assert/strict';
import salaryCalc, {
  ANNUAL_BONUS_MONTH,
  afterTaxSalary,
  grossPay,
  isAnnualBonus,
  netPay,
  preTaxSalary,
  totalDeduction,
} from '../../../src/domain/salaryCalc.js';

/**
 * @file 工资派生字段计算测试。
 */

test('isAnnualBonus 根据月份判断年终奖记录', () => {
  assert.equal(ANNUAL_BONUS_MONTH, 0);
  assert.equal(isAnnualBonus({ month: 0 }), true);
  assert.equal(isAnnualBonus({ month: 12 }), false);
});

test('grossPay 优先返回覆盖值，否则按收入组成项计算', () => {
  assert.equal(grossPay({ grossPay: 0 }), 0);
  assert.equal(
    grossPay({
      grossPay: null,
      baseSalary: 100,
      performanceSalary: 200,
      housingAllowance: 300,
      mealAllowance: 400,
      transportAllowance: 500,
      overtimePay: 600,
      overtimeAllowance: 700,
      bonus: 800,
    }),
    3600
  );
  assert.equal(grossPay({}), 0);
});

test('totalDeduction 优先返回覆盖值，否则按扣款组成项计算', () => {
  assert.equal(totalDeduction({ totalDeduction: 123 }), 123);
  assert.equal(
    totalDeduction({
      totalDeduction: null,
      medicalDeduction: 100,
      pensionDeduction: 200,
      unemploymentDeduction: 300,
      housingFundDeduction: 400,
    }),
    1000
  );
  assert.equal(totalDeduction({}), 0);
});

test('preTaxSalary 优先返回覆盖值，否则由应发工资减扣款总额', () => {
  assert.equal(preTaxSalary({ preTaxSalary: 456 }), 456);
  assert.equal(
    preTaxSalary({
      preTaxSalary: null,
      grossPay: 5000,
      totalDeduction: 1200,
    }),
    3800
  );
  assert.equal(preTaxSalary({ baseSalary: 1000, pensionDeduction: 100 }), 900);
});

test('afterTaxSalary 优先返回覆盖值，否则由税前工资减个税', () => {
  assert.equal(afterTaxSalary({ afterTaxSalary: 789 }), 789);
  assert.equal(
    afterTaxSalary({
      afterTaxSalary: null,
      preTaxSalary: 5000,
      incomeTax: 300,
    }),
    4700
  );
  assert.equal(afterTaxSalary({ baseSalary: 1000 }), 1000);
});

test('netPay 对实发工资使用 null 安全回退', () => {
  assert.equal(netPay({ netPay: 321 }), 321);
  assert.equal(netPay({ netPay: null }), 0);
  assert.equal(netPay({}), 0);
});

test('默认导出包含所有工资计算函数', () => {
  assert.deepEqual(Object.keys(salaryCalc), [
    'ANNUAL_BONUS_MONTH',
    'isAnnualBonus',
    'grossPay',
    'totalDeduction',
    'preTaxSalary',
    'afterTaxSalary',
    'netPay',
  ]);
});
