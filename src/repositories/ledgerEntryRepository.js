import { nowDateTime } from '../utils/datetime.js';

/**
 * @file 收入/支出账本仓储。
 *
 * 标签存放在 `ledger_entry_tags` 子表中。金额以整数分存储并返回。
 */

/**
 * `ledger_entries` 表及其标签集合的仓储。
 */
export class LedgerEntryRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 加载条目的有序标签集合。
   *
   * @param {number} entryId - 条目 id。
   * @returns {string[]} 标签（插入顺序）。
   */
  #loadTags(entryId) {
    return this.db
      .prepare('SELECT tag FROM ledger_entry_tags WHERE entry_id = ? ORDER BY rowid ASC')
      .all(entryId)
      .map((row) => row.tag);
  }

  /**
   * 将数据库行及其标签映射到账本实体。
   *
   * @param {object | undefined} row - 数据库行。
   * @returns {object | null} 实体或 null。
   */
  #map(row) {
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      amount: row.amount ?? 0,
      entryDate: row.entry_date,
      tags: this.#loadTags(row.id),
      remark: row.remark,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 替换条目的标签集合。
   *
   * @param {number} entryId - 条目 id。
   * @param {Iterable<string>} tags - 新标签（去重并移除空白项）。
   * @returns {void}
   */
  #replaceTags(entryId, tags) {
    this.db.prepare('DELETE FROM ledger_entry_tags WHERE entry_id = ?').run(entryId);
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO ledger_entry_tags (entry_id, tag) VALUES (?, ?)'
    );
    const seen = new Set();
    for (const raw of tags ?? []) {
      const tag = String(raw ?? '').trim();
      if (tag.length === 0 || seen.has(tag)) {
        continue;
      }
      seen.add(tag);
      insert.run(entryId, tag);
    }
  }

  /**
   * 查找归属指定所有者的单个条目。
   *
   * @param {number} id - 条目 id。
   * @param {number} userId - 所有者 id。
   * @returns {object | null} 实体或 null。
   */
  findByIdAndUser(id, userId) {
    return this.#map(
      this.db.prepare('SELECT * FROM ledger_entries WHERE id = ? AND user_id = ?').get(id, userId)
    );
  }

  /**
   * 对用户条目执行多条件搜索。
   *
   * @param {object} params - 过滤条件。
   * @param {number} params.userId - 所有者 id（必填）。
   * @param {string} [params.type] - 账本类型过滤条件。
   * @param {string} [params.start] - 起始日期（含，yyyy-MM-dd）。
   * @param {string} [params.end] - 结束日期（含，yyyy-MM-dd）。
   * @param {string} [params.tag] - 精确标签过滤条件。
   * @returns {object[]} 匹配的实体，按日期再按 id 降序排序。
   */
  search({ userId, type, start, end, tag }) {
    const clauses = ['e.user_id = @userId'];
    const args = { userId };
    if (type) {
      clauses.push('e.type = @type');
      args.type = type;
    }
    if (start) {
      clauses.push('e.entry_date >= @start');
      args.start = start;
    }
    if (end) {
      clauses.push('e.entry_date <= @end');
      args.end = end;
    }
    let join = '';
    if (tag) {
      join = 'JOIN ledger_entry_tags t ON t.entry_id = e.id';
      clauses.push('t.tag = @tag');
      args.tag = tag;
    }
    const rows = this.db
      .prepare(
        `SELECT DISTINCT e.* FROM ledger_entries e ${join}
         WHERE ${clauses.join(' AND ')}
         ORDER BY e.entry_date DESC, e.id DESC`
      )
      .all(args);
    return rows.map((row) => this.#map(row));
  }

  /**
   * 插入带有标签的新账本条目。
   *
   * @param {object} entry - 条目字段（金额以分为单位）。
   * @returns {object} 已插入的实体。
   */
  insert(entry) {
    const now = nowDateTime();
    const info = this.db
      .prepare(
        `INSERT INTO ledger_entries (user_id, type, amount, entry_date, remark, created_at, updated_at)
         VALUES (@user_id, @type, @amount, @entry_date, @remark, @created_at, @updated_at)`
      )
      .run({
        user_id: entry.userId,
        type: entry.type,
        amount: Math.round(entry.amount ?? 0),
        entry_date: entry.entryDate,
        remark: entry.remark ?? null,
        created_at: now,
        updated_at: now,
      });
    const id = Number(info.lastInsertRowid);
    this.#replaceTags(id, entry.tags);
    return this.findByIdAndUser(id, entry.userId);
  }

  /**
   * 更新现有账本条目及其标签。
   *
   * @param {number} id - 条目 id。
   * @param {number} userId - 所有者 id。
   * @param {object} entry - 条目字段（金额以分为单位）。
   * @returns {object | null} 已更新的实体。
   */
  update(id, userId, entry) {
    this.db
      .prepare(
        `UPDATE ledger_entries SET type = @type, amount = @amount, entry_date = @entry_date,
         remark = @remark, updated_at = @updated_at WHERE id = @id AND user_id = @user_id`
      )
      .run({
        id,
        user_id: userId,
        type: entry.type,
        amount: Math.round(entry.amount ?? 0),
        entry_date: entry.entryDate,
        remark: entry.remark ?? null,
        updated_at: nowDateTime(),
      });
    this.#replaceTags(id, entry.tags);
    return this.findByIdAndUser(id, userId);
  }

  /**
   * 删除归属指定所有者的条目（并级联删除其标签）。
   *
   * @param {number} id - 条目 id。
   * @param {number} userId - 所有者 id。
   * @returns {boolean} 删除了一行时为 true。
   */
  deleteByIdAndUser(id, userId) {
    return (
      this.db.prepare('DELETE FROM ledger_entries WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}

export default LedgerEntryRepository;
