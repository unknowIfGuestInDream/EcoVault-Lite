import { validateLedger } from '../common/validate.js';
import { formatDate } from '../utils/datetime.js';
import { ok, parseId, sendCsv } from './support.js';

/**
 * @file 收支账本路由。
 *
 * 提供账本条目的增删改查、按标签/区间的统计与 CSV 导出。
 */

/**
 * 注册收支账本路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerLedgerRoutes(app, context) {
  const { ledgerService } = context.services;

  app.get('/api/ledger', async (request) => {
    const { type, start, end, tag } = request.query;
    return ok(ledgerService.list(request.user.id, type, start, end, tag));
  });

  app.get('/api/ledger/statistics', async (request) => {
    const { type, start, end, tag } = request.query;
    return ok(ledgerService.statistics(request.user.id, type, start, end, tag));
  });

  app.get('/api/ledger/export', async (request, reply) => {
    const { type, start, end, tag } = request.query;
    const csv = ledgerService.exportCsv(request.user.id, type, start, end, tag);
    return sendCsv(reply, `ledger-${formatDate()}.csv`, csv);
  });

  app.post('/api/ledger', async (request) => {
    const body = validateLedger(request.body ?? {});
    return ok(ledgerService.create(request.user.id, body), '创建成功');
  });

  app.put('/api/ledger/:id', async (request) => {
    const body = validateLedger(request.body ?? {});
    return ok(ledgerService.update(request.user.id, parseId(request), body), '更新成功');
  });

  app.delete('/api/ledger/:id', async (request) => {
    ledgerService.delete(request.user.id, parseId(request));
    return ok(null, '删除成功');
  });
}

export default registerLedgerRoutes;
