import { nowDateTime } from '../utils/datetime.js';

/**
 * @file 操作/审计日志仓储。
 */

/**
 * 将数据库行映射为操作日志实体。
 *
 * @param {object | undefined} row - 数据库行。
 * @returns {object | null} 实体或 null。
 */
function mapLog(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    module: row.module,
    operation: row.operation,
    method: row.method,
    params: row.params,
    ip: row.ip,
    status: row.status,
    errorMsg: row.error_msg,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

/**
 * `operation_logs` 表的仓储。
 */
export class OperationLogRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 插入日志记录。
   *
   * @param {object} log - 日志字段。
   * @returns {number} 已插入行的 id。
   */
  insert(log) {
    const info = this.db
      .prepare(
        `INSERT INTO operation_logs
         (user_id, username, module, operation, method, params, ip, status, error_msg, duration_ms, created_at)
         VALUES (@user_id, @username, @module, @operation, @method, @params, @ip, @status, @error_msg, @duration_ms, @created_at)`
      )
      .run({
        user_id: log.userId ?? null,
        username: log.username ?? null,
        module: log.module ?? null,
        operation: log.operation ?? null,
        method: log.method ?? null,
        params: log.params ?? null,
        ip: log.ip ?? null,
        status: log.status ?? null,
        error_msg: log.errorMsg ?? null,
        duration_ms: log.durationMs ?? 0,
        created_at: log.createdAt ?? nowDateTime(),
      });
    return Number(info.lastInsertRowid);
  }

  /**
   * 按 id 查找单条日志。
   *
   * @param {number} id - 日志 id。
   * @returns {object | null} 实体或 null。
   */
  findById(id) {
    return mapLog(this.db.prepare('SELECT * FROM operation_logs WHERE id = ?').get(id));
  }

  /**
   * 为搜索过滤条件构建共享 WHERE 子句和参数。
   *
   * @param {object} filters - 搜索过滤条件。
   * @returns {{ where: string, args: object }} 子句与绑定参数。
   */
  #buildWhere({ userId, module, keyword, start, end }) {
    const clauses = [];
    const args = {};
    if (userId !== undefined && userId !== null) {
      clauses.push('user_id = @userId');
      args.userId = userId;
    }
    if (module) {
      clauses.push('module = @module');
      args.module = module;
    }
    if (keyword) {
      clauses.push('operation LIKE @keyword');
      args.keyword = `%${keyword}%`;
    }
    if (start) {
      clauses.push('created_at >= @start');
      args.start = start;
    }
    if (end) {
      clauses.push('created_at <= @end');
      args.end = end;
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return { where, args };
  }

  /**
   * 分页搜索，按创建时间降序排序。
   *
   * @param {object} filters - 过滤条件以及 `page`（从 0 开始）和 `size`。
   * @returns {{ content: object[], totalElements: number }} 分页切片与总数。
   */
  search(filters) {
    const { where, args } = this.#buildWhere(filters);
    const total = this.db.prepare(`SELECT COUNT(*) AS c FROM operation_logs ${where}`).get(args).c;
    const size = filters.size > 0 ? filters.size : 20;
    const page = filters.page > 0 ? filters.page : 0;
    const rows = this.db
      .prepare(
        `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...args, limit: size, offset: page * size });
    return { content: rows.map(mapLog), totalElements: total };
  }

  /**
   * 更新日志的可编辑字段（module、operation）。
   *
   * @param {number} id - 日志 id。
   * @param {object} fields - 要更新的字段。
   * @returns {object | null} 已更新的实体。
   */
  update(id, fields) {
    const current = this.findById(id);
    if (!current) {
      return null;
    }
    this.db
      .prepare('UPDATE operation_logs SET module = @module, operation = @operation WHERE id = @id')
      .run({
        id,
        module: fields.module !== undefined ? fields.module : current.module,
        operation: fields.operation !== undefined ? fields.operation : current.operation,
      });
    return this.findById(id);
  }

  /**
   * 按 id 删除日志。
   *
   * @param {number} id - 日志 id。
   * @returns {boolean} 删除了一行时为 true。
   */
  deleteById(id) {
    return this.db.prepare('DELETE FROM operation_logs WHERE id = ?').run(id).changes > 0;
  }
}

export default OperationLogRepository;
