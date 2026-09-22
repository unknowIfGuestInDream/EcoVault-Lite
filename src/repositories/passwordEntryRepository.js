import { nowDateTime } from '../utils/datetime.js';

/**
 * @file Password vault entry repository.
 *
 * The `secret`, `notes` and `tags` columns hold AES-encrypted payloads; the
 * repository is agnostic to their contents and simply persists strings.
 */

/**
 * Map a raw row to a password-entry entity.
 *
 * @param {object | undefined} row - Raw row.
 * @returns {object | null} Entity or null.
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
 * Repository for the `password_entries` table.
 */
export class PasswordEntryRepository {
  /**
   * @param {import('better-sqlite3').Database} db - Database handle.
   */
  constructor(db) {
    /** @type {import('better-sqlite3').Database} */
    this.db = db;
  }

  /**
   * List a user's entries ordered by most recently updated.
   *
   * @param {number} userId - Owner id.
   * @returns {object[]} Entities.
   */
  findByUser(userId) {
    return this.db
      .prepare('SELECT * FROM password_entries WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
      .all(userId)
      .map(mapEntry);
  }

  /**
   * Case-insensitive title search within a user's entries.
   *
   * @param {number} userId - Owner id.
   * @param {string} keyword - Title fragment.
   * @returns {object[]} Matching entities.
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
   * Find one entry scoped to its owner.
   *
   * @param {number} id - Entry id.
   * @param {number} userId - Owner id.
   * @returns {object | null} Entity or null.
   */
  findByIdAndUser(id, userId) {
    return mapEntry(
      this.db.prepare('SELECT * FROM password_entries WHERE id = ? AND user_id = ?').get(id, userId)
    );
  }

  /**
   * Insert a new entry.
   *
   * @param {object} entry - Entry fields.
   * @returns {object} The inserted entity.
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
   * Update an existing entry.
   *
   * @param {number} id - Entry id.
   * @param {number} userId - Owner id.
   * @param {object} fields - Fields to persist.
   * @returns {object | null} Updated entity.
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
   * Delete an entry scoped to its owner.
   *
   * @param {number} id - Entry id.
   * @param {number} userId - Owner id.
   * @returns {boolean} True when a row was deleted.
   */
  deleteByIdAndUser(id, userId) {
    return (
      this.db.prepare('DELETE FROM password_entries WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}

export default PasswordEntryRepository;
