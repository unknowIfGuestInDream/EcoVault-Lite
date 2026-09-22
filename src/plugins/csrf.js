import { randomUUID } from 'node:crypto';
import { AccessDeniedError } from '../common/errors.js';

/**
 * @file CSRF protection (double-submit cookie).
 *
 * Mirrors the Java `CookieCsrfTokenRepository.withHttpOnlyFalse()` strategy:
 * a non-HttpOnly `XSRF-TOKEN` cookie is issued to the browser and unsafe
 * requests must echo it back in the `X-XSRF-TOKEN` header. The login endpoint
 * is exempt (matching the Spring `csrf.ignoringRequestMatchers` configuration).
 */

/** Cookie carrying the CSRF token (readable by JS, hence not HttpOnly). */
export const CSRF_COOKIE = 'XSRF-TOKEN';

/** Header expected to echo the CSRF cookie value. */
export const CSRF_HEADER = 'x-xsrf-token';

/** HTTP methods considered state-changing and therefore CSRF-protected. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Extract the path portion (without query string) of a request URL.
 *
 * @param {string} url - Raw request URL.
 * @returns {string} Path portion.
 */
function pathOf(url) {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * Register the CSRF double-submit hook on a Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} app - Fastify instance.
 * @param {{ exemptPaths?: string[] }} [options] - Paths exempt from enforcement.
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
