import { BusinessError } from '../common/errors.js';
import { Role, ROLE_VALUES } from '../domain/role.js';
import {
  MENU_PAGES,
  CONFIGURABLE_PAGE_KEYS,
  configurablePages,
  getMenuPageByPath,
} from '../domain/menuPage.js';

/**
 * @file Role-permission (RBAC) service.
 *
 * Reproduces the Java `RolePermissionServiceImpl`: seeding default grants,
 * exposing the role/permission matrix, updating a role's configurable pages,
 * and resolving which pages/paths a user may access.
 */

/**
 * Role-permission service.
 */
export class RolePermissionService {
  /**
   * @param {object} deps - Dependencies.
   * @param {import('../repositories/rolePermissionRepository.js').RolePermissionRepository} deps.repository - RBAC repo.
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Seed default permissions: every role is granted all configurable pages
   * unless it already has grants.
   *
   * @returns {void}
   */
  initDefaults() {
    for (const role of ROLE_VALUES) {
      if (!this.repository.existsByRole(role)) {
        for (const key of CONFIGURABLE_PAGE_KEYS) {
          this.repository.insert(role, key);
        }
      }
    }
  }

  /**
   * Build the role/permission matrix (configurable pages × roles).
   *
   * @returns {{ pages: Array<{key: string, label: string, group: string}>, roles: Array<{role: string, allowedPages: string[]}> }} Matrix.
   */
  getMatrix() {
    const pages = configurablePages().map((page) => ({
      key: page.key,
      label: page.title,
      group: page.group,
    }));
    const roles = ROLE_VALUES.map((role) => ({
      role,
      allowedPages: this.#allowedConfigurableKeys(role),
    }));
    return { pages, roles };
  }

  /**
   * Replace the configurable pages granted to a role.
   *
   * @param {string} role - Target role.
   * @param {string[]} pageKeys - Requested page keys.
   * @returns {void}
   * @throws {BusinessError} When targeting ADMIN or an illegal page key is supplied.
   */
  updatePermissions(role, pageKeys) {
    if (role === Role.ADMIN) {
      throw new BusinessError('ADMIN 角色默认拥有全部页面访问权限，不允许修改');
    }
    const configurableKeys = new Set(CONFIGURABLE_PAGE_KEYS);
    const normalized = [];
    const seen = new Set();
    if (Array.isArray(pageKeys)) {
      for (const key of pageKeys) {
        if (key === null || key === undefined || String(key).trim() === '') {
          continue;
        }
        const trimmed = String(key).trim();
        if (!configurableKeys.has(trimmed)) {
          throw new BusinessError(`非法的页面: ${trimmed}`);
        }
        if (!seen.has(trimmed)) {
          seen.add(trimmed);
          normalized.push(trimmed);
        }
      }
    }
    this.repository.replaceForRole(role, normalized);
  }

  /**
   * Resolve the set of page keys a user may access.
   *
   * Always includes the non-admin, non-configurable pages (dashboard/profile).
   * ADMIN receives every page; other users receive their configurable grants.
   *
   * @param {{ role: string } | null} user - Current user.
   * @returns {string[]} Accessible page keys (insertion-ordered, de-duplicated).
   */
  accessiblePageKeys(user) {
    const keys = [];
    const seen = new Set();
    const add = (key) => {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    };
    for (const page of MENU_PAGES) {
      if (!page.adminOnly && !page.configurable) {
        add(page.key);
      }
    }
    if (user && user.role === Role.ADMIN) {
      for (const page of MENU_PAGES) {
        add(page.key);
      }
      return keys;
    }
    if (user) {
      for (const key of this.#allowedConfigurableKeys(user.role)) {
        add(key);
      }
    }
    return keys;
  }

  /**
   * Whether a user may access the page mapped to a given route path.
   *
   * @param {{ role: string } | null} user - Current user.
   * @param {string} path - Route path.
   * @returns {boolean} True when access is allowed.
   */
  canAccessPath(user, path) {
    const page = getMenuPageByPath(path);
    if (!page) {
      return true;
    }
    const admin = Boolean(user && user.role === Role.ADMIN);
    if (page.adminOnly) {
      return admin;
    }
    if (admin) {
      return true;
    }
    if (page.configurable) {
      return Boolean(user && this.#allowedConfigurableKeys(user.role).includes(page.key));
    }
    return true;
  }

  /**
   * The configurable page keys currently granted to a role.
   *
   * @param {string} role - Role name.
   * @returns {string[]} Granted configurable keys (de-duplicated, insertion order).
   */
  #allowedConfigurableKeys(role) {
    const configurableKeys = new Set(CONFIGURABLE_PAGE_KEYS);
    const result = [];
    const seen = new Set();
    for (const key of this.repository.findPageKeysByRole(role)) {
      if (configurableKeys.has(key) && !seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    }
    return result;
  }
}

export default RolePermissionService;
