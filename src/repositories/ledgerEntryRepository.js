import { nowDateTime } from '../utils/datetime.js';

/**
 * @file Income/expense ledger repository.
 *
 * Tags live in the `ledger_entry_tags` child table (mirroring the Java
 * `@ElementCollection`). Amounts are stored and returned as integer cents.
 */

/**
 * Repository for the `ledger_entries` table and its tag collection.
 */
export class LedgerEntryRepository {
  /**
   * @param {import('better-sqlite3').Database} db - Database handle.
   */
  constructor(db) {
    /** @type {import('better-sqlite3').Database} */
    this.db = db;
  }

  /**
   * Load the ordered tag set for an entry.
   *
   * @param {number} entryId - Entry id.
   * @returns {string[]} Tags (insertion order).
   */
  #loadTags(entryId) {
    return this.db
      .prepare('SELECT tag FROM ledger_entry_tags WHERE entry_id = ? ORDER BY rowid ASC')
      .all(entryId)
      .map((row) => row.tag);
  }

  /**
   * Map a raw row plus its tags to a ledger entity.
   *
   * @param {object | undefined} row - Raw row.
   * @returns {object | null} Entity or null.
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
   * Replace the tag set of an entry.
   *
   * @param {number} entryId - Entry id.
   * @param {Iterable<string>} tags - New tags (deduplicated, blanks removed).
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
   * Find one entry scoped to its owner.
   *
   * @param {number} id - Entry id.
   * @param {number} userId - Owner id.
   * @returns {object | null} Entity or null.
   */
  findByIdAndUser(id, userId) {
    return this.#map(
      this.db.prepare('SELECT * FROM ledger_entries WHERE id = ? AND user_id = ?').get(id, userId)
    );
  }

  /**
   * Multi-condition search for a user's entries.
   *
   * @param {object} params - Filters.
   * @param {number} params.userId - Owner id (required).
   * @param {string} [params.type] - Ledger type filter.
   * @param {string} [params.start] - Inclusive start date (yyyy-MM-dd).
   * @param {string} [params.end] - Inclusive end date (yyyy-MM-dd).
   * @param {string} [params.tag] - Exact tag filter.
   * @returns {object[]} Matching entities ordered by date then id descending.
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
   * Insert a new ledger entry with its tags.
   *
   * @param {object} entry - Entry fields (amount as cents).
   * @returns {object} The inserted entity.
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
   * Update an existing ledger entry and its tags.
   *
   * @param {number} id - Entry id.
   * @param {number} userId - Owner id.
   * @param {object} entry - Entry fields (amount as cents).
   * @returns {object | null} Updated entity.
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
   * Delete an entry (and cascade its tags) scoped to its owner.
   *
   * @param {number} id - Entry id.
   * @param {number} userId - Owner id.
   * @returns {boolean} True when a row was deleted.
   */
  deleteByIdAndUser(id, userId) {
    return (
      this.db.prepare('DELETE FROM ledger_entries WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}

export default LedgerEntryRepository;
