import config from '../config/index.js';
import { Role } from '../domain/role.js';

/**
 * @file 数据初始化引导。
 *
 * 首次启动时种子化角色默认权限，并在缺失时创建内置管理员账号。
 * 全部操作幂等，重复启动不会产生重复数据。
 */

/**
 * 初始化基础数据（角色权限 + 内置管理员）。
 *
 * @param {AppContext} context - 应用上下文。
 * @returns {void}
 */
export function initializeData(context) {
  const { userRepository } = context.repositories;
  const { authService, rolePermissionService } = context.services;

  rolePermissionService.initDefaults();

  if (!userRepository.existsByUsername(config.admin.username)) {
    authService.register({
      username: config.admin.username,
      password: config.admin.password,
      nickname: '系统管理员',
      role: Role.ADMIN,
    });
  }
}

export default initializeData;
