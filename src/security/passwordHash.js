import bcrypt from 'bcryptjs';

/**
 * @file BCrypt password hashing helpers.
 *
 * Uses bcryptjs (a pure-JS, drop-in compatible implementation of BCrypt) so the
 * generated hashes remain interoperable with Spring Security's `BCryptPasswordEncoder`.
 */

const SALT_ROUNDS = 10;

/**
 * Hash a raw password using BCrypt.
 *
 * @param {string} rawPassword - Plain text password.
 * @returns {string} BCrypt hash (synchronous).
 */
export function hashPassword(rawPassword) {
  return bcrypt.hashSync(rawPassword, SALT_ROUNDS);
}

/**
 * Verify a raw password against a stored BCrypt hash.
 *
 * @param {string} rawPassword - Plain text password.
 * @param {string} storedHash - Previously generated BCrypt hash.
 * @returns {boolean} True when the password matches.
 */
export function verifyPassword(rawPassword, storedHash) {
  if (!storedHash) {
    return false;
  }
  try {
    return bcrypt.compareSync(rawPassword, storedHash);
  } catch {
    return false;
  }
}

export default { hashPassword, verifyPassword };
