/**
 * @file 应用上下文依赖装配集成测试。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import createContext, { createContext as namedCreateContext } from '../../src/context.js';
import { createTestDatabase } from '../helpers/db.js';

const EXPECTED_REPOSITORIES = [
  'userRepository',
  'sessionRepository',
  'passwordEntryRepository',
  'salaryRecordRepository',
  'ledgerEntryRepository',
  'operationLogRepository',
  'rolePermissionRepository',
];

const EXPECTED_SERVICES = [
  'authService',
  'passwordService',
  'salaryService',
  'ledgerService',
  'operationLogService',
  'adminService',
  'rolePermissionService',
];

test('createContext 装配完整仓储、服务与令牌提供器', (t) => {
  const db = createTestDatabase();
  t.after(() => db.close());

  const context = namedCreateContext(db);

  assert.equal(createContext, namedCreateContext);
  assert.equal(context.db, db);
  assert.deepEqual(Object.keys(context.repositories), EXPECTED_REPOSITORIES);
  assert.deepEqual(Object.keys(context.services), EXPECTED_SERVICES);
  for (const repositoryKey of EXPECTED_REPOSITORIES) {
    assert.ok(context.repositories[repositoryKey]);
  }
  for (const serviceKey of EXPECTED_SERVICES) {
    assert.ok(context.services[serviceKey]);
  }
  assert.equal(context.tokenProvider.generateToken instanceof Function, true);
  assert.equal(context.tokenProvider.verifyToken instanceof Function, true);
});
