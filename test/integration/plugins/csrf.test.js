import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { failure, success } from '../../../src/common/apiResponse.js';
import { CSRF_COOKIE, CSRF_HEADER, registerCsrf } from '../../../src/plugins/csrf.js';

/**
 * @file CSRF 双重提交 Cookie 插件测试。
 */

async function buildApp(options) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  registerCsrf(app, options);
  app.setErrorHandler((error, request, reply) => {
    const status = error.status ?? 500;
    reply.code(status).send(failure(error.code ?? status, error.message));
  });

  app.get('/form', async (request) => success({ csrf: request.cookies[CSRF_COOKIE] }));
  app.post('/api/save', async () => success({ saved: true }));
  app.put('/api/save', async () => success({ saved: true }));
  app.delete('/api/save', async () => success({ deleted: true }));
  app.post('/api/auth/login', async () => success({ login: true }));

  return app;
}

function readXsrfCookie(response) {
  const setCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const xsrf = cookies.find((value) => value?.startsWith(`${CSRF_COOKIE}=`));
  return xsrf?.split(';')[0].slice(`${CSRF_COOKIE}=`.length);
}

test('GET 安全方法会下发 XSRF-TOKEN Cookie', async () => {
  const app = await buildApp();

  const response = await app.inject({ method: 'GET', url: '/form' });
  const token = readXsrfCookie(response);

  assert.equal(response.statusCode, 200);
  assert.match(token, /^[0-9a-f-]{36}$/);
  assert.equal(response.json().data.csrf, token);
  await app.close();
});

test('已有 XSRF-TOKEN Cookie 时会复用且不重复下发', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/form',
    cookies: { [CSRF_COOKIE]: 'existing-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.csrf, 'existing-token');
  assert.equal(response.headers['set-cookie'], undefined);
  await app.close();
});

test('POST 缺少 X-XSRF-TOKEN 头时返回 403', async () => {
  const app = await buildApp();

  const response = await app.inject({ method: 'POST', url: '/api/save' });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { code: 403, message: 'CSRF 令牌无效', data: null });
  await app.close();
});

test('PUT 携带不匹配的 X-XSRF-TOKEN 头时返回 403', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'PUT',
    url: '/api/save',
    cookies: { [CSRF_COOKIE]: 'cookie-token' },
    headers: { [CSRF_HEADER]: 'header-token' },
  });

  assert.equal(response.statusCode, 403);
  await app.close();
});

test('DELETE 头与 Cookie 匹配时通过校验', async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: 'DELETE',
    url: '/api/save',
    cookies: { [CSRF_COOKIE]: 'same-token' },
    headers: { [CSRF_HEADER]: 'same-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { code: 0, message: '成功', data: { deleted: true } });
  await app.close();
});

test('登录豁免路径跳过非安全方法校验并仍签发 Cookie', async () => {
  const app = await buildApp();

  const response = await app.inject({ method: 'POST', url: '/api/auth/login?next=%2Fdashboard' });

  assert.equal(response.statusCode, 200);
  assert.match(readXsrfCookie(response), /^[0-9a-f-]{36}$/);
  await app.close();
});

test('自定义豁免路径可以跳过校验', async () => {
  const app = await buildApp({ exemptPaths: ['/api/save'] });

  const response = await app.inject({ method: 'POST', url: '/api/save' });

  assert.equal(response.statusCode, 200);
  await app.close();
});

test('钩子在请求缺少 cookies 对象时会初始化 Cookie 容器', async () => {
  let hook;
  const app = {
    addHook(name, handler) {
      assert.equal(name, 'onRequest');
      hook = handler;
    },
  };
  const issued = [];
  const reply = {
    setCookie(name, value, options) {
      issued.push({ name, value, options });
    },
  };
  const request = { cookies: undefined, method: 'GET', url: '/form', headers: {} };

  registerCsrf(app);
  await hook(request, reply);

  assert.equal(issued.length, 1);
  assert.equal(issued[0].name, CSRF_COOKIE);
  assert.equal(request.cookies[CSRF_COOKIE], issued[0].value);
});
