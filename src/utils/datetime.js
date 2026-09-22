import process from 'node:process';

/**
 * @file Date/time formatting helpers.
 *
 * The original Java service formats timestamps as `yyyy-MM-dd HH:mm:ss` in the
 * GMT+8 timezone. To stay deterministic regardless of the host timezone we
 * apply a fixed offset (configurable through `ECOVAULT_TZ_OFFSET_MINUTES`,
 * defaulting to 480 minutes = GMT+8) and format from the shifted UTC parts.
 * Storing timestamps in this lexicographically-sortable form also keeps range
 * queries correct in SQLite.
 */

const OFFSET_MINUTES = (() => {
  const parsed = Number.parseInt(process.env.ECOVAULT_TZ_OFFSET_MINUTES ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 480;
})();

/**
 * Left-pad a number with zeros.
 *
 * @param {number} value - Number to pad.
 * @param {number} [width] - Target width.
 * @returns {string} Zero-padded string.
 */
function pad(value, width = 2) {
  return String(value).padStart(width, '0');
}

/**
 * Shift a date by the configured timezone offset.
 *
 * @param {Date} date - Source date.
 * @returns {Date} Date shifted into the configured zone (read via UTC getters).
 */
function toZoned(date) {
  return new Date(date.getTime() + OFFSET_MINUTES * 60000);
}

/**
 * Format a date as `yyyy-MM-dd HH:mm:ss` in the configured timezone.
 *
 * @param {Date} [date] - Date to format (defaults to now).
 * @returns {string} Formatted timestamp.
 */
export function formatDateTime(date = new Date()) {
  const z = toZoned(date);
  return (
    `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())} ` +
    `${pad(z.getUTCHours())}:${pad(z.getUTCMinutes())}:${pad(z.getUTCSeconds())}`
  );
}

/**
 * Format a date as `yyyy-MM-dd` in the configured timezone.
 *
 * @param {Date} [date] - Date to format (defaults to now).
 * @returns {string} Formatted date.
 */
export function formatDate(date = new Date()) {
  const z = toZoned(date);
  return `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}`;
}

/**
 * Current timestamp formatted as `yyyy-MM-dd HH:mm:ss`.
 *
 * @returns {string} Current formatted timestamp.
 */
export function nowDateTime() {
  return formatDateTime(new Date());
}

/**
 * Validate a `yyyy-MM-dd` date string.
 *
 * @param {string} value - Candidate date string.
 * @returns {boolean} True when the value is a valid calendar date.
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
