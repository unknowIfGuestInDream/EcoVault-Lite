/**
 * @file 账本条目类型。
 *
 * 对齐收入/支出账本使用的 Java `LedgerType` 枚举。
 */

/**
 * 支持的账本条目类型。
 *
 * @readonly
 * @enum {string}
 */
export const LedgerType = Object.freeze({
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
});

/**
 * 所有账本类型值。
 *
 * @type {ReadonlyArray<string>}
 */
export const LEDGER_TYPE_VALUES = Object.freeze(Object.values(LedgerType));

/**
 * 有效账本类型的类型守卫。
 *
 * @param {unknown} value - 候选值。
 * @returns {boolean} 值为已识别的账本类型时返回 true。
 */
export function isLedgerType(value) {
  return typeof value === 'string' && LEDGER_TYPE_VALUES.includes(value);
}

export default LedgerType;
