import { verifyToken } from '../security/jwt.js';
import { AuthError, AccessDeniedError } from '../common/errors.js';

/**
 * @file Authentication & authorization hooks.
 *
 * Reproduces the behaviour of the Java `JwtAuthenticationFilter` +
 * `SecurityConfig` pair:
 * - Tokens are resolved from an `Authorization: Bearer` header or the
 *   `ECOVAULT_TOKEN` cookie and validated against the active session store.
 * - Authorization is enforced centrally by URL pattern (public / admin / other)
 *   rather than per-route.
 */

/** Cookie name carrying the auth token (mirrors Java). */
export const TOKEN_COOKIE = 'ECOVAULT_TOKEN';

/** Exact paths that are always public. */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/error',
  '/favicon.ico',
  '/api/auth/login',
  '/health',
]);

/** Path prefixes that are always public. */
const PUBLIC_PREFIXES = ['/css/', '/js/', '/images/', '/webjars/'];

/** Base paths (with `/**`) that require the ADMIN role. */
const ADMIN_BASES = ['/actuator', '/admin', '/api/admin', '/api/logs'];

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
 * Whether a path is publicly accessible.
 *
 * @param {string} path - Request path.
 * @returns {boolean} True when no authentication is required.
 */
function isPublic(path) {
  if (PUBLIC_EXACT.has(path)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Whether a path requires the ADMIN role (Ant-style `/base/**`).
 *
 * @param {string} path - Request path.
 * @returns {boolean} True when the path is admin-only.
 */
function isAdminPath(path) {
  return ADMIN_BASES.some((base) => path === base || path.startsWith(`${base}/`));
}

/**
 * Whether a path belongs to the JSON API surface (used to choose between a 401
 * response and a redirect to the login page).
 *
 * @param {string} path - Request path.
 * @returns {boolean} True for `/api/...` paths.
 */
function isApiPath(path) {
  return path.startsWith('/api/');
}

/**
 * Resolve the bearer token from the request (header first, then cookie).
 *
 * @param {import('fastify').FastifyRequest} request - Incoming request.
 * @returns {string | null} The raw JWT, or null when absent.
 */
export function resolveToken(request) {
  const header = request.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const value = header.slice(7).trim();
    if (value !== '') {
      return value;
    }
  }
  const cookieToken = request.cookies?.[TOKEN_COOKIE];
  return cookieToken && cookieToken !== '' ? cookieToken : null;
}

/**
 * Register the authentication and authorization hooks on a Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} app - Fastify instance.
 * @param {import('../context.js').AppContext} context - Application context.
 * @returns {void}
 */
export function registerSecurity(app, context) {
  const { userRepository, userSessionRepository } = context.repositories;

  // 1. Authentication: resolve the current user without ever rejecting.
  app.addHook('onRequest', async (request) => {
    request.user = null;
    request.auth = null;
    const token = resolveToken(request);
    if (!token) {
      return;
    }
    let claims;
    try {
      claims = verifyToken(token);
    } catch {
      return;
    }
    const session = userSessionRepository.findByJti(claims.jti);
    if (!session || !session.active) {
      return;
    }
    const user = userRepository.findByUsername(claims.sub);
    if (!user || !user.enabled) {
      return;
    }
    request.user = user;
    request.auth = { jti: claims.jti, userId: user.id };
  });

  // 2. Authorization: enforce access by URL pattern.
  app.addHook('onRequest', async (request, reply) => {
    const path = pathOf(request.url);
    if (isPublic(path)) {
      return;
    }
    if (!request.user) {
      if (isApiPath(path)) {
        throw new AuthError();
      }
      return reply.redirect('/login');
    }
    if (isAdminPath(path) && request.user.role !== 'ADMIN') {
      if (isApiPath(path)) {
        throw new AccessDeniedError();
      }
      return reply.redirect('/dashboard');
    }
    return undefined;
  });
}

export default { registerSecurity, resolveToken, TOKEN_COOKIE };
