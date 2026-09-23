import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { failure, success } from '../../../src/common/apiResponse.js';
import { registerSecurity, resolveToken, TOKEN_COOKIE } from '../../../src/plugins/security.js';
import { createTestContext, insertUser } from '../../helpers/db.js';

/**
 * @file 认证与授权 Fastify 插件测试。
 */

async function buildApp(context) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  registerSecurity(app, context);
  app.setErrorHandler((error, request, reply) => {
    const status = error.status ?? 500;
    reply.code(status).send(failure(error.code ?? status, error.message));
  });

  app.get('/health', async () => success({ ok: true }));
  app.get('/js/app.js', async () => 'console.log("ok");');
  app.get('/api/private', async (request) =>
    success({ username: request.user?.username ?? null, jti: request.auth?.jti ?? null })
  );
  app.get('/dashboard', async (request) => success({ username: request.user?.username ?? null }));
  app.get('/admin', async () => success({ page: 'admin' }));
  app.get('/admin/panel', async () => success({ page: 'admin-panel' }));
  app.get('/api/admin/panel', async () => success({ api: 'admin' }));
  app.get('/api/logs/audit', async () => success({ api: 'logs' }));

  return app;
}

function bearer(token) {
  return ['Bear', 'er ', token].join('');
}

function issueToken(context, user, active = true) {
  const generated = context.tokenProvider.generateToken({
    userId: user.id,
    username: user.username,
  });
  context.repositories.sessionRepository.insert({ userId: user.id, jti: generated.jti });
  if (!active) {
    context.repositories.sessionRepository.deactivateByJti(generated.jti);
  }
  return generated;
}

test('resolveToken 优先读取 Authorization 头并回退到 Cookie', () => {
  assert.equal(
    resolveToken({
      headers: { authorization: bearer('header-token') },
      cookies: { [TOKEN_COOKIE]: 'c' },
    }),
    'header-token'
  );
  assert.equal(
    resolveToken({
      headers: { authorization: 'Bearer   ' },
      cookies: { [TOKEN_COOKIE]: 'cookie-token' },
    }),
    'cookie-token'
  );
  assert.equal(
    resolveToken({ headers: { authorization: 'Basic abc' }, cookies: { [TOKEN_COOKIE]: '' } }),
    null
  );
  assert.equal(resolveToken({ headers: {}, cookies: undefined }), null);
});

test('公共精确路径与静态资源前缀无需认证', async () => {
  const { context } = createTestContext();
  const app = await buildApp(context);

  const health = await app.inject({ method: 'GET', url: '/health?from=test' });
  const asset = await app.inject({ method: 'GET', url: '/js/app.js' });

  assert.equal(health.statusCode, 200);
  assert.equal(asset.statusCode, 200);
  await app.close();
});

test('未认证访问 API 返回 401，访问页面重定向到登录页', async () => {
  const { context } = createTestContext();
  const app = await buildApp(context);

  const api = await app.inject({ method: 'GET', url: '/api/private?x=1' });
  const page = await app.inject({ method: 'GET', url: '/dashboard' });

  assert.equal(api.statusCode, 401);
  assert.deepEqual(api.json(), { code: 401, message: '未认证或登录已失效', data: null });
  assert.equal(page.statusCode, 302);
  assert.equal(page.headers.location, '/login');
  await app.close();
});

test('无效令牌不会挂载用户并按未认证处理', async () => {
  const { context } = createTestContext();
  const app = await buildApp(context);

  const response = await app.inject({
    method: 'GET',
    url: '/api/private',
    headers: { authorization: bearer('invalid-token') },
  });

  assert.equal(response.statusCode, 401);
  await app.close();
});

test('有效令牌缺少会话或会话停用时按未认证处理', async () => {
  const { context } = createTestContext();
  const missingSessionUser = insertUser(context.db, { username: 'missing-session' });
  const inactiveUser = insertUser(context.db, { username: 'inactive-session' });
  const missingSessionToken = context.tokenProvider.generateToken({
    userId: missingSessionUser.id,
    username: missingSessionUser.username,
  }).token;
  const inactiveToken = issueToken(context, inactiveUser, false).token;
  const app = await buildApp(context);

  const missingSession = await app.inject({
    method: 'GET',
    url: '/api/private',
    headers: { authorization: bearer(missingSessionToken) },
  });
  const inactiveSession = await app.inject({
    method: 'GET',
    url: '/api/private',
    headers: { authorization: bearer(inactiveToken) },
  });

  assert.equal(missingSession.statusCode, 401);
  assert.equal(inactiveSession.statusCode, 401);
  await app.close();
});

test('有效会话对应用户被禁用时按未认证处理', async () => {
  const { context } = createTestContext();
  const user = insertUser(context.db, { username: 'disabled-user', enabled: 0 });
  const token = issueToken(context, user).token;
  const app = await buildApp(context);

  const response = await app.inject({
    method: 'GET',
    url: '/api/private',
    headers: { authorization: bearer(token) },
  });

  assert.equal(response.statusCode, 401);
  await app.close();
});

test('有效令牌与活跃会话会挂载 request.user 与 request.auth', async () => {
  const { context } = createTestContext();
  const user = insertUser(context.db, { username: 'cookie-user' });
  const generated = issueToken(context, user);
  const app = await buildApp(context);

  const response = await app.inject({
    method: 'GET',
    url: '/api/private',
    cookies: { [TOKEN_COOKIE]: generated.token },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    code: 0,
    message: '成功',
    data: { username: 'cookie-user', jti: generated.jti },
  });
  await app.close();
});

test('USER 访问管理路径时 API 返回 403，页面重定向到仪表盘', async () => {
  const { context } = createTestContext();
  const user = insertUser(context.db, { username: 'plain-user', role: 'USER' });
  const token = issueToken(context, user).token;
  const app = await buildApp(context);

  const api = await app.inject({
    method: 'GET',
    url: '/api/admin/panel',
    headers: { authorization: bearer(token) },
  });
  const logs = await app.inject({
    method: 'GET',
    url: '/api/logs/audit',
    headers: { authorization: bearer(token) },
  });
  const page = await app.inject({
    method: 'GET',
    url: '/admin',
    headers: { authorization: bearer(token) },
  });

  assert.equal(api.statusCode, 403);
  assert.deepEqual(api.json(), { code: 403, message: '无权访问该资源', data: null });
  assert.equal(logs.statusCode, 403);
  assert.equal(page.statusCode, 302);
  assert.equal(page.headers.location, '/dashboard');
  await app.close();
});

test('ADMIN 可以访问页面与 API 管理路径', async () => {
  const { context } = createTestContext();
  const admin = insertUser(context.db, { username: 'admin-user', role: 'ADMIN' });
  const token = issueToken(context, admin).token;
  const app = await buildApp(context);

  const page = await app.inject({
    method: 'GET',
    url: '/admin/panel',
    headers: { authorization: bearer(token) },
  });
  const api = await app.inject({
    method: 'GET',
    url: '/api/admin/panel',
    headers: { authorization: bearer(token) },
  });

  assert.equal(page.statusCode, 200);
  assert.equal(api.statusCode, 200);
  await app.close();
});
