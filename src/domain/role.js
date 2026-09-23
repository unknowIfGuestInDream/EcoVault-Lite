/**
 * @file 用户角色定义。
 *
 * 对齐 Java `Role` 枚举。`ADMIN` 拥有所有页面的完整访问权限，且其
 * 权限集不可修改；`USER` 是标准账号，其页面
 * 访问由角色权限授权控制。
 */

/**
 * 支持的用户角色。
 *
 * @readonly
 * @enum {string}
 */
export const Role = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
});

/**
 * 数组形式的所有角色值。
 *
 * @type {ReadonlyArray<string>}
 */
export const ROLE_VALUES = Object.freeze(Object.values(Role));

/**
 * 有效角色字符串的类型守卫。
 *
 * @param {unknown} value - 候选值。
 * @returns {boolean} 值为已识别的角色时返回 true。
 */
export function isRole(value) {
  return typeof value === 'string' && ROLE_VALUES.includes(value);
}

export default Role;
