import { nowDateTime } from '../utils/datetime.js';

/**
 * @file User session (JWT jti registry) repository.
 */

/**
 * Map a raw row to a session entity.
 *
 * @param {object | undefined} row - Raw row.
 * @returns {object | null} Session entity (with `active` as boolean) or null.
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
 * Repository for the `user_sessions` table.
 */
export class UserSessionRepository {
  /**
   * @param {object} db - Database handle.
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * Find a session by its JWT id.
   *
   * @param {string} jti - Token identifier.
   * @returns {object | null} Session entity or null.
   */
  findByJti(jti) {
    return mapSession(this.db.prepare('SELECT * FROM user_sessions WHERE jti = ?').get(jti));
  }

  /**
   * List a user's active sessions ordered by creation time ascending.
   *
   * @param {number} userId - User id.
   * @returns {object[]} Active session entities (oldest first).
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
   * Create a new active session.
   *
   * @param {object} session - Session details.
   * @returns {object} The created session entity.
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
   * Refresh the `last_active_at` timestamp of a session.
   *
   * @param {string} jti - Token identifier.
   * @returns {void}
   */
  touch(jti) {
    this.db
      .prepare('UPDATE user_sessions SET last_active_at = ? WHERE jti = ?')
      .run(nowDateTime(), jti);
  }

  /**
   * Deactivate a single session by jti.
   *
   * @param {string} jti - Token identifier.
   * @returns {boolean} True when a row was updated.
   */
  deactivateByJti(jti) {
    return (
      this.db.prepare('UPDATE user_sessions SET active = 0 WHERE jti = ?').run(jti).changes > 0
    );
  }

  /**
   * Deactivate all active sessions of a user.
   *
   * @param {number} userId - User id.
   * @returns {number} Number of sessions deactivated.
   */
  deactivateAllByUser(userId) {
    return this.db
      .prepare('UPDATE user_sessions SET active = 0 WHERE user_id = ? AND active = 1')
      .run(userId).changes;
  }
}

export default UserSessionRepository;
