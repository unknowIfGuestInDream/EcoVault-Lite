/**
 * @file 精确金额算术辅助工具。
 *
 * 金额统一保留 2 位小数并采用 `HALF_UP` 舍入。
 * 为避免二进制浮点漂移，我们在内部将金额表示为
 * 整数分，并且只在 JSON 边界转换为普通数字。
 */

/**
 * 使用 HALF_UP 舍入将十进制金额值转换为整数分。
 *
 * @param {number | string | null | undefined} value - 金额值。
 * @returns {number} 整数分（值为 null/undefined/blank 时为 0）。
 */
export function toCents(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
  if (!Number.isFinite(num)) {
    return 0;
  }
  // 缩放为分后按 HALF_UP 舍入（平局时远离零）。
  const scaled = num * 100;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON);
  return Math.trunc(rounded);
}

/**
 * 将整数分转换为具有 2 位小数精度的普通数字。
 *
 * @param {number | null | undefined} cents - 整数分。
 * @returns {number} 金额值（例如 1234.56）。Null/undefined 会变为 0。
 */
export function fromCents(cents) {
  if (cents === null || cents === undefined) {
    return 0;
  }
  return Math.round(cents) / 100;
}

/**
 * 将整数分格式化为固定 2 位小数字符串（用于 CSV 导出）。
 *
 * @param {number | null | undefined} cents - 整数分。
 * @returns {string} 固定 2 位小数表示（例如 "1234.56"）。
 */
export function formatCents(cents) {
  return (Math.round(cents ?? 0) / 100).toFixed(2);
}

/**
 * 汇总一组分值。可传入多个分值参数，或单个分值数组。
 *
 * @param {...(number | number[] | null | undefined)} values - 分值，或单个分值数组。
 * @returns {number} 总分值。
 */
export function sumCents(...values) {
  const list = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  return list.reduce((total, value) => total + (value ?? 0), 0);
}

/**
 * 将总分值除以计数，并按 HALF_UP 舍入到最接近的分。
 *
 * @param {number} totalCents - 以分表示的分子。
 * @param {number} count - 除数（条目数）。
 * @returns {number} 平均分值（count <= 0 时为 0）。
 */
export function averageCents(totalCents, count) {
  if (!count || count <= 0) {
    return 0;
  }
  const quotient = totalCents / count;
  return Math.sign(quotient) * Math.round(Math.abs(quotient) + Number.EPSILON);
}

export default { toCents, fromCents, formatCents, sumCents, averageCents };
