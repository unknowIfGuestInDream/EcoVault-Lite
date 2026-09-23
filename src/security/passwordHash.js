import bcrypt from 'bcryptjs';

/**
 * @file BCrypt 密码哈希辅助工具。
 *
 * 使用 bcryptjs 生成和校验 BCrypt 哈希。
 */

const SALT_ROUNDS = 10;

/**
 * 使用 BCrypt 对明文密码进行哈希。
 *
 * @param {string} rawPassword - 明文密码。
 * @returns {string} BCrypt 哈希（同步）。
 */
export function hashPassword(rawPassword) {
  return bcrypt.hashSync(rawPassword, SALT_ROUNDS);
}

/**
 * 根据存储的 BCrypt 哈希校验明文密码。
 *
 * @param {string} rawPassword - 明文密码。
 * @param {string} storedHash - 先前生成的 BCrypt 哈希。
 * @returns {boolean} 密码匹配时返回 true。
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
