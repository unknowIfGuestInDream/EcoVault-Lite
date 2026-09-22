/**
 * @file Exact monetary arithmetic helpers.
 *
 * The Java implementation uses `BigDecimal` with scale 2 and `HALF_UP` rounding.
 * To avoid binary floating-point drift we represent money internally as an
 * integer number of cents and only convert to a JavaScript number at the JSON
 * boundary (which matches Jackson serialising `BigDecimal` as a number).
 */

/**
 * Convert a decimal money value to integer cents using HALF_UP rounding.
 *
 * @param {number | string | null | undefined} value - Money value.
 * @returns {number} Integer cents (0 when the value is null/undefined/blank).
 */
export function toCents(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(num)) {
    return 0;
  }
  // Scale to cents then round HALF_UP (away from zero on ties).
  const scaled = num * 100;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON);
  return Math.trunc(rounded);
}

/**
 * Convert integer cents to a JavaScript number with 2-decimal precision.
 *
 * @param {number | null | undefined} cents - Integer cents.
 * @returns {number} Money value (e.g. 1234.56). Null/undefined becomes 0.
 */
export function fromCents(cents) {
  if (cents === null || cents === undefined) {
    return 0;
  }
  return Math.round(cents) / 100;
}

/**
 * Format integer cents as a fixed 2-decimal string (used for CSV export).
 *
 * @param {number | null | undefined} cents - Integer cents.
 * @returns {string} Fixed 2-decimal representation (e.g. "1234.56").
 */
export function formatCents(cents) {
  return (Math.round(cents ?? 0) / 100).toFixed(2);
}

/**
 * Sum a list of cent values.
 *
 * @param {...number} values - Cent values.
 * @returns {number} Total cents.
 */
export function sumCents(...values) {
  return values.reduce((total, value) => total + (value ?? 0), 0);
}

/**
 * Divide a cents total by a count and round HALF_UP to the nearest cent.
 *
 * @param {number} totalCents - Numerator in cents.
 * @param {number} count - Divisor (number of items).
 * @returns {number} Averaged cents (0 when count <= 0).
 */
export function averageCents(totalCents, count) {
  if (!count || count <= 0) {
    return 0;
  }
  const quotient = totalCents / count;
  return Math.sign(quotient) * Math.round(Math.abs(quotient) + Number.EPSILON);
}

export default { toCents, fromCents, formatCents, sumCents, averageCents };
