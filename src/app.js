import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import ejs from 'ejs';

import { registerOperationLog } from './plugins/operationLog.js';
import { registerSecurity } from './plugins/security.js';
import { registerCsrf } from './plugins/csrf.js';
import { registerRoutes } from './routes/index.js';
import { failure } from './common/apiResponse.js';

/**
 * @file Fastify 应用装配。
 *
 * 按固定顺序注册核心插件（cookie、表单解析、视图、静态资源）、
 * 横切钩子（操作日志、认证授权、CSRF）与全部路由，并挂载统一的
 * 错误处理与未找到处理，使响应符合 `{ code, message, data }` 契约。
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 提取请求 URL 的路径部分（不含查询字符串）。
 *
 * @param {string} url - 请求 URL。
 * @returns {string} 路径部分。
 */
function pathOf(url) {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * 构建并装配 Fastify 应用实例。
 *
 * @param {AppContext} context - 应用上下文（仓储 + 服务）。
 * @param {object} [options] - 可选项。
 * @param {boolean|object} [options.logger] - Fastify 日志设置（默认关闭）。
 * @returns {Promise<object>} 已装配的应用实例（Fastify 实例）。
 */
export async function buildApp(context, options = {}) {
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(fastifyCookie);
  await app.register(fastifyFormbody);
  await app.register(fastifyView, {
    engine: { ejs },
    root: path.join(moduleDir, 'views'),
  });
  await app.register(fastifyStatic, {
    root: path.join(moduleDir, '..', 'public'),
    prefix: '/',
    index: false,
  });

  registerOperationLog(app, context);
  registerSecurity(app, context);
  registerCsrf(app);
  registerRoutes(app, context);

  app.setErrorHandler((error, request, reply) => {
    const status = Number.isInteger(error.status)
      ? error.status
      : Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;
    const code = Number.isInteger(error.code) ? error.code : status;
    request.operationError = error.message;
    const message = status >= 500 ? '服务器内部错误' : error.message;
    if (status >= 500) {
      request.log.error(error);
    }
    if (pathOf(request.url).startsWith('/api/')) {
      return reply.status(status).send(failure(code, message));
    }
    return reply.status(status).view('error.ejs', { title: '出错了', message });
  });

  app.setNotFoundHandler((request, reply) => {
    if (pathOf(request.url).startsWith('/api/')) {
      return reply.status(404).send(failure(404, '接口不存在'));
    }
    return reply.status(404).view('error.ejs', { title: '页面不存在', message: '页面不存在' });
  });

  return app;
}

export default buildApp;
