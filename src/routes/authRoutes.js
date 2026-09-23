import config from '../config/index.js';
import {
  validateLogin,
  validateChangePassword,
  validateUpdateProfile,
  validateVerifyPassword,
} from '../common/validate.js';
import { getClientIp } from '../utils/web.js';
import { ok, sanitizeUser } from './support.js';

/**
 * @file 认证与账号路由。
 *
 * 提供登录、登出、当前用户、资料更新、密码修改与隐私模式校验。
 * 系统不开放自助注册，普通用户仅能由管理员在后台创建。
 */

/**
 * 注册认证相关路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerAuthRoutes(app, context) {
  const { authService } = context.services;

  app.post('/api/auth/login', async (request, reply) => {
    const body = validateLogin(request.body ?? {});
    const result = authService.login(
      body,
      request.headers['user-agent'] ?? null,
      getClientIp(request)
    );
    reply.setCookie(config.jwt.cookieName, result.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      expires: new Date(result.expiresAt),
    });
    return ok(result.response, '登录成功');
  });

  app.post('/api/auth/logout', async (request, reply) => {
    authService.logout(request.auth?.jti ?? null);
    reply.clearCookie(config.jwt.cookieName, { path: '/' });
    return ok(null, '已退出登录');
  });

  app.get('/api/auth/me', async (request) => ok(sanitizeUser(request.user)));

  app.put('/api/auth/profile', async (request) => {
    const body = validateUpdateProfile(request.body ?? {});
    const updated = authService.updateProfile(request.user.id, body);
    return ok(sanitizeUser(updated), '资料已更新');
  });

  app.put('/api/auth/password', async (request, reply) => {
    const body = validateChangePassword(request.body ?? {});
    authService.changePassword(request.user.id, body);
    reply.clearCookie(config.jwt.cookieName, { path: '/' });
    return ok(null, '密码修改成功，请重新登录');
  });

  app.post('/api/auth/verify', async (request) => {
    const body = validateVerifyPassword(request.body ?? {});
    authService.verifyPassword(request.user.id, body.password);
    return ok(null, '验证通过');
  });
}

export default registerAuthRoutes;
