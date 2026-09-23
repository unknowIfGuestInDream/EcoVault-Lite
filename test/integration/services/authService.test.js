import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from '../../helpers/db.js';
import { AuthService } from '../../../src/services/authService.js';

/**
 * @file 认证服务集成测试。
 */

let context;
let repositories;
let services;
let authService;

function assertRejectsBusiness(fn, message) {
  assert.throws(fn, (error) => error.message === message && error.status === 400);
}

function registerUser(overrides = {}) {
  return authService.register({
    username: 'alice',
    password: 'Secret123!',
    nickname: '爱丽丝',
    email: 'alice@example.com',
    role: 'USER',
    ...overrides,
  });
}

beforeEach(() => {
  ({ context, repositories, services } = createTestContext());
  authService = services.authService;
});

test('register 创建用户并处理默认昵称、默认角色、重复用户名和非法角色', () => {
  const user = registerUser();
  const defaulted = registerUser({
    username: 'blank-nick',
    nickname: '   ',
    email: undefined,
    role: undefined,
  });
  const nullNick = registerUser({
    username: 'null-nick',
    nickname: null,
    role: null,
  });

  assert.equal(user.username, 'alice');
  assert.equal(user.nickname, '爱丽丝');
  assert.equal(user.role, 'USER');
  assert.equal(defaulted.nickname, 'blank-nick');
  assert.equal(defaulted.email, null);
  assert.equal(defaulted.role, 'USER');
  assert.equal(nullNick.nickname, 'null-nick');
  assert.notEqual(defaulted.password, 'Secret123!');
  assertRejectsBusiness(() => registerUser({ username: 'alice' }), '用户名已存在');
  assertRejectsBusiness(() => registerUser({ username: 'bad-role', role: 'ROOT' }), '角色不合法');
});

test('login 校验凭据、禁用状态并保存截断后的设备信息', () => {
  const user = registerUser();
  const device = 'x'.repeat(600);

  const result = authService.login(
    { username: 'alice', password: 'Secret123!' },
    device,
    undefined
  );
  const active = repositories.sessionRepository.findActiveByUser(user.id);

  assert.equal(result.response.username, 'alice');
  assert.equal(result.response.nickname, '爱丽丝');
  assert.equal(result.response.role, 'USER');
  assert.equal(result.response.token, result.token);
  assert.equal(typeof result.expiresAt, 'number');
  assert.equal(active.length, 1);
  assert.equal(active[0].deviceInfo.length, 512);
  assert.equal(active[0].ip, null);
  assertRejectsBusiness(
    () => authService.login({ username: 'missing', password: 'Secret123!' }),
    '用户名或密码错误'
  );
  assertRejectsBusiness(
    () => authService.login({ username: 'alice', password: 'bad' }),
    '用户名或密码错误'
  );

  repositories.userRepository.update(user.id, { enabled: false });
  assertRejectsBusiness(
    () => authService.login({ username: 'alice', password: 'Secret123!' }),
    '账户已被禁用，请联系管理员'
  );
});

test('login 在单设备与多设备上限下淘汰最旧会话', () => {
  const user = registerUser();
  const singleDevice = new AuthService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    tokenProvider: context.tokenProvider,
    maxDevices: 1,
  });
  const first = singleDevice.login(
    { username: 'alice', password: 'Secret123!' },
    '设备一',
    '127.0.0.1'
  );
  const second = singleDevice.login(
    { username: 'alice', password: 'Secret123!' },
    '设备二',
    '127.0.0.2'
  );

  assert.equal(
    repositories.sessionRepository.findByJti(first.token.split('.')[2])?.active,
    undefined
  );
  assert.equal(repositories.sessionRepository.findActiveByUser(user.id).length, 1);
  assert.equal(repositories.sessionRepository.findActiveByUser(user.id)[0].ip, '127.0.0.2');
  assert.ok(second.token);

  const other = registerUser({ username: 'bob', nickname: undefined, password: 'Secret123!' });
  const multiDevice = new AuthService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    tokenProvider: context.tokenProvider,
    maxDevices: 3,
  });
  multiDevice.login({ username: 'bob', password: 'Secret123!' }, '一');
  multiDevice.login({ username: 'bob', password: 'Secret123!' }, '二');
  multiDevice.login({ username: 'bob', password: 'Secret123!' }, '三');
  const before = repositories.sessionRepository.findActiveByUser(other.id);
  multiDevice.login({ username: 'bob', password: 'Secret123!' }, '四');
  const after = repositories.sessionRepository.findActiveByUser(other.id);

  assert.equal(before.length, 3);
  assert.equal(after.length, 3);
  assert.equal(repositories.sessionRepository.findByJti(before[0].jti).active, false);
  assert.deepEqual(
    after.map((session) => session.deviceInfo),
    ['二', '三', '四']
  );

  const defaultLimit = new AuthService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    tokenProvider: context.tokenProvider,
  });
  defaultLimit.logout(undefined);
  const fallback = new AuthService({
    userRepository: repositories.userRepository,
    sessionRepository: repositories.sessionRepository,
    tokenProvider: context.tokenProvider,
    maxDevices: 0,
  });
  fallback.login({ username: 'bob', password: 'Secret123!' });
  assert.equal(repositories.sessionRepository.findActiveByUser(other.id).length, 1);
});

test('logout 允许空 jti 并按 jti 吊销会话', () => {
  const user = registerUser();
  const login = authService.login({ username: 'alice', password: 'Secret123!' });
  const session = repositories.sessionRepository.findActiveByUser(user.id)[0];

  authService.logout(null);
  assert.equal(repositories.sessionRepository.findByJti(session.jti).active, true);
  authService.logout(session.jti);
  assert.equal(repositories.sessionRepository.findByJti(session.jti).active, false);
  assert.ok(login.token);
});

test('updateProfile 更新资料并处理空昵称、空邮箱和不存在用户', () => {
  const user = registerUser();

  const updated = authService.updateProfile(user.id, {
    nickname: '新昵称',
    email: 'new@example.com',
  });
  const keepNickname = authService.updateProfile(user.id, { nickname: ' ', email: undefined });

  assert.equal(updated.nickname, '新昵称');
  assert.equal(updated.email, 'new@example.com');
  assert.equal(keepNickname.nickname, '新昵称');
  assert.equal(keepNickname.email, null);
  assertRejectsBusiness(() => authService.updateProfile(999, {}), '用户不存在');
});

test('changePassword 校验旧密码、修改密码并吊销全部会话', () => {
  const user = registerUser();
  authService.login({ username: 'alice', password: 'Secret123!' });
  authService.login({ username: 'alice', password: 'Secret123!' });

  assertRejectsBusiness(
    () => authService.changePassword(user.id, { oldPassword: 'bad', newPassword: 'Next123!' }),
    '原密码不正确'
  );
  authService.changePassword(user.id, { oldPassword: 'Secret123!', newPassword: 'Next123!' });

  assert.equal(repositories.sessionRepository.findActiveByUser(user.id).length, 0);
  assertRejectsBusiness(
    () => authService.login({ username: 'alice', password: 'Secret123!' }),
    '用户名或密码错误'
  );
  assert.ok(authService.login({ username: 'alice', password: 'Next123!' }).token);
  assertRejectsBusiness(
    () => authService.changePassword(999, { oldPassword: 'x', newPassword: 'y' }),
    '用户不存在'
  );
});

test('verifyPassword 校验隐私模式密码与错误路径', () => {
  const user = registerUser();

  assert.equal(authService.verifyPassword(user.id, 'Secret123!'), undefined);
  assertRejectsBusiness(() => authService.verifyPassword(user.id, 'bad'), '密码错误');
  assertRejectsBusiness(() => authService.verifyPassword(999, 'Secret123!'), '用户不存在');
});
