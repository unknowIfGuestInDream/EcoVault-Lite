import { registerHealthRoutes } from './health.js';
import { registerAuthRoutes } from './authRoutes.js';
import { registerPasswordRoutes } from './passwordRoutes.js';
import { registerSalaryRoutes } from './salaryRoutes.js';
import { registerLedgerRoutes } from './ledgerRoutes.js';
import { registerLogRoutes } from './logRoutes.js';
import { registerAdminRoutes } from './adminRoutes.js';
import { registerRolePermissionRoutes } from './rolePermissionRoutes.js';
import { registerPageRoutes } from './pageRoutes.js';

/**
 * @file 路由装配入口。
 *
 * 按模块聚合注册全部 HTTP 路由（API 与页面）。
 */

/**
 * 注册应用的全部路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerRoutes(app, context) {
  registerHealthRoutes(app, context);
  registerAuthRoutes(app, context);
  registerPasswordRoutes(app, context);
  registerSalaryRoutes(app, context);
  registerLedgerRoutes(app, context);
  registerLogRoutes(app, context);
  registerAdminRoutes(app, context);
  registerRolePermissionRoutes(app, context);
  registerPageRoutes(app, context);
}

export default registerRoutes;
