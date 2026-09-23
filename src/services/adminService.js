import { BusinessError } from '../common/errors.js';
import { Role } from '../domain/role.js';
import { hashPassword } from '../security/passwordHash.js';

/**
 * @file 管理员用户管理服务。
 *
 * 复现 Java `AdminServiceImpl`：列出用户、启用/禁用
 * （包含防止禁用当前账号的保护）、更新和删除
 * 用户。每当账号被禁用、密码被修改，或
 * 被删除时，其所有活跃会话都会被吊销。
 *
 * Java 实现从线程局部变量解析“当前用户”；此处
 * 调用方显式传入 `currentUserId`。
 */

/**
 * 解析并校验角色字符串（无默认值；必须有效）。
 *
 * @param {string} role - 原始角色。
 * @returns {string} 有效角色。
 * @throws {BusinessError} 当角色无效时。
 */
function parseRole(role) {
  const normalized = String(role).trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(Role, normalized)) {
    throw new BusinessError('角色不合法');
  }
  return Role[normalized];
}

/**
 * 管理服务。
 */
export class AdminService {
  /**
   * @param {object} deps - 依赖项。
   * @param {object} deps.userRepository - 用户仓储。
   * @param {object} deps.sessionRepository - 会话仓储。
   */
  constructor({ userRepository, sessionRepository }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

  /**
   * 列出所有用户。
   *
   * @returns {object[]} 管理员用户响应。
   */
  listUsers() {
    return this.userRepository.findAll().map((user) => this.#toResponse(user));
  }

  /**
   * 启用或禁用用户。
   *
   * @param {number} userId - 目标用户 id。
   * @param {boolean} enabled - 期望状态。
   * @param {number} currentUserId - 执行操作的管理员 id。
   * @returns {void}
   * @throws {BusinessError} 当用户不存在或管理员禁用自己时。
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
   * 更新用户属性。
   *
   * @param {number} userId - 目标用户 id。
   * @param {object} request - 更新请求。
   * @param {number} currentUserId - 执行操作的管理员 id。
   * @returns {object} 更新后的管理员用户响应。
   * @throws {BusinessError} 当用户不存在或管理员禁用自己时。
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
   * 删除用户并吊销其会话。
   *
   * @param {number} userId - 目标用户 id。
   * @returns {void}
   * @throws {BusinessError} 当用户不存在时。
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
   * 吊销用户的所有活跃会话。
   *
   * @param {number} userId - 用户 id。
   * @returns {void}
   */
  #revokeSessions(userId) {
    this.sessionRepository.deactivateAllByUser(userId);
  }

  /**
   * 将用户实体映射为管理员响应。
   *
   * @param {object} user - 用户实体。
   * @returns {object} 管理员用户响应。
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
