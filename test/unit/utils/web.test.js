import { test } from 'node:test';
import assert from 'node:assert/strict';
import web, { getClientIp } from '../../../src/utils/web.js';

/**
 * @file HTTP 请求辅助工具测试。
 */

test('getClientIp 在没有请求对象时返回 unknown', () => {
  assert.equal(getClientIp(), 'unknown');
});

test('getClientIp 优先使用 x-forwarded-for 的第一个可用地址', () => {
  assert.equal(
    getClientIp({
      headers: { 'x-forwarded-for': ' 203.0.113.10, 198.51.100.2 ' },
      socket: { remoteAddress: '10.0.0.1' },
      ip: '10.0.0.2',
    }),
    '203.0.113.10'
  );
});

test('getClientIp 在 x-forwarded-for 不可用时继续回退', () => {
  assert.equal(
    getClientIp({
      headers: { 'x-forwarded-for': 'unknown', 'x-real-ip': ' 198.51.100.8 ' },
    }),
    '198.51.100.8'
  );
  assert.equal(
    getClientIp({
      headers: { 'x-forwarded-for': '   ', 'x-real-ip': '198.51.100.9' },
    }),
    '198.51.100.9'
  );
  assert.equal(
    getClientIp({
      headers: { 'x-forwarded-for': '', 'x-real-ip': '198.51.100.10' },
    }),
    '198.51.100.10'
  );
});

test('getClientIp 在 forwarded 第一段为空时继续使用后续来源', () => {
  assert.equal(
    getClientIp({
      headers: { 'x-forwarded-for': ' , 203.0.113.11', 'x-real-ip': '198.51.100.11' },
    }),
    '198.51.100.11'
  );
});

test('getClientIp 按顺序回退到 socket、request.ip 与 unknown', () => {
  assert.equal(getClientIp({ socket: { remoteAddress: '192.0.2.0' } }), '192.0.2.0');
  assert.equal(
    getClientIp({
      headers: { 'x-real-ip': 'unknown' },
      socket: { remoteAddress: '192.0.2.1' },
      ip: '192.0.2.2',
    }),
    '192.0.2.1'
  );
  assert.equal(getClientIp({ headers: {}, socket: {}, ip: '192.0.2.3' }), '192.0.2.3');
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '' }, ip: '' }), 'unknown');
});

test('默认导出包含 getClientIp', () => {
  assert.equal(web.getClientIp, getClientIp);
});
