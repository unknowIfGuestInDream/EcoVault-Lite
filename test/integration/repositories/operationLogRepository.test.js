import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../helpers/db.js';
import { OperationLogRepository } from '../../../src/repositories/operationLogRepository.js';

/**
 * @file 操作日志仓储集成测试。
 */

let db;
let repository;

function insertLog(overrides = {}) {
  return repository.insert({
    userId: 1,
    username: 'alice',
    module: 'vault',
    operation: '创建密码',
    method: 'POST',
    params: '{}',
    ip: '127.0.0.1',
    status: 'SUCCESS',
    errorMsg: null,
    durationMs: 12,
    createdAt: '2024-01-01 00:00:00',
    ...overrides,
  });
}

beforeEach(() => {
  db = createTestDatabase();
  repository = new OperationLogRepository(db);
});

test('insert 支持完整字段、默认值和按 id 查询', () => {
  const fullId = insertLog();
  const defaultsId = repository.insert({});

  const full = repository.findById(fullId);
  assert.equal(full.userId, 1);
  assert.equal(full.username, 'alice');
  assert.equal(full.durationMs, 12);
  assert.equal(full.errorMsg, null);

  const defaults = repository.findById(defaultsId);
  assert.equal(defaults.userId, null);
  assert.equal(defaults.username, null);
  assert.equal(defaults.module, null);
  assert.equal(defaults.operation, null);
  assert.equal(defaults.method, null);
  assert.equal(defaults.params, null);
  assert.equal(defaults.ip, null);
  assert.equal(defaults.status, null);
  assert.equal(defaults.errorMsg, null);
  assert.equal(defaults.durationMs, 0);
  assert.equal(repository.findById(999), null);
});

test('search 无过滤时使用默认分页并按创建时间与 id 降序', () => {
  const older = insertLog({ createdAt: '2024-01-01 00:00:00', operation: '较早' });
  const sameTimeLowerId = insertLog({ createdAt: '2024-01-02 00:00:00', operation: '同秒低 id' });
  const sameTimeHigherId = insertLog({ createdAt: '2024-01-02 00:00:00', operation: '同秒高 id' });

  const result = repository.search({ page: -1, size: 0 });

  assert.equal(result.totalElements, 3);
  assert.deepEqual(
    result.content.map((log) => log.id),
    [sameTimeHigherId, sameTimeLowerId, older]
  );
});

test('search 组合过滤条件并应用 limit 与 offset', () => {
  const first = insertLog({
    userId: 0,
    module: 'auth',
    operation: '登录成功',
    createdAt: '2024-02-01 00:00:00',
  });
  const second = insertLog({
    userId: 0,
    module: 'auth',
    operation: '登录失败',
    createdAt: '2024-02-02 00:00:00',
    status: 'FAIL',
  });
  insertLog({
    userId: null,
    module: 'auth',
    operation: '登录成功',
    createdAt: '2024-02-03 00:00:00',
  });
  insertLog({
    userId: 0,
    module: 'vault',
    operation: '登录成功',
    createdAt: '2024-02-04 00:00:00',
  });

  const firstPage = repository.search({
    userId: 0,
    module: 'auth',
    keyword: '登录',
    start: '2024-02-01 00:00:00',
    end: '2024-02-28 23:59:59',
    page: 0,
    size: 1,
  });
  const secondPage = repository.search({
    userId: 0,
    module: 'auth',
    keyword: '登录',
    start: '2024-02-01 00:00:00',
    end: '2024-02-28 23:59:59',
    page: 1,
    size: 1,
  });

  assert.equal(firstPage.totalElements, 2);
  assert.deepEqual(
    firstPage.content.map((log) => log.id),
    [second]
  );
  assert.deepEqual(
    secondPage.content.map((log) => log.id),
    [first]
  );
  assert.deepEqual(repository.search({ userId: null, module: 'missing' }).content, []);
});

test('update 合并字段并处理不存在日志', () => {
  const id = insertLog({ module: 'old', operation: '旧操作' });

  const moduleOnly = repository.update(id, { module: 'new' });
  assert.equal(moduleOnly.module, 'new');
  assert.equal(moduleOnly.operation, '旧操作');

  const operationOnly = repository.update(id, { operation: '新操作' });
  assert.equal(operationOnly.module, 'new');
  assert.equal(operationOnly.operation, '新操作');
  assert.equal(repository.update(999, { module: 'none' }), null);
});

test('deleteById 返回删除结果', () => {
  const id = insertLog();

  assert.equal(repository.deleteById(id), true);
  assert.equal(repository.findById(id), null);
  assert.equal(repository.deleteById(id), false);
});
