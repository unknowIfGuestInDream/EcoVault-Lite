import { validateSalary } from '../common/validate.js';
import { ok, parseId, toInt, sendCsv } from './support.js';

/**
 * @file 工资管理路由。
 *
 * 提供工资记录的增删改查、区间统计与 26 列 CSV 导入/导出。
 */

/**
 * 注册工资管理路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerSalaryRoutes(app, context) {
  const { salaryService } = context.services;

  app.get('/api/salary', async (request) => {
    const { startYear, endYear } = request.query;
    return ok(salaryService.list(request.user.id, toInt(startYear), toInt(endYear)));
  });

  app.get('/api/salary/statistics', async (request) => {
    const { startYear, endYear } = request.query;
    return ok(salaryService.statistics(request.user.id, toInt(startYear), toInt(endYear)));
  });

  app.get('/api/salary/export', async (request, reply) => {
    const { startYear, endYear } = request.query;
    const { csv, filename } = salaryService.exportCsv(
      request.user.id,
      toInt(startYear),
      toInt(endYear)
    );
    return sendCsv(reply, filename, csv);
  });

  app.post('/api/salary/import', async (request) => {
    const imported = salaryService.importCsv(request.user.id, request.body?.csv);
    return ok({ imported }, '导入成功');
  });

  app.post('/api/salary', async (request) => {
    const body = validateSalary(request.body ?? {});
    return ok(salaryService.save(request.user.id, body), '保存成功');
  });

  app.put('/api/salary/:id', async (request) => {
    const body = validateSalary(request.body ?? {});
    return ok(salaryService.update(request.user.id, parseId(request), body), '更新成功');
  });

  app.delete('/api/salary/:id', async (request) => {
    salaryService.delete(request.user.id, parseId(request));
    return ok(null, '删除成功');
  });
}

export default registerSalaryRoutes;
