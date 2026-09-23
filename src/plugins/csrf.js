import { randomUUID } from 'node:crypto';
import { AccessDeniedError } from '../common/errors.js';

/**
 * @file CSRF 防护（双重提交 cookie）。
 *
 * 向浏览器签发非 HttpOnly 的 `XSRF-TOKEN` cookie，且不安全
 * 请求必须在 `X-XSRF-TOKEN` header 中回传该值。登录端点
 * 被豁免强制校验。
 */

/** 携带 CSRF token 的 Cookie（可被 JS 读取，因此不是 HttpOnly）。 */
export const CSRF_COOKIE = 'XSRF-TOKEN';

/** 预期用于回传 CSRF cookie 值的 header。 */
export const CSRF_HEADER = 'x-xsrf-token';

/** 被视为会改变状态、因而受 CSRF 保护的 HTTP 方法。 */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
 * 在 Fastify 实例上注册 CSRF 双重提交钩子。
 *
 * @param {object} app - Fastify 实例。
 * @param {object} [options] - 豁免强制校验的路径。
 * @returns {void}
 */
export function registerCsrf(app, { exemptPaths = ['/api/auth/login'] } = {}) {
  const exempt = new Set(exemptPaths);
  app.addHook('onRequest', async (request, reply) => {
    let token = request.cookies?.[CSRF_COOKIE];
    if (!token) {
      token = randomUUID();
      reply.setCookie(CSRF_COOKIE, token, {
        path: '/',
        sameSite: 'strict',
        httpOnly: false,
      });
      request.cookies = { ...(request.cookies ?? {}), [CSRF_COOKIE]: token };
    }
    if (!UNSAFE_METHODS.has(request.method)) {
      return;
    }
    if (exempt.has(pathOf(request.url))) {
      return;
    }
    const header = request.headers[CSRF_HEADER];
    if (!header || header !== token) {
      throw new AccessDeniedError('CSRF 令牌无效');
    }
  });
}

export default { registerCsrf, CSRF_COOKIE, CSRF_HEADER };
