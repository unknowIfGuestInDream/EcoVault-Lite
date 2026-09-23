import { test } from 'node:test';
import assert from 'node:assert/strict';
import Role, { ROLE_VALUES, isRole } from '../../../src/domain/role.js';

/**
 * @file 用户角色定义测试。
 */

test('Role 暴露受支持的角色常量和值列表', () => {
  assert.deepEqual(Role, { ADMIN: 'ADMIN', USER: 'USER' });
  assert.deepEqual(ROLE_VALUES, ['ADMIN', 'USER']);
  assert.ok(Object.isFrozen(Role));
  assert.ok(Object.isFrozen(ROLE_VALUES));
});

test('isRole 识别有效角色并拒绝无效值', () => {
  assert.equal(isRole('ADMIN'), true);
  assert.equal(isRole('USER'), true);
  assert.equal(isRole('GUEST'), false);
  assert.equal(isRole(null), false);
});
