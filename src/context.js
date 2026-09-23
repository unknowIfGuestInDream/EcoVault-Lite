import config from './config/index.js';
import tokenProvider from './security/jwt.js';

import { UserRepository } from './repositories/userRepository.js';
import { UserSessionRepository } from './repositories/userSessionRepository.js';
import { PasswordEntryRepository } from './repositories/passwordEntryRepository.js';
import { SalaryRecordRepository } from './repositories/salaryRecordRepository.js';
import { LedgerEntryRepository } from './repositories/ledgerEntryRepository.js';
import { OperationLogRepository } from './repositories/operationLogRepository.js';
import { RolePermissionRepository } from './repositories/rolePermissionRepository.js';

import { AuthService } from './services/authService.js';
import { PasswordService } from './services/passwordService.js';
import { SalaryService } from './services/salaryService.js';
import { LedgerService } from './services/ledgerService.js';
import { OperationLogService } from './services/operationLogService.js';
import { AdminService } from './services/adminService.js';
import { RolePermissionService } from './services/rolePermissionService.js';

/**
 * @file 应用上下文/依赖注入装配。
 *
 * 从单个数据库句柄构建仓储和服务对象图。
 * 生产入口使用共享的单例数据库；测试会围绕
 * 内存数据库构建上下文以实现完全隔离。这对应了
 * 原 Java 应用中的 Spring 依赖注入容器。
 */

/**
 * @typedef {object} AppContext
 * @property {object} db - 数据库句柄。
 * @property {object} repositories - 仓储实例。
 * @property {object} services - 服务实例。
 * @property {object} tokenProvider - JWT 提供方。
 */

/**
 * 从 db 句柄构建应用上下文（仓储 + 服务）。
 *
 * @param {object} db - 数据库句柄。
 * @returns {AppContext} 已装配的上下文。
 */
export function createContext(db) {
  const repositories = {
    userRepository: new UserRepository(db),
    sessionRepository: new UserSessionRepository(db),
    passwordEntryRepository: new PasswordEntryRepository(db),
    salaryRecordRepository: new SalaryRecordRepository(db),
    ledgerEntryRepository: new LedgerEntryRepository(db),
    operationLogRepository: new OperationLogRepository(db),
    rolePermissionRepository: new RolePermissionRepository(db),
  };

  const services = {
    authService: new AuthService({
      userRepository: repositories.userRepository,
      sessionRepository: repositories.sessionRepository,
      tokenProvider,
      maxDevices: config.maxDevices,
    }),
    passwordService: new PasswordService({ repository: repositories.passwordEntryRepository }),
    salaryService: new SalaryService({ repository: repositories.salaryRecordRepository }),
    ledgerService: new LedgerService({ repository: repositories.ledgerEntryRepository }),
    operationLogService: new OperationLogService({
      repository: repositories.operationLogRepository,
    }),
    adminService: new AdminService({
      userRepository: repositories.userRepository,
      sessionRepository: repositories.sessionRepository,
    }),
    rolePermissionService: new RolePermissionService({
      repository: repositories.rolePermissionRepository,
    }),
  };

  return { db, repositories, services, tokenProvider };
}

export default createContext;
