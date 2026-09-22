/**
 * @file Role-permission repository (RBAC page grants).
 */

/**
 * Repository for the `role_permissions` table.
 */
export class RolePermissionRepository {
  /**
   * @param {import('better-sqlite3').Database} db - Database handle.
   */
  constructor(db) {
    /** @type {import('better-sqlite3').Database} */
    this.db = db;
  }

  /**
   * List permission rows for a role.
   *
   * @param {string} role - Role name.
   * @returns {Array<{ id: number, role: string, pageKey: string }>} Permission rows.
   */
  findByRole(role) {
    return this.db
      .prepare(
        'SELECT id, role, page_key AS pageKey FROM role_permissions WHERE role = ? ORDER BY id ASC'
      )
      .all(role);
  }

  /**
   * List the page keys granted to a role.
   *
   * @param {string} role - Role name.
   * @returns {string[]} Granted page keys.
   */
  findPageKeysByRole(role) {
    return this.db
      .prepare('SELECT page_key FROM role_permissions WHERE role = ? ORDER BY id ASC')
      .all(role)
      .map((row) => row.page_key);
  }

  /**
   * Whether any permission row exists for a role.
   *
   * @param {string} role - Role name.
   * @returns {boolean} True when at least one row exists.
   */
  existsByRole(role) {
    return Boolean(
      this.db.prepare('SELECT 1 FROM role_permissions WHERE role = ? LIMIT 1').get(role)
    );
  }

  /**
   * Delete all permission rows for a role.
   *
   * @param {string} role - Role name.
   * @returns {number} Number of rows deleted.
   */
  deleteByRole(role) {
    return this.db.prepare('DELETE FROM role_permissions WHERE role = ?').run(role).changes;
  }

  /**
   * Grant a single page to a role (idempotent).
   *
   * @param {string} role - Role name.
   * @param {string} pageKey - Page key.
   * @returns {void}
   */
  insert(role, pageKey) {
    this.db
      .prepare('INSERT OR IGNORE INTO role_permissions (role, page_key) VALUES (?, ?)')
      .run(role, pageKey);
  }

  /**
   * Replace the whole permission set of a role atomically.
   *
   * @param {string} role - Role name.
   * @param {Iterable<string>} pageKeys - Page keys to grant.
   * @returns {void}
   */
  replaceForRole(role, pageKeys) {
    const tx = this.db.transaction((keys) => {
      this.deleteByRole(role);
      for (const key of keys) {
        this.insert(role, key);
      }
    });
    tx([...new Set(pageKeys)]);
  }
}

export default RolePermissionRepository;
