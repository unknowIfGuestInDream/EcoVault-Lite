import { BusinessError } from '../common/errors.js';
import { Role, ROLE_VALUES } from '../domain/role.js';
import {
  MENU_PAGES,
  CONFIGURABLE_PAGE_KEYS,
  configurablePages,
  getMenuPageByPath,
} from '../domain/menuPage.js';

/**
 * @file 角色权限（RBAC）服务。
 *
 * 角色权限服务能力：种子化默认授权、
 * 暴露角色/权限矩阵、更新角色的可配置页面、
 * 以及解析用户可访问的页面/路径。
 */

/**
 * 角色权限服务。
 */
export class RolePermissionService {
  /**
   * @param {object} deps - 依赖项。
   * @param {object} deps.repository - RBAC 仓储。
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * 种子化默认权限：每个角色都会被授予所有可配置页面
   * 除非它已经有授权。
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
   * 构建角色/权限矩阵（可配置页面 × 角色）。
   *
   * @returns {{ pages: Array<{key: string, label: string, group: string}>, roles: Array<{role: string, allowedPages: string[]}> }} 矩阵。
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
   * 替换授予角色的可配置页面。
   *
   * @param {string} role - 目标角色。
   * @param {string[]} pageKeys - 请求的页面键。
   * @returns {void}
   * @throws {BusinessError} 当目标为 ADMIN 或提供了非法页面键时。
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
   * 解析用户可访问的页面键集合。
   *
   * 始终包含非管理员、不可配置页面（dashboard/profile）。
   * ADMIN 获得所有页面；其他用户获得其可配置授权。
   *
   * @param {{ role: string } | null} user - 当前用户。
   * @returns {string[]} 可访问的页面键（按插入顺序，已去重）。
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
   * 用户是否可访问映射到给定路由路径的页面。
   *
   * @param {{ role: string } | null} user - 当前用户。
   * @param {string} path - 路由路径。
   * @returns {boolean} 访问被允许时为 true。
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
   * 当前授予角色的可配置页面键。
   *
   * @param {string} role - 角色名称。
   * @returns {string[]} 已授权的可配置键（已去重，插入顺序）。
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
