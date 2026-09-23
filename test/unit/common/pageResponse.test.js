import { test } from 'node:test';
import assert from 'node:assert/strict';
import pageResponse from '../../../src/common/pageResponse.js';

/**
 * @file 分页响应辅助工具测试。
 */

test('pageResponse 在 size 大于 0 时计算总页数与首页状态', () => {
  assert.deepEqual(pageResponse(['a', 'b'], 0, 10, 25), {
    content: ['a', 'b'],
    number: 0,
    size: 10,
    totalElements: 25,
    totalPages: 3,
    first: true,
    last: false,
  });
});

test('pageResponse 识别中间页和最后一页边界', () => {
  assert.equal(pageResponse([], 1, 10, 25).first, false);
  assert.equal(pageResponse([], 1, 10, 25).last, false);
  assert.equal(pageResponse([], 2, 10, 25).last, true);
});

test('pageResponse 在 size 小于等于 0 时 totalPages 为 0', () => {
  assert.deepEqual(pageResponse([], -1, 0, 25), {
    content: [],
    number: -1,
    size: 0,
    totalElements: 25,
    totalPages: 0,
    first: true,
    last: true,
  });
  assert.equal(pageResponse([], 0, -5, 25).totalPages, 0);
  assert.equal(pageResponse([], 0, -5, 25).last, true);
});
