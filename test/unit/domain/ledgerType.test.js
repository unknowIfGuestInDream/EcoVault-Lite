import { test } from 'node:test';
import assert from 'node:assert/strict';
import LedgerType, { LEDGER_TYPE_VALUES, isLedgerType } from '../../../src/domain/ledgerType.js';

/**
 * @file 账本条目类型测试。
 */

test('LedgerType 暴露收入与支出常量和值列表', () => {
  assert.deepEqual(LedgerType, { INCOME: 'INCOME', EXPENSE: 'EXPENSE' });
  assert.deepEqual(LEDGER_TYPE_VALUES, ['INCOME', 'EXPENSE']);
  assert.ok(Object.isFrozen(LedgerType));
  assert.ok(Object.isFrozen(LEDGER_TYPE_VALUES));
});

test('isLedgerType 识别有效类型并拒绝无效值', () => {
  assert.equal(isLedgerType('INCOME'), true);
  assert.equal(isLedgerType('EXPENSE'), true);
  assert.equal(isLedgerType('TRANSFER'), false);
  assert.equal(isLedgerType(undefined), false);
});
