import { BusinessError } from '../common/errors.js';
import { Role } from '../domain/role.js';
import { hashPassword } from '../security/passwordHash.js';

/**
 * @file Administrative user-management service.
 *
 * Reproduces the Java `AdminServiceImpl`: listing users, enabling/disabling
 * (with a guard against disabling the current account), updating and deleting
 * users. Whenever an account is disabled, has its password changed, or is
 * deleted, all of its active sessions are revoked.
 *
 * The Java implementation resolved the "current user" from a thread-local; here
 * the caller passes `currentUserId` explicitly.
 */

/**
 * Parse and validate a role string (no default; must be valid).
 *
 * @param {string} role - Raw role.
 * @returns {string} A valid role.
 * @throws {BusinessError} When the role is invalid.
 */
function parseRole(role) {
  const normalized = String(role).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(Role, normalized)) {
    throw new BusinessError('角色不合法');
  }
  return Role[normalized];
}

/**
 * Admin service.
 */
export class AdminService {
  /**
   * @param {object} deps - Dependencies.
   * @param {import('../repositories/userRepository.js').UserRepository} deps.userRepository - User repo.
   * @param {import('../repositories/userSessionRepository.js').UserSessionRepository} deps.sessionRepository - Session repo.
   */
  constructor({ userRepository, sessionRepository }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

  /**
   * List all users.
   *
   * @returns {object[]} Admin user responses.
   */
  listUsers() {
    return this.userRepository.findAll().map((user) => this.#toResponse(user));
  }

  /**
   * Enable or disable a user.
   *
   * @param {number} userId - Target user id.
   * @param {boolean} enabled - Desired state.
   * @param {number} currentUserId - Id of the acting admin.
   * @returns {void}
   * @throws {BusinessError} When the user does not exist or an admin disables themselves.
   */
  setUserEnabled(userId, enabled, currentUserId) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }
    if (!enabled && Number(userId) === Number(currentUserId)) {
      throw new BusinessError('不能禁用当前登录的账号');
    }
    this.userRepository.update(userId, { enabled });
    if (!enabled) {
      this.#revokeSessions(userId);
    }
  }

  /**
   * Update a user's attributes.
   *
   * @param {number} userId - Target user id.
   * @param {object} request - Update request.
   * @param {number} currentUserId - Id of the acting admin.
   * @returns {object} Updated admin user response.
   * @throws {BusinessError} When the user does not exist or an admin disables themselves.
   */
  updateUser(userId, request, currentUserId) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }
    const fields = {};
    if (
      request.nickname !== null &&
      request.nickname !== undefined &&
      String(request.nickname).trim() !== ''
    ) {
      fields.nickname = String(request.nickname).trim();
    }
    if (request.email !== null && request.email !== undefined) {
      fields.email = request.email;
    }
    if (request.role !== null && request.role !== undefined && String(request.role).trim() !== '') {
      fields.role = parseRole(request.role);
    }
    let revoke = false;
    if (
      request.password !== null &&
      request.password !== undefined &&
      String(request.password).trim() !== ''
    ) {
      fields.password = hashPassword(request.password);
      revoke = true;
    }
    if (request.enabled !== null && request.enabled !== undefined) {
      if (!request.enabled && Number(userId) === Number(currentUserId)) {
        throw new BusinessError('不能禁用当前登录的账号');
      }
      fields.enabled = request.enabled;
      if (!request.enabled) {
        revoke = true;
      }
    }
    const updated = this.userRepository.update(userId, fields);
    if (revoke) {
      this.#revokeSessions(userId);
    }
    return this.#toResponse(updated);
  }

  /**
   * Delete a user and revoke their sessions.
   *
   * @param {number} userId - Target user id.
   * @returns {void}
   * @throws {BusinessError} When the user does not exist.
   */
  deleteUser(userId) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new BusinessError('用户不存在');
    }
    this.#revokeSessions(userId);
    this.userRepository.deleteById(userId);
  }

  /**
   * Revoke all active sessions of a user.
   *
   * @param {number} userId - User id.
   * @returns {void}
   */
  #revokeSessions(userId) {
    this.sessionRepository.deactivateAllByUser(userId);
  }

  /**
   * Map a user entity to an admin response.
   *
   * @param {object} user - User entity.
   * @returns {object} Admin user response.
   */
  #toResponse(user) {
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      enabled: user.enabled,
      createdAt: user.createdAt,
    };
  }
}

export default AdminService;
