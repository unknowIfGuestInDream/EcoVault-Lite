import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';

/**
 * @file 管理服务集成测试。
 */

let repositories;
let authService;
let adminService;
let admin;
let user;

function assertBusiness(fn, message) {
  assert.throws(fn, (error) => error.message === message && error.status === 400);
}

function activeCount(userId) {
  return repositories.sessionRepository.findActiveByUser(userId).length;
}

beforeEach(() => {
  ({
    repositories,
    services: { authService, adminService },
  } = createTestContext());
  admin = authService.register({
    username: 'admin',
    password: 'Admin123!',
    nickname: '管理员',
    email: 'admin@example.com',
    role: 'ADMIN',
  });
  user = authService.register({
    username: 'normal',
    password: 'User123!',
    nickname: '普通用户',
    email: 'user@example.com',
    role: 'USER',
  });
});

test('listUsers 返回管理员视图且不暴露密码', () => {
  const users = adminService.listUsers();

  assert.deepEqual(
    users.map((item) => item.username),
    ['admin', 'normal']
  );
  assert.equal(users[0].password, undefined);
  assert.equal(users[0].createdAt, admin.createdAt);
});

test('setUserEnabled 启用不吊销会话、禁用会吊销会话并保护自身', () => {
  authService.login({ username: 'normal', password: 'User123!' });

  adminService.setUserEnabled(user.id, true, admin.id);
  assert.equal(activeCount(user.id), 1);
  adminService.setUserEnabled(user.id, false, admin.id);
  assert.equal(repositories.userRepository.findById(user.id).enabled, false);
  assert.equal(activeCount(user.id), 0);
  assertBusiness(() => adminService.setUserEnabled(999, false, admin.id), '用户不存在');
  assertBusiness(
    () => adminService.setUserEnabled(admin.id, false, admin.id),
    '不能禁用当前登录的账号'
  );
});

test('updateUser 更新昵称、邮箱、角色、密码并吊销会话', () => {
  authService.login({ username: 'normal', password: 'User123!' });

  const updated = adminService.updateUser(
    user.id,
    {
      nickname: ' 新昵称 ',
      email: null,
      role: 'admin',
      password: 'NewPass123!',
    },
    admin.id
  );

  assert.equal(updated.nickname, '新昵称');
  assert.equal(updated.email, 'user@example.com');
  assert.equal(updated.role, 'ADMIN');
  assert.equal(activeCount(user.id), 0);
  assert.ok(authService.login({ username: 'normal', password: 'NewPass123!' }).token);
});

test('updateUser 忽略空字段、支持禁用用户并校验错误路径', () => {
  authService.login({ username: 'normal', password: 'User123!' });

  const unchanged = adminService.updateUser(
    user.id,
    { nickname: ' ', email: undefined, role: '', password: '', enabled: null },
    admin.id
  );
  const emailed = adminService.updateUser(user.id, { email: 'changed@example.com' }, admin.id);
  const disabled = adminService.updateUser(user.id, { enabled: false }, admin.id);

  assert.equal(unchanged.nickname, '普通用户');
  assert.equal(unchanged.email, 'user@example.com');
  assert.equal(unchanged.role, 'USER');
  assert.equal(emailed.email, 'changed@example.com');
  assert.equal(disabled.enabled, false);
  assert.equal(activeCount(user.id), 0);
  assertBusiness(() => adminService.updateUser(999, {}, admin.id), '用户不存在');
  assertBusiness(() => adminService.updateUser(user.id, { role: 'ROOT' }, admin.id), '角色不合法');
  assertBusiness(
    () => adminService.updateUser(admin.id, { enabled: false }, admin.id),
    '不能禁用当前登录的账号'
  );
});

test('deleteUser 删除用户并吊销全部会话', () => {
  authService.login({ username: 'normal', password: 'User123!' });

  adminService.deleteUser(user.id);

  assert.equal(repositories.userRepository.findById(user.id), null);
  assert.equal(activeCount(user.id), 0);
  assertBusiness(() => adminService.deleteUser(user.id), '用户不存在');
});
