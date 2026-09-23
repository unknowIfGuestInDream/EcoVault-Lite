import { BusinessError } from '../common/errors.js';

/**
 * @file 操作日志服务。
 *
 * 复现 Java `OperationLogServiceImpl`：审计条目持久化、
 * 分页/可筛选查询，以及小型更新/删除管理操作。
 */

/**
 * 操作日志服务。
 */
export class OperationLogService {
  /**
   * @param {object} deps - 依赖项。
   * @param {object} deps.repository - 日志仓储。
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * 持久化日志条目。
   *
   * @param {object} log - 日志实体。
   * @returns {object} 已存储的实体。
   */
  save(log) {
    return this.repository.insert(log);
  }

  /**
   * 使用可选筛选条件和分页查询日志。
   *
   * @param {object} params - 查询参数。
   * @param {number|null} [params.userId] - 限制为某个用户（null = 所有用户）。
   * @param {string} [params.module] - 模块筛选（精确匹配）。
   * @param {string} [params.keyword] - 操作关键字（LIKE）。
   * @param {string} [params.start] - 起始日期时间（包含）。
   * @param {string} [params.end] - 结束日期时间（包含）。
   * @param {number} [params.page] - 从 0 开始的页索引。
   * @param {number} [params.size] - 页大小。
   * @returns {{ content: object[], totalElements: number, page: number, size: number }} 分页片段。
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
   * 按 id 获取日志。
   *
   * @param {number} id - 日志 id。
   * @returns {object} 日志实体。
   * @throws {BusinessError} 当日志不存在时。
   */
  getById(id) {
    const log = this.repository.findById(id);
    if (!log) {
      throw new BusinessError('日志不存在');
    }
    return log;
  }

  /**
   * 更新日志的模块/操作（仅应用非空值）。
   *
   * @param {number} id - 日志 id。
   * @param {string} [module] - 新模块。
   * @param {string} [operation] - 新操作。
   * @returns {object} 更新后的日志实体。
   * @throws {BusinessError} 当日志不存在时。
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
   * 按 id 删除日志。
   *
   * @param {number} id - 日志 id。
   * @returns {void}
   * @throws {BusinessError} 当日志不存在时。
   */
  delete(id) {
    this.getById(id);
    this.repository.deleteById(id);
  }
}

export default OperationLogService;
