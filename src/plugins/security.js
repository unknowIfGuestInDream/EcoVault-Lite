import { verifyToken } from '../security/jwt.js';
import { AuthError, AccessDeniedError } from '../common/errors.js';

/**
 * @file 认证与授权钩子。
 *
 * 复现 Java `JwtAuthenticationFilter` +
 * `SecurityConfig` 组合的行为：
 * - token 从 `Authorization: Bearer` header 或
 *   `ECOVAULT_TOKEN` cookie 中解析，并根据活跃会话存储进行校验。
 * - 授权按 URL 模式集中强制执行（public / admin / other），
 *   而不是逐路由执行。
 */

/** 携带认证 token 的 Cookie 名称（对齐 Java）。 */
export const TOKEN_COOKIE = 'ECOVAULT_TOKEN';

/** 始终公开的精确路径。 */
const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/error',
  '/favicon.ico',
  '/api/auth/login',
  '/health',
]);

/** 始终公开的路径前缀。 */
const PUBLIC_PREFIXES = ['/css/', '/js/', '/images/', '/webjars/'];

/** 需要 ADMIN 角色的基础路径（带 `/**`）。 */
const ADMIN_BASES = ['/actuator', '/admin', '/api/admin', '/api/logs'];

/**
 * 提取请求 URL 的路径部分（不含查询字符串）。
 *
 * @param {string} url - 原始请求 URL。
 * @returns {string} 路径部分。
 */
function pathOf(url) {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * 判断路径是否可公开访问。
 *
 * @param {string} path - 请求路径。
 * @returns {boolean} 不需要认证时返回 true。
 */
function isPublic(path) {
  if (PUBLIC_EXACT.has(path)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * 判断路径是否需要 ADMIN 角色（Ant 风格 `/base/**`）。
 *
 * @param {string} path - 请求路径。
 * @returns {boolean} 路径仅管理员可访问时返回 true。
 */
function isAdminPath(path) {
  return ADMIN_BASES.some((base) => path === base || path.startsWith(`${base}/`));
}

/**
 * 判断路径是否属于 JSON API 表面（用于在 401
 * 响应与重定向到登录页之间选择）。
 *
 * @param {string} path - 请求路径。
 * @returns {boolean} `/api/...` 路径返回 true。
 */
function isApiPath(path) {
  return path.startsWith('/api/');
}

/**
 * 从请求中解析 bearer token（先 header，后 cookie）。
 *
 * @param {object} request - 传入请求。
 * @returns {string | null} 原始 JWT；不存在时返回 null。
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
 * 在 Fastify 实例上注册认证和授权钩子。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerSecurity(app, context) {
  const { userRepository, userSessionRepository } = context.repositories;

  // 1. 认证：解析当前用户，且绝不拒绝。
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

  // 2. 授权：按 URL 模式强制执行访问控制。
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
