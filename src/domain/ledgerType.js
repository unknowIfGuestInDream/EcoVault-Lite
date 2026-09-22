/**
 * @file Ledger entry types.
 *
 * Mirrors the Java `LedgerType` enum used by the income/expense ledger.
 */

/**
 * Supported ledger entry types.
 *
 * @readonly
 * @enum {string}
 */
export const LedgerType = Object.freeze({
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
});

/**
 * All ledger type values.
 *
 * @type {ReadonlyArray<string>}
 */
export const LEDGER_TYPE_VALUES = Object.freeze(Object.values(LedgerType));

/**
 * Type guard for a valid ledger type.
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is a recognised ledger type.
 */
export function isLedgerType(value) {
  return typeof value === 'string' && LEDGER_TYPE_VALUES.includes(value);
}

export default LedgerType;
