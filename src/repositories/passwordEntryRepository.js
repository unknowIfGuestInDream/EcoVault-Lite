import { nowDateTime } from '../utils/datetime.js';

/**
 * @file 密码保险箱条目仓储。
 *
 * `secret`、`notes` 和 `tags` 列保存 AES 加密载荷；
 * 仓储不感知其内容，仅持久化字符串。
 */

/**
 * 将原始行映射为密码条目实体。
 *
 * @param {object | undefined} row - 原始行。
 * @returns {object | null} 实体或 null。
 */
function mapEntry(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    account: row.account,
    secret: row.secret,
    url: row.url,
    notes: row.notes,
    category: row.category,
    tags: row.tags,
    strengthScore: row.strength_score,
    strengthLevel: row.strength_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * `password_entries` 表的仓储。
 */
export class PasswordEntryRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 列出用户条目，按最近更新时间排序。
   *
   * @param {number} userId - 所有者 id。
   * @returns {object[]} 实体。
   */
  findByUser(userId) {
    return this.db
      .prepare('SELECT * FROM password_entries WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
      .all(userId)
      .map(mapEntry);
  }

  /**
   * 在用户条目中执行不区分大小写的标题搜索。
   *
   * @param {number} userId - 所有者 id。
   * @param {string} keyword - 标题片段。
   * @returns {object[]} 匹配的实体。
   */
  searchByTitle(userId, keyword) {
    return this.db
      .prepare(
        `SELECT * FROM password_entries WHERE user_id = ? AND LOWER(title) LIKE ?
         ORDER BY updated_at DESC, id DESC`
      )
      .all(userId, `%${String(keyword).toLowerCase()}%`)
      .map(mapEntry);
  }

  /**
   * 查找归属指定所有者的单个条目。
   *
   * @param {number} id - 条目 id。
   * @param {number} userId - 所有者 id。
   * @returns {object | null} 实体或 null。
   */
  findByIdAndUser(id, userId) {
    return mapEntry(
      this.db.prepare('SELECT * FROM password_entries WHERE id = ? AND user_id = ?').get(id, userId)
    );
  }

  /**
   * 插入新条目。
   *
   * @param {object} entry - 条目字段。
   * @returns {object} 已插入的实体。
   */
  insert(entry) {
    const now = nowDateTime();
    const info = this.db
      .prepare(
        `INSERT INTO password_entries
         (user_id, title, account, secret, url, notes, category, tags, strength_score, strength_level, created_at, updated_at)
         VALUES (@user_id, @title, @account, @secret, @url, @notes, @category, @tags, @strength_score, @strength_level, @created_at, @updated_at)`
      )
      .run({
        user_id: entry.userId,
        title: entry.title,
        account: entry.account ?? null,
        secret: entry.secret,
        url: entry.url ?? null,
        notes: entry.notes ?? null,
        category: entry.category ?? null,
        tags: entry.tags ?? null,
        strength_score: entry.strengthScore ?? 0,
        strength_level: entry.strengthLevel ?? null,
        created_at: now,
        updated_at: now,
      });
    return this.findByIdAndUser(Number(info.lastInsertRowid), entry.userId);
  }

  /**
   * 更新现有条目。
   *
   * @param {number} id - 条目 id。
   * @param {number} userId - 所有者 id。
   * @param {object} fields - 要持久化的字段。
   * @returns {object | null} 已更新的实体。
   */
  update(id, userId, fields) {
    this.db
      .prepare(
        `UPDATE password_entries SET title = @title, account = @account, secret = @secret,
         url = @url, notes = @notes, category = @category, tags = @tags,
         strength_score = @strength_score, strength_level = @strength_level, updated_at = @updated_at
         WHERE id = @id AND user_id = @user_id`
      )
      .run({
        id,
        user_id: userId,
        title: fields.title,
        account: fields.account ?? null,
        secret: fields.secret,
        url: fields.url ?? null,
        notes: fields.notes ?? null,
        category: fields.category ?? null,
        tags: fields.tags ?? null,
        strength_score: fields.strengthScore ?? 0,
        strength_level: fields.strengthLevel ?? null,
        updated_at: nowDateTime(),
      });
    return this.findByIdAndUser(id, userId);
  }

  /**
   * 删除归属指定所有者的条目。
   *
   * @param {number} id - 条目 id。
   * @param {number} userId - 所有者 id。
   * @returns {boolean} 删除了一行时为 true。
   */
  deleteByIdAndUser(id, userId) {
    return (
      this.db.prepare('DELETE FROM password_entries WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}

export default PasswordEntryRepository;
