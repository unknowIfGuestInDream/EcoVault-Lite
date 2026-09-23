import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';

/**
 * @file 操作日志服务集成测试。
 */

let operationLogService;

function log(overrides = {}) {
  return {
    userId: 1,
    username: 'alice',
    module: 'auth',
    operation: '登录成功',
    method: 'POST',
    params: '{"password":"******","token":"******"}',
    ip: '127.0.0.1',
    status: 'SUCCESS',
    errorMsg: null,
    durationMs: 15,
    createdAt: '2024-01-01 00:00:00',
    ...overrides,
  };
}

function assertBusiness(fn, message) {
  assert.throws(fn, (error) => error.message === message && error.status === 400);
}

beforeEach(() => {
  ({
    services: { operationLogService },
  } = createTestContext());
});

test('save 持久化日志并保留已脱敏参数', () => {
  const id = operationLogService.save(log());
  const saved = operationLogService.getById(id);

  assert.equal(saved.username, 'alice');
  assert.equal(saved.params, '{"password":"******","token":"******"}');
  assert.equal(saved.durationMs, 15);
});

test('query 规范化分页、空过滤条件和大小上限', () => {
  operationLogService.save(log({ operation: '较早', createdAt: '2024-01-01 00:00:00' }));
  operationLogService.save(log({ operation: '较晚', createdAt: '2024-01-02 00:00:00' }));

  const negative = operationLogService.query({ module: '', keyword: ' ', page: -1, size: 0 });
  const clamped = operationLogService.query({ module: null, keyword: null, page: 0, size: 101 });

  assert.equal(negative.page, 0);
  assert.equal(negative.size, 1);
  assert.equal(negative.totalElements, 2);
  assert.equal(negative.content[0].operation, '较晚');
  assert.equal(clamped.size, 100);
  assert.equal(clamped.content.length, 2);
});

test('query 支持用户、模块、关键字和时间范围过滤', () => {
  const first = operationLogService.save(
    log({ userId: 0, module: 'vault', operation: '创建密码', createdAt: '2024-02-01 00:00:00' })
  );
  const second = operationLogService.save(
    log({ userId: 0, module: 'vault', operation: '删除密码', createdAt: '2024-02-02 00:00:00' })
  );
  operationLogService.save(
    log({ userId: 2, module: 'vault', operation: '删除密码', createdAt: '2024-02-03 00:00:00' })
  );
  operationLogService.save(
    log({ userId: 0, module: 'auth', operation: '删除密码', createdAt: '2024-02-04 00:00:00' })
  );

  const page0 = operationLogService.query({
    userId: 0,
    module: 'vault',
    keyword: '密码',
    start: '2024-02-01 00:00:00',
    end: '2024-02-28 23:59:59',
    page: 0,
    size: 1,
  });
  const page1 = operationLogService.query({
    userId: 0,
    module: 'vault',
    keyword: '密码',
    start: '2024-02-01 00:00:00',
    end: '2024-02-28 23:59:59',
    page: 1,
    size: 1,
  });

  assert.equal(page0.totalElements, 2);
  assert.deepEqual(
    page0.content.map((item) => item.id),
    [second]
  );
  assert.deepEqual(
    page1.content.map((item) => item.id),
    [first]
  );
});

test('getById、update、delete 覆盖成功、空字段和不存在分支', () => {
  const id = operationLogService.save(log({ module: 'old', operation: '旧操作' }));

  const updated = operationLogService.update(id, ' new ', ' 新操作 ');
  const unchanged = operationLogService.update(id, '', null);

  assert.equal(updated.module, 'new');
  assert.equal(updated.operation, '新操作');
  assert.equal(unchanged.module, 'new');
  assert.equal(unchanged.operation, '新操作');
  assertBusiness(() => operationLogService.getById(999), '日志不存在');
  assertBusiness(() => operationLogService.update(999, 'x', 'y'), '日志不存在');
  operationLogService.delete(id);
  assertBusiness(() => operationLogService.delete(id), '日志不存在');
});
