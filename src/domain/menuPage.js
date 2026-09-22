/**
 * @file Application menu pages and RBAC metadata.
 *
 * Mirrors the Java `MenuPage` enum. Each page declares which navigation group
 * it belongs to, whether it is admin-only, and whether it is "configurable"
 * (i.e. can be granted to individual roles through role permissions).
 */

/**
 * @typedef {object} MenuPageDef
 * @property {string} key - Stable identifier persisted in role permissions.
 * @property {string} title - Human-friendly Chinese label.
 * @property {string} path - Front-end route path.
 * @property {string} group - Navigation group (MAIN|FINANCE|ADMIN).
 * @property {boolean} adminOnly - Whether the page is restricted to admins.
 * @property {boolean} configurable - Whether access can be granted per role.
 */

/**
 * Ordered list of all menu pages.
 *
 * @type {ReadonlyArray<MenuPageDef>}
 */
export const MENU_PAGES = Object.freeze(
  [
    { key: 'dashboard', title: '控制台', path: '/dashboard', group: 'MAIN', adminOnly: false, configurable: false },
    { key: 'passwords', title: '密码管理', path: '/passwords', group: 'MAIN', adminOnly: false, configurable: true },
    { key: 'salary', title: '工资管理', path: '/finance', group: 'FINANCE', adminOnly: false, configurable: true },
    { key: 'ledger', title: '收入支出管理', path: '/finance/ledger', group: 'FINANCE', adminOnly: false, configurable: true },
    { key: 'profile', title: '个人中心', path: '/profile', group: 'MAIN', adminOnly: false, configurable: false },
    { key: 'users', title: '用户管理', path: '/admin/users', group: 'ADMIN', adminOnly: true, configurable: false },
    { key: 'logs', title: '日志管理', path: '/admin/logs', group: 'ADMIN', adminOnly: true, configurable: false },
    { key: 'roles', title: '角色管理', path: '/admin/roles', group: 'ADMIN', adminOnly: true, configurable: false },
  ].map((page) => Object.freeze(page))
);

/**
 * Lookup map keyed by page key.
 *
 * @type {ReadonlyMap<string, MenuPageDef>}
 */
const PAGE_BY_KEY = new Map(MENU_PAGES.map((page) => [page.key, page]));

/**
 * Resolve a menu page definition by key.
 *
 * @param {string} key - Page key.
 * @returns {MenuPageDef | undefined} The matching page or undefined.
 */
export function getMenuPage(key) {
  return PAGE_BY_KEY.get(key);
}

/**
 * Keys of pages whose access can be configured per role.
 *
 * @type {ReadonlyArray<string>}
 */
export const CONFIGURABLE_PAGE_KEYS = Object.freeze(
  MENU_PAGES.filter((page) => page.configurable).map((page) => page.key)
);

/**
 * Whether a page key is a configurable page.
 *
 * @param {string} key - Page key.
 * @returns {boolean} True when the page is configurable.
 */
export function isConfigurablePage(key) {
  return CONFIGURABLE_PAGE_KEYS.includes(key);
}

export default MENU_PAGES;
