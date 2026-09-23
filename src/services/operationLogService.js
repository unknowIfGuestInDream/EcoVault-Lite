import { BusinessError } from '../common/errors.js';

/**
 * @file Operation-log service.
 *
 * Reproduces the Java `OperationLogServiceImpl`: persistence of audit entries,
 * paginated/filterable queries, and the small update/delete admin operations.
 */

/**
 * Operation-log service.
 */
export class OperationLogService {
  /**
   * @param {object} deps - Dependencies.
   * @param {object} deps.repository - Log repo.
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Persist a log entry.
   *
   * @param {object} log - Log entity.
   * @returns {object} The stored entity.
   */
  save(log) {
    return this.repository.insert(log);
  }

  /**
   * Query logs with optional filters and pagination.
   *
   * @param {object} params - Query params.
   * @param {number|null} [params.userId] - Restrict to a user (null = all users).
   * @param {string} [params.module] - Module filter (exact match).
   * @param {string} [params.keyword] - Operation keyword (LIKE).
   * @param {string} [params.start] - Start datetime (inclusive).
   * @param {string} [params.end] - End datetime (inclusive).
   * @param {number} [params.page] - 0-based page index.
   * @param {number} [params.size] - Page size.
   * @returns {{ content: object[], totalElements: number, page: number, size: number }} Page slice.
   */
  query({ userId = null, module, keyword, start, end, page = 0, size = 20 } = {}) {
    const normalizedModule =
      module === null || module === undefined || String(module).trim() === '' ? null : module;
    const normalizedKeyword =
      keyword === null || keyword === undefined || String(keyword).trim() === ''
        ? null
        : String(keyword).trim();
    const safePage = Math.max(0, page);
    const safeSize = Math.min(Math.max(1, size), 100);
    const result = this.repository.search({
      userId,
      module: normalizedModule,
      keyword: normalizedKeyword,
      start: start ?? null,
      end: end ?? null,
      page: safePage,
      size: safeSize,
    });
    return {
      content: result.content,
      totalElements: result.totalElements,
      page: safePage,
      size: safeSize,
    };
  }

  /**
   * Fetch a log by id.
   *
   * @param {number} id - Log id.
   * @returns {object} Log entity.
   * @throws {BusinessError} When the log does not exist.
   */
  getById(id) {
    const log = this.repository.findById(id);
    if (!log) {
      throw new BusinessError('日志不存在');
    }
    return log;
  }

  /**
   * Update the module/operation of a log (only non-blank values are applied).
   *
   * @param {number} id - Log id.
   * @param {string} [module] - New module.
   * @param {string} [operation] - New operation.
   * @returns {object} Updated log entity.
   * @throws {BusinessError} When the log does not exist.
   */
  update(id, module, operation) {
    this.getById(id);
    const fields = {};
    if (module !== null && module !== undefined && String(module).trim() !== '') {
      fields.module = String(module).trim();
    }
    if (operation !== null && operation !== undefined && String(operation).trim() !== '') {
      fields.operation = String(operation).trim();
    }
    return this.repository.update(id, fields);
  }

  /**
   * Delete a log by id.
   *
   * @param {number} id - Log id.
   * @returns {void}
   * @throws {BusinessError} When the log does not exist.
   */
  delete(id) {
    this.getById(id);
    this.repository.deleteById(id);
  }
}

export default OperationLogService;
