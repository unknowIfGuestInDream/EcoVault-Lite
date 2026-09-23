import { BusinessError } from '../common/errors.js';
import { Role } from '../domain/role.js';
import { hashPassword, verifyPassword } from '../security/passwordHash.js';

/**
 * @file Authentication and account service.
 *
 * Reproduces the Java `AuthServiceImpl`: registration, login with single/limited
 * device enforcement, logout, profile update, password change (which revokes all
 * sessions) and the privacy-mode password verification.
 */

/**
 * Parse and validate a role string.
 *
 * @param {string | null | undefined} role - Raw role.
 * @returns {string} A valid role (defaults to USER).
 * @throws {BusinessError} When the role is non-empty but invalid.
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
 * Truncate a string to a maximum length.
 *
 * @param {string | null | undefined} value - Source value.
 * @param {number} maxLength - Maximum length.
 * @returns {string | null} Truncated value or null.
 */
function truncate(value, maxLength) {
  if (value === null || value === undefined) {
    return null;
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * Authentication service.
 */
export class AuthService {
  /**
   * @param {object} deps - Dependencies.
   * @param {object} deps.userRepository - User repo.
   * @param {object} deps.sessionRepository - Session repo.
   * @param {object} deps.tokenProvider - JWT provider.
   * @param {number} deps.maxDevices - Maximum concurrent devices (>=1).
   */
  constructor({ userRepository, sessionRepository, tokenProvider, maxDevices }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.tokenProvider = tokenProvider;
    this.maxDevices = Math.max(1, maxDevices ?? 1);
  }

  /**
   * Register a new user.
   *
   * @param {object} request - Registration request (username, password, nickname, email, role).
   * @returns {object} The created user entity.
   * @throws {BusinessError} When the username already exists or role is invalid.
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
   * Authenticate a user and issue a session token.
   *
   * @param {object} request - Login request (username, password).
   * @param {string} [deviceInfo] - Device/user-agent string.
   * @param {string} [ip] - Client IP.
   * @returns {{ response: object, token: string, expiresAt: number }} Login result and cookie token.
   * @throws {BusinessError} On invalid credentials or disabled account.
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
   * Enforce the device limit by revoking the oldest active sessions.
   *
   * @param {number} userId - User id.
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
   * Invalidate a session by its token id.
   *
   * @param {string | null} jti - Token id.
   * @returns {void}
   */
  logout(jti) {
    if (!jti) {
      return;
    }
    this.sessionRepository.deactivateByJti(jti);
  }

  /**
   * Update the profile (nickname/email) of a user.
   *
   * @param {number} userId - User id.
   * @param {object} request - Update request (nickname, email).
   * @returns {object} The updated user entity.
   * @throws {BusinessError} When the user does not exist.
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
   * Change a user's password and revoke all of their active sessions.
   *
   * @param {number} userId - User id.
   * @param {object} request - Change request (oldPassword, newPassword).
   * @returns {void}
   * @throws {BusinessError} When the user does not exist or the old password is wrong.
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
   * Verify a user's password without issuing a token (privacy-mode unlock).
   *
   * @param {number} userId - User id.
   * @param {string} rawPassword - Password to verify.
   * @returns {void}
   * @throws {BusinessError} When the user does not exist or the password is wrong.
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
