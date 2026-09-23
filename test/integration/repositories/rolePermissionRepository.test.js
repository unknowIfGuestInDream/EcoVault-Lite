import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../../helpers/db.js';
import { RolePermissionRepository } from '../../../src/repositories/rolePermissionRepository.js';

/**
 * @file 角色权限仓储集成测试。
 */

let db;
let repository;

beforeEach(() => {
  db = createTestDatabase();
  repository = new RolePermissionRepository(db);
});

test('insert 幂等授予权限并按 id 升序查询', () => {
  repository.insert('ADMIN', 'dashboard');
  repository.insert('ADMIN', 'users');
  repository.insert('ADMIN', 'dashboard');
  repository.insert('USER', 'profile');

  assert.deepEqual(repository.findPageKeysByRole('ADMIN'), ['dashboard', 'users']);
  assert.deepEqual(
    repository.findByRole('ADMIN').map((row) => ({ role: row.role, pageKey: row.pageKey })),
    [
      { role: 'ADMIN', pageKey: 'dashboard' },
      { role: 'ADMIN', pageKey: 'users' },
    ]
  );
  assert.equal(repository.existsByRole('ADMIN'), true);
  assert.equal(repository.existsByRole('MISSING'), false);
  assert.deepEqual(repository.findByRole('MISSING'), []);
});

test('deleteByRole 返回删除数量并可重复删除', () => {
  repository.insert('ADMIN', 'dashboard');
  repository.insert('ADMIN', 'users');
  repository.insert('USER', 'profile');

  assert.equal(repository.deleteByRole('ADMIN'), 2);
  assert.equal(repository.deleteByRole('ADMIN'), 0);
  assert.deepEqual(repository.findPageKeysByRole('ADMIN'), []);
  assert.deepEqual(repository.findPageKeysByRole('USER'), ['profile']);
});

test('replaceForRole 原子替换权限集合并去重', () => {
  repository.insert('ADMIN', 'old');

  repository.replaceForRole('ADMIN', ['dashboard', 'users', 'dashboard']);
  assert.deepEqual(repository.findPageKeysByRole('ADMIN'), ['dashboard', 'users']);

  repository.replaceForRole('ADMIN', []);
  assert.deepEqual(repository.findByRole('ADMIN'), []);
  assert.equal(repository.existsByRole('ADMIN'), false);
});
