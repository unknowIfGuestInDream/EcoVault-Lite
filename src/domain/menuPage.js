/**
 * @file 应用菜单页面与 RBAC 元数据。
 *
 * 菜单页面定义。每个页面声明其所属的导航分组、
 * 是否仅管理员可见，以及是否为 "configurable"
 * （即是否可通过角色权限授予给单个角色）。
 */

/**
 * @typedef {object} MenuPageDef
 * @property {string} key - 持久化到角色权限中的稳定标识符。
 * @property {string} title - 人类友好的中文标签。
 * @property {string} path - 前端路由路径。
 * @property {string} group - 导航分组（MAIN|FINANCE|ADMIN）。
 * @property {boolean} adminOnly - 页面是否限制为管理员访问。
 * @property {boolean} configurable - 是否可按角色授予访问权限。
 */

/**
 * 所有菜单页面的有序列表。
 *
 * @type {ReadonlyArray<MenuPageDef>}
 */
export const MENU_PAGES = Object.freeze(
  [
    {
      key: 'dashboard',
      title: '控制台',
      path: '/dashboard',
      group: 'MAIN',
      adminOnly: false,
      configurable: false,
    },
    {
      key: 'passwords',
      title: '密码管理',
      path: '/passwords',
      group: 'MAIN',
      adminOnly: false,
      configurable: true,
    },
    {
      key: 'salary',
      title: '工资管理',
      path: '/finance',
      group: 'FINANCE',
      adminOnly: false,
      configurable: true,
    },
    {
      key: 'ledger',
      title: '收入支出管理',
      path: '/finance/ledger',
      group: 'FINANCE',
      adminOnly: false,
      configurable: true,
    },
    {
      key: 'profile',
      title: '个人中心',
      path: '/profile',
      group: 'MAIN',
      adminOnly: false,
      configurable: false,
    },
    {
      key: 'users',
      title: '用户管理',
      path: '/admin/users',
      group: 'ADMIN',
      adminOnly: true,
      configurable: false,
    },
    {
      key: 'logs',
      title: '日志管理',
      path: '/admin/logs',
      group: 'ADMIN',
      adminOnly: true,
      configurable: false,
    },
    {
      key: 'roles',
      title: '角色管理',
      path: '/admin/roles',
      group: 'ADMIN',
      adminOnly: true,
      configurable: false,
    },
  ].map((page) => Object.freeze(page))
);

/**
 * 以页面 key 为键的查找映射。
 *
 * @type {ReadonlyMap<string, MenuPageDef>}
 */
const PAGE_BY_KEY = new Map(MENU_PAGES.map((page) => [page.key, page]));

/**
 * 通过 key 解析菜单页面定义。
 *
 * @param {string} key - 页面 key。
 * @returns {MenuPageDef | undefined} 匹配的页面或 undefined。
 */
export function getMenuPage(key) {
  return PAGE_BY_KEY.get(key);
}

/**
 * 访问权限可按角色配置的页面 key。
 *
 * @type {ReadonlyArray<string>}
 */
export const CONFIGURABLE_PAGE_KEYS = Object.freeze(
  MENU_PAGES.filter((page) => page.configurable).map((page) => page.key)
);

/**
 * 判断页面 key 是否为可配置页面。
 *
 * @param {string} key - 页面 key。
 * @returns {boolean} 页面可配置时返回 true。
 */
export function isConfigurablePage(key) {
  return CONFIGURABLE_PAGE_KEYS.includes(key);
}

/**
 * 可配置页面定义的有序列表。
 *
 * @returns {MenuPageDef[]} 按菜单顺序排列的可配置页面。
 */
export function configurablePages() {
  return MENU_PAGES.filter((page) => page.configurable);
}

/**
 * 通过路由路径解析菜单页面定义。
 *
 * @param {string} path - 路由路径。
 * @returns {MenuPageDef | undefined} 匹配的页面或 undefined。
 */
export function getMenuPageByPath(path) {
  return MENU_PAGES.find((page) => page.path === path);
}

export default MENU_PAGES;
