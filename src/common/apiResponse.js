/**
 * @file Unified API response envelope.
 *
 * Mirrors the Java `ApiResponse<T>` shape `{ code, message, data }` where a
 * successful response uses code `0` and message `成功`.
 */

const SUCCESS_CODE = 0;
const SUCCESS_MESSAGE = '成功';

/**
 * @template T
 * @typedef {object} ApiResponseBody
 * @property {number} code - Response code (0 = success).
 * @property {string} message - Human-readable message.
 * @property {T | null} data - Payload (null when absent).
 */

/**
 * Build a success envelope.
 *
 * @template T
 * @param {T} [data] - Optional payload.
 * @param {string} [message] - Optional message (defaults to `成功`).
 * @returns {ApiResponseBody<T>} The success body.
 */
export function success(data = null, message = SUCCESS_MESSAGE) {
  return { code: SUCCESS_CODE, message, data: data ?? null };
}

/**
 * Build an error envelope.
 *
 * @param {number} code - Error code (typically the HTTP status).
 * @param {string} message - Error message.
 * @returns {ApiResponseBody<null>} The error body.
 */
export function failure(code, message) {
  return { code, message, data: null };
}

export default { success, failure, SUCCESS_CODE, SUCCESS_MESSAGE };
