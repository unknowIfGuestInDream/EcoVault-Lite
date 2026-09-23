/**
 * @file 统一 API 响应封装。
 *
 * 对齐 Java `ApiResponse<T>` 结构 `{ code, message, data }`，其中
 * 成功响应使用 code `0` 和 message `成功`。
 */

const SUCCESS_CODE = 0;
const SUCCESS_MESSAGE = '成功';

/**
 * @template T
 * @typedef {object} ApiResponseBody
 * @property {number} code - 响应码（0 = 成功）。
 * @property {string} message - 人类可读的消息。
 * @property {T | null} data - 载荷（不存在时为 null）。
 */

/**
 * 构建成功响应封装。
 *
 * @template T
 * @param {T} [data] - 可选载荷。
 * @param {string} [message] - 可选消息（默认值为 `成功`）。
 * @returns {ApiResponseBody<T>} 成功响应体。
 */
export function success(data = null, message = SUCCESS_MESSAGE) {
  return { code: SUCCESS_CODE, message, data: data ?? null };
}

/**
 * 构建错误响应封装。
 *
 * @param {number} code - 错误码（通常为 HTTP 状态码）。
 * @param {string} message - 错误消息。
 * @returns {ApiResponseBody<null>} 错误响应体。
 */
export function failure(code, message) {
  return { code, message, data: null };
}

export default { success, failure, SUCCESS_CODE, SUCCESS_MESSAGE };
