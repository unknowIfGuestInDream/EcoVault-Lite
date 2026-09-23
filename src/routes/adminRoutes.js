import { validateRegister, validateUpdateUser } from '../common/validate.js';
import { ok, parseId, sanitizeUser } from './support.js';

/**
 * @file 后台用户管理路由（仅管理员）。
 *
 * 提供用户列表、创建、更新、启用/禁用与删除。访问控制由安全钩子
 * 按 `/api/admin/**` 统一限制为 ADMIN。普通用户仅能由此创建。
 */

/**
 * 注册后台用户管理路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerAdminRoutes(app, context) {
  const { adminService, authService } = context.services;

  app.get('/api/admin/users', async () => ok(adminService.listUsers()));

  app.post('/api/admin/users', async (request) => {
    const body = validateRegister(request.body ?? {});
    const user = authService.register(body);
    return ok(sanitizeUser(user), '创建成功');
  });

  app.put('/api/admin/users/:id', async (request) => {
    const body = validateUpdateUser(request.body ?? {});
    return ok(adminService.updateUser(parseId(request), body, request.user.id), '更新成功');
  });

  app.patch('/api/admin/users/:id/status', async (request) => {
    const raw = request.body?.enabled;
    const enabled = raw === true || raw === 'true';
    adminService.setUserEnabled(parseId(request), enabled, request.user.id);
    return ok(null, enabled ? '账号已启用' : '账号已禁用');
  });

  app.delete('/api/admin/users/:id', async (request) => {
    adminService.deleteUser(parseId(request));
    return ok(null, '删除成功');
  });
}

export default registerAdminRoutes;
