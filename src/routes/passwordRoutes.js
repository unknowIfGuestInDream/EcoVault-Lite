import { validatePasswordEntry } from '../common/validate.js';
import { ok, parseId } from './support.js';

/**
 * @file 密码保险箱路由。
 *
 * 提供密码条目的增删改查；列表返回脱敏后的 secret。
 */

/**
 * 注册密码保险箱路由。
 *
 * @param {object} app - Fastify 实例。
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function registerPasswordRoutes(app, context) {
  const { passwordService } = context.services;

  app.get('/api/passwords', async (request) => {
    const { keyword, tag } = request.query;
    return ok(passwordService.list(request.user.id, keyword, tag));
  });

  app.post('/api/passwords', async (request) => {
    const body = validatePasswordEntry(request.body ?? {});
    return ok(passwordService.create(request.user.id, body), '创建成功');
  });

  app.get('/api/passwords/:id', async (request) =>
    ok(passwordService.get(request.user.id, parseId(request)))
  );

  app.put('/api/passwords/:id', async (request) => {
    const body = validatePasswordEntry(request.body ?? {});
    return ok(passwordService.update(request.user.id, parseId(request), body), '更新成功');
  });

  app.delete('/api/passwords/:id', async (request) => {
    passwordService.delete(request.user.id, parseId(request));
    return ok(null, '删除成功');
  });
}

export default registerPasswordRoutes;
