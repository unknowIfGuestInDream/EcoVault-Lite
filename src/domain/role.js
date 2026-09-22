/**
 * @file User role definitions.
 *
 * Mirrors the Java `Role` enum. `ADMIN` has full access to every page and its
 * permission set cannot be modified; `USER` is a standard account whose page
 * access is governed by role-permission grants.
 */

/**
 * Supported user roles.
 *
 * @readonly
 * @enum {string}
 */
export const Role = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
});

/**
 * All role values as an array.
 *
 * @type {ReadonlyArray<string>}
 */
export const ROLE_VALUES = Object.freeze(Object.values(Role));

/**
 * Type guard for a valid role string.
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is a recognised role.
 */
export function isRole(value) {
  return typeof value === 'string' && ROLE_VALUES.includes(value);
}

export default Role;
