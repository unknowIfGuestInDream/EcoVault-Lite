import { getClientIp } from '../utils/web.js';

/**
 * @file 操作日志钩子（敏感字段脱敏）。
 *
 * 通过统一的 `onResponse` 钩子自动记录改变状态的 API 操作，
 * 并对请求体中的敏感字段脱敏后再持久化，避免泄露明文口令等信息。
 */

/** 记录审计日志的 HTTP 方法（改变状态的请求）。 */
const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 需要脱敏的请求体字段名（小写比较）。 */
const SENSITIVE_KEYS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'secret',
  'token',
  'rawpassword',
  'csv',
]);

/** 脱敏占位符。 */
const MASKED = '******';

/** 持久化到 params 列的最大字符数。 */
const MAX_PARAMS_LENGTH = 2000;

/** 模块 key 到中文标签的映射。 */
const MODULE_LABELS = {
  auth: '认证',
  passwords: '密码管理',
  salary: '工资管理',
  ledger: '收支管理',
  logs: '日志管理',
  admin: '后台管理',
};

/**
 * 提取请求 URL 的路径部分（不含查询字符串）。
 *
 * @param {string} url - 请求 URL。
 * @returns {string} 路径部分。
 */
function pathOf(url) {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * 根据请求路径推导所属模块标签。
 *
 * @param {string} path - 请求路径。
 * @returns {string} 模块标签。
 */
function moduleOf(path) {
  const segments = path.split('/').filter((segment) => segment !== '');
  if (segments[0] !== 'api') {
    return segments[0] ?? 'unknown';
  }
  const key = segments[1] ?? 'unknown';
  return MODULE_LABELS[key] ?? key;
}

/**
 * 深度脱敏请求体：将敏感字段替换为占位符。
 *
 * @param {unknown} value - 待处理的值。
 * @returns {unknown} 脱敏后的值。
 */
function maskValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? MASKED : maskValue(item);
    }
    return result;
  }
  return value;
}

/**
 * 将请求体脱敏并序列化为可持久化的字符串。
 *
 * @param {unknown} body - 请求体。
 * @returns {string | null} 脱敏后的 JSON 字符串（截断），无请求体时为 null。
 */
export function maskParams(body) {
  if (body === null || body === undefined || (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0)) {
    return null;
  }
  const json = JSON.stringify(maskValue(body));
  if (json === undefined) {
    return null;
  }
  return json.length > MAX_PARAMS_LENGTH ? json.slice(0, MAX_PARAMS_LENGTH) : json;
}

/**
 * 在 Fastify 实例上注册操作日志钩子。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerOperationLog(app, context) {
  const service = context.services.operationLogService;
  app.addHook('onResponse', async (request, reply) => {
    const path = pathOf(request.url);
    if (!path.startsWith('/api/') || !LOGGED_METHODS.has(request.method)) {
      return;
    }
    const success = reply.statusCode < 400;
    try {
      service.save({
        userId: request.user?.id ?? null,
        username: request.user?.username ?? null,
        module: moduleOf(path),
        operation: `${request.method} ${path}`,
        method: request.method,
        params: maskParams(request.body),
        ip: getClientIp(request),
        status: success ? 'SUCCESS' : 'FAILURE',
        errorMsg: request.operationError ?? null,
        durationMs: Math.round(reply.elapsedTime ?? 0),
      });
    } catch {
      // 记录审计日志失败不应影响主流程与响应。
    }
  });
}

export default { registerOperationLog, maskParams };
