/**
 * @file Typed application errors.
 *
 * These map onto the HTTP responses produced by the global error handler and
 * mirror the exception hierarchy of the Java service (BusinessException,
 * AccessDeniedException, AuthenticationException).
 */

/**
 * Base application error carrying an HTTP status and a response code.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable message (returned to the client).
   * @param {number} status - HTTP status code.
   * @param {number} [code] - Business response code (defaults to `status`).
   */
  constructor(message, status, code) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code ?? status;
  }
}

/**
 * A recoverable, expected business rule violation (HTTP 400).
 */
export class BusinessError extends AppError {
  /**
   * @param {string} message - Explanation of the rule that was violated.
   */
  constructor(message) {
    super(message, 400);
  }
}

/**
 * Authentication is required or the supplied credentials/token are invalid (HTTP 401).
 */
export class AuthError extends AppError {
  /**
   * @param {string} [message] - Optional message.
   */
  constructor(message = '未认证或登录状态已失效') {
    super(message, 401);
  }
}

/**
 * The caller is authenticated but not permitted to access the resource (HTTP 403).
 */
export class AccessDeniedError extends AppError {
  /**
   * @param {string} [message] - Optional message.
   */
  constructor(message = '无权访问该资源') {
    super(message, 403);
  }
}

/**
 * A requested resource could not be found (HTTP 404).
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} [message] - Optional message.
   */
  constructor(message = '资源不存在') {
    super(message, 404);
  }
}

export default { AppError, BusinessError, AuthError, AccessDeniedError, NotFoundError };
