import { nowDateTime } from '../utils/datetime.js';

/**
 * @file 用户会话（JWT jti 注册表）仓储。
 */

/**
 * 将原始行映射为会话实体。
 *
 * @param {object | undefined} row - 原始行。
 * @returns {object | null} 会话实体（`active` 为布尔值）或 null。
 */
function mapSession(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    jti: row.jti,
    deviceInfo: row.device_info,
    ip: row.ip,
    active: row.active === 1,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

/**
 * `user_sessions` 表的仓储。
 */
export class UserSessionRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 按 JWT id 查找会话。
   *
   * @param {string} jti - 令牌标识符。
   * @returns {object | null} 会话实体或 null。
   */
  findByJti(jti) {
    return mapSession(this.db.prepare('SELECT * FROM user_sessions WHERE jti = ?').get(jti));
  }

  /**
   * 列出用户的活跃会话，按创建时间升序排序。
   *
   * @param {number} userId - 用户 id。
   * @returns {object[]} 活跃会话实体（最旧优先）。
   */
  findActiveByUser(userId) {
    return this.db
      .prepare(
        'SELECT * FROM user_sessions WHERE user_id = ? AND active = 1 ORDER BY created_at ASC, id ASC'
      )
      .all(userId)
      .map(mapSession);
  }

  /**
   * 创建新的活跃会话。
   *
   * @param {object} session - 会话详情。
   * @returns {object} 已创建的会话实体。
   */
  insert(session) {
    const now = nowDateTime();
    const info = this.db
      .prepare(
        `INSERT INTO user_sessions (user_id, jti, device_info, ip, active, created_at, last_active_at)
         VALUES (@user_id, @jti, @device_info, @ip, 1, @created_at, @last_active_at)`
      )
      .run({
        user_id: session.userId,
        jti: session.jti,
        device_info: session.deviceInfo ?? null,
        ip: session.ip ?? null,
        created_at: now,
        last_active_at: now,
      });
    return mapSession(
      this.db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(Number(info.lastInsertRowid))
    );
  }

  /**
   * 刷新会话的 `last_active_at` 时间戳。
   *
   * @param {string} jti - 令牌标识符。
   * @returns {void}
   */
  touch(jti) {
    this.db
      .prepare('UPDATE user_sessions SET last_active_at = ? WHERE jti = ?')
      .run(nowDateTime(), jti);
  }

  /**
   * 按 jti 停用单个会话。
   *
   * @param {string} jti - 令牌标识符。
   * @returns {boolean} 更新了一行时为 true。
   */
  deactivateByJti(jti) {
    return (
      this.db.prepare('UPDATE user_sessions SET active = 0 WHERE jti = ?').run(jti).changes > 0
    );
  }

  /**
   * 停用用户的所有活跃会话。
   *
   * @param {number} userId - 用户 id。
   * @returns {number} 已停用的会话数量。
   */
  deactivateAllByUser(userId) {
    return this.db
      .prepare('UPDATE user_sessions SET active = 0 WHERE user_id = ? AND active = 1')
      .run(userId).changes;
  }
}

export default UserSessionRepository;
