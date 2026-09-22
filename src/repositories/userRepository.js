import { nowDateTime } from '../utils/datetime.js';

/**
 * @file User data-access repository.
 */

/**
 * Map a raw database row to a user entity.
 *
 * @param {object | undefined} row - Raw row.
 * @returns {object | null} User entity (with `enabled` as boolean) or null.
 */
function mapUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    nickname: row.nickname,
    email: row.email,
    role: row.role,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Repository for the `users` table.
 */
export class UserRepository {
  /**
   * @param {import('better-sqlite3').Database} db - Database handle.
   */
  constructor(db) {
    /** @type {import('better-sqlite3').Database} */
    this.db = db;
  }

  /**
   * Find a user by id.
   *
   * @param {number} id - User id.
   * @returns {object | null} User entity or null.
   */
  findById(id) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  /**
   * Find a user by username.
   *
   * @param {string} username - Username.
   * @returns {object | null} User entity or null.
   */
  findByUsername(username) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE username = ?').get(username));
  }

  /**
   * Check whether a username already exists.
   *
   * @param {string} username - Username.
   * @returns {boolean} True when a matching user exists.
   */
  existsByUsername(username) {
    const row = this.db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1').get(username);
    return Boolean(row);
  }

  /**
   * List all users ordered by id ascending.
   *
   * @returns {object[]} User entities.
   */
  findAll() {
    return this.db.prepare('SELECT * FROM users ORDER BY id ASC').all().map(mapUser);
  }

  /**
   * Count all users.
   *
   * @returns {number} Number of users.
   */
  count() {
    return this.db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  }

  /**
   * Insert a new user.
   *
   * @param {object} user - User fields (username, password, nickname, email, role, enabled).
   * @returns {object} The inserted user entity.
   */
  insert(user) {
    const now = nowDateTime();
    const info = this.db
      .prepare(
        `INSERT INTO users (username, password, nickname, email, role, enabled, created_at, updated_at)
         VALUES (@username, @password, @nickname, @email, @role, @enabled, @created_at, @updated_at)`
      )
      .run({
        username: user.username,
        password: user.password,
        nickname: user.nickname ?? null,
        email: user.email ?? null,
        role: user.role,
        enabled: user.enabled === false ? 0 : 1,
        created_at: now,
        updated_at: now,
      });
    return this.findById(Number(info.lastInsertRowid));
  }

  /**
   * Update mutable fields of a user.
   *
   * @param {number} id - User id.
   * @param {object} fields - Fields to update (nickname, email, role, enabled, password).
   * @returns {object | null} Updated user entity.
   */
  update(id, fields) {
    const current = this.findById(id);
    if (!current) {
      return null;
    }
    const merged = {
      nickname: fields.nickname !== undefined ? fields.nickname : current.nickname,
      email: fields.email !== undefined ? fields.email : current.email,
      role: fields.role !== undefined ? fields.role : current.role,
      enabled: fields.enabled !== undefined ? (fields.enabled ? 1 : 0) : current.enabled ? 1 : 0,
      password: fields.password !== undefined ? fields.password : current.password,
      updated_at: nowDateTime(),
      id,
    };
    this.db
      .prepare(
        `UPDATE users SET nickname = @nickname, email = @email, role = @role,
         enabled = @enabled, password = @password, updated_at = @updated_at WHERE id = @id`
      )
      .run(merged);
    return this.findById(id);
  }

  /**
   * Delete a user by id.
   *
   * @param {number} id - User id.
   * @returns {boolean} True when a row was deleted.
   */
  deleteById(id) {
    return this.db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  }
}

export default UserRepository;
