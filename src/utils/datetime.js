import process from 'node:process';

/**
 * @file 日期/时间格式化辅助工具。
 *
 * 原始 Java 服务以 GMT+8 时区将时间戳格式化为 `yyyy-MM-dd HH:mm:ss`。
 * 为了不受主机时区影响而保持确定性，我们
 * 应用固定偏移量（可通过 `ECOVAULT_TZ_OFFSET_MINUTES` 配置，
 * 默认 480 分钟 = GMT+8），并根据偏移后的 UTC 部分格式化。
 * 以这种按字典序可排序的形式存储时间戳，也能保持 SQLite 中的范围
 * 查询正确。
 */

const OFFSET_MINUTES = (() => {
  const parsed = Number.parseInt(process.env.ECOVAULT_TZ_OFFSET_MINUTES ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 480;
})();

/**
 * 使用零对数字进行左侧填充。
 *
 * @param {number} value - 要填充的数字。
 * @param {number} [width] - 目标宽度。
 * @returns {string} 零填充后的字符串。
 */
function pad(value, width = 2) {
  return String(value).padStart(width, '0');
}

/**
 * 按配置的时区偏移移动日期。
 *
 * @param {Date} date - 源日期。
 * @returns {Date} 移动到配置时区后的日期（通过 UTC getter 读取）。
 */
function toZoned(date) {
  return new Date(date.getTime() + OFFSET_MINUTES * 60000);
}

/**
 * 在配置的时区中将日期格式化为 `yyyy-MM-dd HH:mm:ss`。
 *
 * @param {Date} [date] - 要格式化的日期（默认为当前时间）。
 * @returns {string} 格式化后的时间戳。
 */
export function formatDateTime(date = new Date()) {
  const z = toZoned(date);
  return (
    `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())} ` +
    `${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}:${pad(z.getUTCSeconds())}`
  );
}

/**
 * 在配置的时区中将日期格式化为 `yyyy-MM-dd`。
 *
 * @param {Date} [date] - 要格式化的日期（默认为当前时间）。
 * @returns {string} 格式化后的日期。
 */
export function formatDate(date = new Date()) {
  const z = toZoned(date);
  return `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}`;
}

/**
 * 格式化为 `yyyy-MM-dd HH:mm:ss` 的当前时间戳。
 *
 * @returns {string} 当前格式化时间戳。
 */
export function nowDateTime() {
  return formatDateTime(new Date());
}

/**
 * 校验 `yyyy-MM-dd` 日期字符串。
 *
 * @param {string} value - 候选日期字符串。
 * @returns {boolean} 值为有效日历日期时返回 true。
 */
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export default { formatDateTime, formatDate, nowDateTime, isValidDate };
