import { test } from 'node:test';
import assert from 'node:assert/strict';
import errors, {
  AccessDeniedError,
  AppError,
  AuthError,
  BusinessError,
  NotFoundError,
  ValidationError,
} from '../../../src/common/errors.js';

/**
 * @file 类型化应用错误测试。
 */

test('AppError 默认使用 HTTP 状态码作为业务码，也支持显式业务码', () => {
  const defaultCode = new AppError('默认业务码', 418);
  assert.equal(defaultCode.name, 'AppError');
  assert.equal(defaultCode.message, '默认业务码');
  assert.equal(defaultCode.status, 418);
  assert.equal(defaultCode.code, 418);

  const explicitCode = new AppError('显式业务码', 400, 10001);
  assert.equal(explicitCode.code, 10001);
});

test('业务与认证错误使用对应状态码和默认消息', () => {
  const business = new BusinessError('业务规则不满足');
  assert.equal(business.name, 'BusinessError');
  assert.equal(business.status, 400);
  assert.equal(business.code, 400);
  assert.equal(business.message, '业务规则不满足');

  const auth = new AuthError();
  assert.equal(auth.name, 'AuthError');
  assert.equal(auth.status, 401);
  assert.equal(auth.message, '未认证或登录已失效');
  assert.equal(new AuthError('令牌无效').message, '令牌无效');
});

test('访问拒绝与资源不存在错误支持默认消息和自定义消息', () => {
  const denied = new AccessDeniedError();
  assert.equal(denied.name, 'AccessDeniedError');
  assert.equal(denied.status, 403);
  assert.equal(denied.message, '无权访问该资源');
  assert.equal(new AccessDeniedError('仅管理员可访问').message, '仅管理员可访问');

  const notFound = new NotFoundError();
  assert.equal(notFound.name, 'NotFoundError');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.message, '资源不存在');
  assert.equal(new NotFoundError('用户不存在').message, '用户不存在');
});

test('ValidationError 支持数组消息与字符串消息', () => {
  const arrayError = new ValidationError(['用户名不能为空', '密码不能为空']);
  assert.equal(arrayError.name, 'ValidationError');
  assert.equal(arrayError.status, 400);
  assert.equal(arrayError.message, '用户名不能为空; 密码不能为空');
  assert.deepEqual(arrayError.messages, ['用户名不能为空', '密码不能为空']);

  const stringError = new ValidationError('标题不能为空');
  assert.equal(stringError.message, '标题不能为空');
  assert.deepEqual(stringError.messages, ['标题不能为空']);
});

test('默认导出包含所有错误类型', () => {
  assert.deepEqual(Object.keys(errors), [
    'AppError',
    'BusinessError',
    'AuthError',
    'AccessDeniedError',
    'NotFoundError',
    'ValidationError',
  ]);
});
