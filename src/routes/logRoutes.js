import { validateUpdateLog } from '../common/validate.js';
import { pageResponse } from '../common/pageResponse.js';
import { ok, parseId, toInt } from './support.js';

/**
 * @file 操作日志管理路由（仅管理员）。
 *
 * 提供审计日志的分页查询、详情、编辑与删除。访问控制由安全钩子
 * 按 `/api/logs/**` 统一限制为 ADMIN。
 */

/**
 * 注册操作日志管理路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerLogRoutes(app, context) {
  const { operationLogService } = context.services;

  app.get('/api/logs', async (request) => {
    const { module, keyword, start, end } = request.query;
    const page = toInt(request.query.page) ?? 0;
    const size = toInt(request.query.size) ?? 20;
    const result = operationLogService.query({ module, keyword, start, end, page, size });
    return ok(pageResponse(result.content, result.page, result.size, result.totalElements));
  });

  app.get('/api/logs/:id', async (request) => ok(operationLogService.getById(parseId(request))));

  app.put('/api/logs/:id', async (request) => {
    const body = validateUpdateLog(request.body ?? {});
    return ok(
      operationLogService.update(parseId(request), body.module, body.operation),
      '更新成功'
    );
  });

  app.delete('/api/logs/:id', async (request) => {
    operationLogService.delete(parseId(request));
    return ok(null, '删除成功');
  });
}

export default registerLogRoutes;
