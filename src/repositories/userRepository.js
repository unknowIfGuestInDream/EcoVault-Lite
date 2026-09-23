import { nowDateTime } from '../utils/datetime.js';

/**
 * @file 用户数据访问仓储。
 */

/**
 * 将数据库行映射为用户实体。
 *
 * @param {object | undefined} row - 数据库行。
 * @returns {object | null} 用户实体（`enabled` 为布尔值）或 null。
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
 * `users` 表的仓储。
 */
export class UserRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 按 id 查找用户。
   *
   * @param {number} id - 用户 id。
   * @returns {object | null} 用户实体或 null。
   */
  findById(id) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  /**
   * 按用户名查找用户。
   *
   * @param {string} username - 用户名。
   * @returns {object | null} 用户实体或 null。
   */
  findByUsername(username) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE username = ?').get(username));
  }

  /**
   * 检查用户名是否已存在。
   *
   * @param {string} username - 用户名。
   * @returns {boolean} 存在匹配用户时为 true。
   */
  existsByUsername(username) {
    const row = this.db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1').get(username);
    return Boolean(row);
  }

  /**
   * 列出所有用户，按 id 升序排序。
   *
   * @returns {object[]} 用户实体。
   */
  findAll() {
    return this.db.prepare('SELECT * FROM users ORDER BY id ASC').all().map(mapUser);
  }

  /**
   * 统计所有用户。
   *
   * @returns {number} 用户数量。
   */
  count() {
    return this.db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  }

  /**
   * 插入新用户。
   *
   * @param {object} user - 用户字段（username、password、nickname、email、role、enabled）。
   * @returns {object} 已插入的用户实体。
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
   * 更新用户的可变字段。
   *
   * @param {number} id - 用户 id。
   * @param {object} fields - 要更新的字段（nickname、email、role、enabled、password）。
   * @returns {object | null} 已更新的用户实体。
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
   * 按 id 删除用户。
   *
   * @param {number} id - 用户 id。
   * @returns {boolean} 删除了一行时为 true。
   */
  deleteById(id) {
    return this.db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  }
}

export default UserRepository;
