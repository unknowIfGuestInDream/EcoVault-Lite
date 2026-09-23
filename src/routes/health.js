import { nowDateTime } from '../utils/datetime.js';
import { ok } from './support.js';

/**
 * @file 健康检查路由。
 *
 * 暴露 `/health` 供部署脚本与运维探针使用（公开访问）。
 */

/**
 * 注册健康检查路由。
 *
 * @param {object} app - Fastify 实例。
 * @returns {void}
 */
export function registerHealthRoutes(app) {
  app.get('/health', async () => ok({ status: 'UP', timestamp: nowDateTime() }));
}

export default registerHealthRoutes;
