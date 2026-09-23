import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCents,
  fromCents,
  formatCents,
  sumCents,
  averageCents,
} from '../../../src/utils/money.js';

/**
 * @file 金额算术辅助工具测试。
 */

test('toCents 处理数字、字符串、空值与非法值', () => {
  assert.equal(toCents(12.34), 1234);
  assert.equal(toCents('56.78'), 5678);
  assert.equal(toCents('  9.99 '), 999);
  assert.equal(toCents(null), 0);
  assert.equal(toCents(undefined), 0);
  assert.equal(toCents(''), 0);
  assert.equal(toCents('abc'), 0);
  assert.equal(toCents(Infinity), 0);
});

test('toCents 采用 HALF_UP 舍入（远离零）', () => {
  assert.equal(toCents(0.005), 1);
  assert.equal(toCents(-0.005), -1);
  assert.equal(toCents(2.5 / 100), 3);
});

test('fromCents 还原为带两位小数的数字', () => {
  assert.equal(fromCents(1234), 12.34);
  assert.equal(fromCents(null), 0);
  assert.equal(fromCents(undefined), 0);
});

test('formatCents 固定两位小数', () => {
  assert.equal(formatCents(1234), '12.34');
  assert.equal(formatCents(null), '0.00');
  assert.equal(formatCents(undefined), '0.00');
});

test('sumCents 与 averageCents 聚合分值', () => {
  assert.equal(sumCents(100, 200, undefined), 300);
  assert.equal(sumCents(), 0);
  assert.equal(averageCents(1000, 3), 333);
  assert.equal(averageCents(100, 0), 0);
  assert.equal(averageCents(100, undefined), 0);
  assert.equal(averageCents(-100, 3), -33);
});
