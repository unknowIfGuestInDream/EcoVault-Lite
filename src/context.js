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
 * @file Application context / dependency-injection wiring.
 *
 * Builds the repository and service object graph from a single database handle.
 * The production entry point uses the shared singleton database; tests build a
 * context around an in-memory database for full isolation. This mirrors the
 * Spring dependency-injection container from the original Java application.
 */

/**
 * @typedef {object} AppContext
 * @property {object} db - Database handle.
 * @property {object} repositories - The repository instances.
 * @property {object} services - The service instances.
 * @property {object} tokenProvider - JWT provider.
 */

/**
 * Build an application context (repositories + services) from a db handle.
 *
 * @param {object} db - Database handle.
 * @returns {AppContext} The wired context.
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
