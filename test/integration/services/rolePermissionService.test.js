import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';
import { Role } from '../../../src/domain/role.js';

/**
 * @file 角色权限服务集成测试。
 */

let db;
let repositories;
let rolePermissionService;

function assertBusiness(fn, message) {
  assert.throws(fn, (error) => error.message === message && error.status === 400);
}

beforeEach(() => {
  ({
    db,
    repositories,
    services: { rolePermissionService },
  } = createTestContext());
});

test('initDefaults 为缺失角色种子化默认权限且保留已有角色', () => {
  repositories.rolePermissionRepository.insert(Role.USER, 'passwords');

  rolePermissionService.initDefaults();
  rolePermissionService.initDefaults();

  assert.deepEqual(repositories.rolePermissionRepository.findPageKeysByRole(Role.USER), [
    'passwords',
  ]);
  assert.deepEqual(repositories.rolePermissionRepository.findPageKeysByRole(Role.ADMIN), [
    'passwords',
    'salary',
    'ledger',
  ]);
});

test('getMatrix 返回可配置页面与角色权限矩阵并过滤非法页面', () => {
  rolePermissionService.initDefaults();
  db.prepare('INSERT INTO role_permissions (role, page_key) VALUES (?, ?)').run(Role.USER, '非法');

  const matrix = rolePermissionService.getMatrix();

  assert.deepEqual(
    matrix.pages.map((page) => page.key),
    ['passwords', 'salary', 'ledger']
  );
  assert.deepEqual(matrix.roles.find((role) => role.role === Role.USER).allowedPages, [
    'passwords',
    'salary',
    'ledger',
  ]);
});

test('updatePermissions 保护 ADMIN、校验非法页面并替换普通角色权限', () => {
  assertBusiness(
    () => rolePermissionService.updatePermissions(Role.ADMIN, ['passwords']),
    'ADMIN 角色默认拥有全部页面访问权限，不允许修改'
  );
  assertBusiness(
    () => rolePermissionService.updatePermissions(Role.USER, ['passwords', 'missing']),
    '非法的页面: missing'
  );

  rolePermissionService.updatePermissions(Role.USER, [
    null,
    undefined,
    '',
    ' salary ',
    'salary',
    'ledger',
  ]);
  assert.deepEqual(repositories.rolePermissionRepository.findPageKeysByRole(Role.USER), [
    'salary',
    'ledger',
  ]);

  rolePermissionService.updatePermissions(Role.USER, null);
  assert.deepEqual(repositories.rolePermissionRepository.findPageKeysByRole(Role.USER), []);
});

test('accessiblePageKeys 返回匿名、普通用户和管理员可访问页面', () => {
  rolePermissionService.updatePermissions(Role.USER, ['ledger']);

  assert.deepEqual(rolePermissionService.accessiblePageKeys(null), ['dashboard', 'profile']);
  assert.deepEqual(rolePermissionService.accessiblePageKeys({ role: Role.USER }), [
    'dashboard',
    'profile',
    'ledger',
  ]);
  assert.deepEqual(rolePermissionService.accessiblePageKeys({ role: Role.ADMIN }), [
    'dashboard',
    'profile',
    'passwords',
    'salary',
    'ledger',
    'users',
    'logs',
    'roles',
  ]);
});

test('canAccessPath 覆盖未知、管理、可配置和公开路径', () => {
  rolePermissionService.updatePermissions(Role.USER, ['salary']);

  assert.equal(rolePermissionService.canAccessPath(null, '/unknown'), true);
  assert.equal(rolePermissionService.canAccessPath(null, '/dashboard'), true);
  assert.equal(rolePermissionService.canAccessPath(null, '/admin/users'), false);
  assert.equal(rolePermissionService.canAccessPath({ role: Role.ADMIN }, '/admin/users'), true);
  assert.equal(rolePermissionService.canAccessPath({ role: Role.ADMIN }, '/finance/ledger'), true);
  assert.equal(rolePermissionService.canAccessPath({ role: Role.USER }, '/finance'), true);
  assert.equal(rolePermissionService.canAccessPath({ role: Role.USER }, '/finance/ledger'), false);
  assert.equal(rolePermissionService.canAccessPath(null, '/finance'), false);
});
