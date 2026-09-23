import { nowDateTime } from '../utils/datetime.js';

/**
 * @file Operation/audit log repository.
 */

/**
 * Map a raw row to an operation-log entity.
 *
 * @param {object | undefined} row - Raw row.
 * @returns {object | null} Entity or null.
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
 * Repository for the `operation_logs` table.
 */
export class OperationLogRepository {
  /**
   * @param {object} db - Database handle.
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * Insert a log record.
   *
   * @param {object} log - Log fields.
   * @returns {number} The inserted row id.
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
   * Find a single log by id.
   *
   * @param {number} id - Log id.
   * @returns {object | null} Entity or null.
   */
  findById(id) {
    return mapLog(this.db.prepare('SELECT * FROM operation_logs WHERE id = ?').get(id));
  }

  /**
   * Build the shared WHERE clause and arguments for the search filters.
   *
   * @param {object} filters - Search filters.
   * @returns {{ where: string, args: object }} Clause and bound args.
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
   * Paginated search ordered by creation time descending.
   *
   * @param {object} filters - Filters plus `page` (0-based) and `size`.
   * @returns {{ content: object[], totalElements: number }} Page slice and total.
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
   * Update the editable fields of a log (module, operation).
   *
   * @param {number} id - Log id.
   * @param {object} fields - Fields to update.
   * @returns {object | null} Updated entity.
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
   * Delete a log by id.
   *
   * @param {number} id - Log id.
   * @returns {boolean} True when a row was deleted.
   */
  deleteById(id) {
    return this.db.prepare('DELETE FROM operation_logs WHERE id = ?').run(id).changes > 0;
  }
}

export default OperationLogRepository;
