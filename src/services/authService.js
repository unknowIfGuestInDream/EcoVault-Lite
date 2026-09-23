import { BusinessError } from '../common/errors.js';
import { Role } from '../domain/role.js';
import { hashPassword, verifyPassword } from '../security/passwordHash.js';

/**
 * @file 认证与账号服务。
 *
 * 复现 Java `AuthServiceImpl`：注册、支持单设备/受限
 * 设备约束的登录、登出、资料更新、密码修改（会吊销所有
 * 会话）以及隐私模式密码校验。
 */

/**
 * 解析并校验角色字符串。
 *
 * @param {string | null | undefined} role - 原始角色。
 * @returns {string} 有效角色（默认为 USER）。
 * @throws {BusinessError} 当角色非空但无效时。
 */
function parseRole(role) {
  if (role === null || role === undefined || String(role).trim() === '') {
    return Role.USER;
  }
  const normalized = String(role).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(Role, normalized)) {
    throw new BusinessError('角色不合法');
  }
  return Role[normalized];
}

/**
 * 将字符串截断到最大长度。
 *
 * @param {string | null | undefined} value - 源值。
 * @param {number} maxLength - 最大长度。
 * @returns {string | null} 截断后的值或 null。
 */
function truncate(value, maxLength) {
  if (value === null || value === undefined) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * 认证服务。
 */
export class AuthService {
  /**
   * @param {object} deps - 依赖项。
   * @param {object} deps.userRepository - 用户仓储。
   * @param {object} deps.sessionRepository - 会话仓储。
   * @param {object} deps.tokenProvider - JWT 提供器。
   * @param {number} deps.maxDevices - 最大并发设备数（>=1）。
   */
  constructor({ userRepository, sessionRepository, tokenProvider, maxDevices }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.tokenProvider = tokenProvider;
    this.maxDevices = Math.max(1, maxDevices ?? 1);
  }

  /**
   * 注册新用户。
   *
   * @param {object} request - 注册请求（username、password、nickname、email、role）。
   * @returns {object} 创建的用户实体。
   * @throws {BusinessError} 当用户名已存在或角色无效时。
   */
  register(request) {
    if (this.userRepository.existsByUsername(request.username)) {
      throw new BusinessError('用户名已存在');
    }
    const nickname =
      request.nickname === null ||
      request.nickname === undefined ||
      String(request.nickname).trim() === ''
        ? request.username
        : request.nickname;
    return this.userRepository.insert({
      username: request.username,
      password: hashPassword(request.password),
      nickname,
      email: request.email ?? null,
      role: parseRole(request.role),
      enabled: true,
    });
  }

  /**
   * 认证用户并签发会话令牌。
   *
   * @param {object} request - 登录请求（username、password）。
   * @param {string} [deviceInfo] - 设备/user-agent 字符串。
   * @param {string} [ip] - 客户端 IP。
   * @returns {{ response: object, token: string, expiresAt: number }} 登录结果和 cookie 令牌。
   * @throws {BusinessError} 当凭据无效或账号被禁用时。
   */
  login(request, deviceInfo, ip) {
    const user = this.userRepository.findByUsername(request.username);
    if (!user || !verifyPassword(request.password, user.password)) {
      throw new BusinessError('用户名或密码错误');
    }
    if (!user.enabled) {
      throw new BusinessError('账户已被禁用，请联系管理员');
    }
    this.#enforceDeviceLimit(user.id);
    const { token, jti, expiresAt } = this.tokenProvider.generateToken({
      userId: user.id,
      username: user.username,
    });
    this.sessionRepository.insert({
      userId: user.id,
      jti,
      deviceInfo: truncate(deviceInfo, 512),
      ip: ip ?? null,
    });
    return {
      response: {
        token,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
      },
      token,
      expiresAt,
    };
  }

  /**
   * 通过吊销最旧的活跃会话来执行设备限制。
   *
   * @param {number} userId - 用户 id。
   * @returns {void}
   */
  #enforceDeviceLimit(userId) {
    const active = this.sessionRepository.findActiveByUser(userId);
    const allowedRemaining = this.maxDevices - 1;
    const toRevoke = active.length - allowedRemaining;
    for (let i = 0; i < toRevoke; i += 1) {
      this.sessionRepository.deactivateByJti(active[i].jti);
    }
  }

  /**
   * 通过令牌 id 使会话失效。
   *
   * @param {string | null} jti - 令牌 id。
   * @returns {void}
   */
  logout(jti) {
    if (!jti) {
      return;
    }
    this.sessionRepository.deactivateByJti(jti);
  }

  /**
   * 更新用户资料（nickname/email）。
   *
   * @param {number} userId - 用户 id。
   * @param {object} request - 更新请求（nickname、email）。
   * @returns {object} 更新后的用户实体。
   * @throws {BusinessError} 当用户不存在时。
   */
  updateProfile(userId, request) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }
    const fields = { email: request.email ?? null };
    if (
      request.nickname !== null &&
      request.nickname !== undefined &&
      String(request.nickname).trim() !== ''
    ) {
      fields.nickname = request.nickname;
    }
    return this.userRepository.update(userId, fields);
  }

  /**
   * 修改用户密码并吊销其所有活跃会话。
   *
   * @param {number} userId - 用户 id。
   * @param {object} request - 修改请求（oldPassword、newPassword）。
   * @returns {void}
   * @throws {BusinessError} 当用户不存在或旧密码错误时。
   */
  changePassword(userId, request) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }
    if (!verifyPassword(request.oldPassword, user.password)) {
      throw new BusinessError('原密码不正确');
    }
    this.userRepository.update(userId, { password: hashPassword(request.newPassword) });
    this.sessionRepository.deactivateAllByUser(userId);
  }

  /**
   * 校验用户密码但不签发令牌（隐私模式解锁）。
   *
   * @param {number} userId - 用户 id。
   * @param {string} rawPassword - 要校验的密码。
   * @returns {void}
   * @throws {BusinessError} 当用户不存在或密码错误时。
   */
  verifyPassword(userId, rawPassword) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }
    if (!verifyPassword(rawPassword, user.password)) {
      throw new BusinessError('密码错误');
    }
  }
}

export default AuthService;
