import { test } from 'node:test';
import assert from 'node:assert/strict';
import apiResponse, { failure, success } from '../../../src/common/apiResponse.js';

/**
 * @file 统一 API 响应封装测试。
 */

test('success 使用默认参数并将空载荷规范化为 null', () => {
  assert.deepEqual(success(), { code: 0, message: '成功', data: null });
  assert.deepEqual(success(undefined, '已完成'), { code: 0, message: '已完成', data: null });
});

test('success 支持自定义消息与非空数据', () => {
  assert.deepEqual(success({ id: 1 }, '创建成功'), {
    code: 0,
    message: '创建成功',
    data: { id: 1 },
  });
});

test('failure 构建错误响应并固定 data 为 null', () => {
  assert.deepEqual(failure(400, '请求错误'), { code: 400, message: '请求错误', data: null });
});

test('默认导出包含响应构建函数与常量', () => {
  assert.equal(apiResponse.success, success);
  assert.equal(apiResponse.failure, failure);
  assert.equal(apiResponse.SUCCESS_CODE, 0);
  assert.equal(apiResponse.SUCCESS_MESSAGE, '成功');
});
