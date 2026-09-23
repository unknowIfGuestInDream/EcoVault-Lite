/**
 * @file 角色-权限仓储（RBAC 页面授权）。
 */

/**
 * `role_permissions` 表的仓储。
 */
export class RolePermissionRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 列出角色的权限行。
   *
   * @param {string} role - 角色名称。
   * @returns {Array<{ id: number, role: string, pageKey: string }>} 权限行。
   */
  findByRole(role) {
    return this.db
      .prepare(
        'SELECT id, role, page_key AS pageKey FROM role_permissions WHERE role = ? ORDER BY id ASC'
      )
      .all(role);
  }

  /**
   * 列出授予角色的页面键。
   *
   * @param {string} role - 角色名称。
   * @returns {string[]} 已授予的页面键。
   */
  findPageKeysByRole(role) {
    return this.db
      .prepare('SELECT page_key FROM role_permissions WHERE role = ? ORDER BY id ASC')
      .all(role)
      .map((row) => row.page_key);
  }

  /**
   * 角色是否存在任意权限行。
   *
   * @param {string} role - 角色名称。
   * @returns {boolean} 至少存在一行时为 true。
   */
  existsByRole(role) {
    return Boolean(
      this.db.prepare('SELECT 1 FROM role_permissions WHERE role = ? LIMIT 1').get(role)
    );
  }

  /**
   * 删除角色的所有权限行。
   *
   * @param {string} role - 角色名称。
   * @returns {number} 已删除的行数。
   */
  deleteByRole(role) {
    return this.db.prepare('DELETE FROM role_permissions WHERE role = ?').run(role).changes;
  }

  /**
   * 向角色授予单个页面（幂等）。
   *
   * @param {string} role - 角色名称。
   * @param {string} pageKey - 页面键。
   * @returns {void}
   */
  insert(role, pageKey) {
    this.db
      .prepare('INSERT OR IGNORE INTO role_permissions (role, page_key) VALUES (?, ?)')
      .run(role, pageKey);
  }

  /**
   * 以原子方式替换角色的完整权限集合。
   *
   * @param {string} role - 角色名称。
   * @param {Iterable<string>} pageKeys - 要授予的页面键。
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
