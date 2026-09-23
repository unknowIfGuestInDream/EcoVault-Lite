/**
 * @file 类型化应用错误。
 *
 * 这些错误映射到全局错误处理器生成的 HTTP 响应。
 */

/**
 * 携带 HTTP 状态码和响应码的基础应用错误。
 */
export class AppError extends Error {
  /**
   * @param {string} message - 人类可读的消息（返回给客户端）。
   * @param {number} status - HTTP 状态码。
   * @param {number} [code] - 业务响应码（默认值为 `status`）。
   */
  constructor(message, status, code) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code ?? status;
  }
}

/**
 * 可恢复且符合预期的业务规则违反（HTTP 400）。
 */
export class BusinessError extends AppError {
  /**
   * @param {string} message - 对被违反规则的说明。
   */
  constructor(message) {
    super(message, 400);
  }
}

/**
 * 需要认证，或提供的凭据/token 无效（HTTP 401）。
 */
export class AuthError extends AppError {
  /**
   * @param {string} [message] - 可选消息。
   */
  constructor(message = '未认证或登录已失效') {
    super(message, 401);
  }
}

/**
 * 调用方已认证，但没有访问该资源的权限（HTTP 403）。
 */
export class AccessDeniedError extends AppError {
  /**
   * @param {string} [message] - 可选消息。
   */
  constructor(message = '无权访问该资源') {
    super(message, 403);
  }
}

/**
 * 找不到请求的资源（HTTP 404）。
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} [message] - 可选消息。
   */
  constructor(message = '资源不存在') {
    super(message, 404);
  }
}

/**
 * 一个或多个请求字段校验失败（HTTP 400）。
 *
 * 所有字段消息会以 `"; "` 拼接，并随响应码 400 返回。
 */
export class ValidationError extends AppError {
  /**
   * @param {string[] | string} messages - 字段消息（以 `"; "` 拼接）。
   */
  constructor(messages) {
    const list = Array.isArray(messages) ? messages : [messages];
    super(list.join('; '), 400);
    /** @type {string[]} */
    this.messages = list;
  }
}

export default {
  AppError,
  BusinessError,
  AuthError,
  AccessDeniedError,
  NotFoundError,
  ValidationError,
};
