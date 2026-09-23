import { validateUpdateRolePermission } from '../common/validate.js';
import { ok } from './support.js';

/**
 * @file 角色权限管理路由（仅管理员）。
 *
 * 提供角色→可配置页面的权限矩阵查询与更新。访问控制由安全钩子
 * 按 `/api/admin/**` 统一限制为 ADMIN。
 */

/**
 * 注册角色权限管理路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerRolePermissionRoutes(app, context) {
  const { rolePermissionService } = context.services;

  app.get('/api/admin/roles', async () => ok(rolePermissionService.getMatrix()));

  app.put('/api/admin/roles/:role', async (request) => {
    const body = validateUpdateRolePermission(request.body ?? {});
    rolePermissionService.updatePermissions(request.params.role, body.pages);
    return ok(null, '更新成功');
  });
}

export default registerRolePermissionRoutes;
