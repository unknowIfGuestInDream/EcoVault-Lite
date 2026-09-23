import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * @file JSON Web Token 提供器。
 *
 * 对齐 Java `JwtTokenProvider`：
 * - 算法为 HS256。
 * - 签名密钥是已配置 secret 字符串的原始 SHA-256 摘要（32 字节），
 *   而不是 secret 本身。
 * - 注册声明：`sub`（username）、`jti`（不带短横线的 UUID），以及
 *   保存数字用户 id 的自定义 `uid` 声明。
 * - 默认过期时间由 `ECOVAULT_JWT_EXPIRATION_MS` 驱动（默认 2h）。
 */

const SIGNING_KEY = crypto.createHash('sha256').update(config.jwt.secret, 'utf8').digest();

/**
 * @typedef {object} GeneratedToken
 * @property {string} token - 已签名的紧凑 JWT。
 * @property {string} jti - 令牌标识符（也作为会话 id 存储在服务端）。
 * @property {number} issuedAt - 签发时间（纪元毫秒）。
 * @property {number} expiresAt - 过期时间（纪元毫秒）。
 */

/**
 * 为用户生成已签名的 JWT。
 *
 * @param {{ userId: number, username: string }} params - 主体详情。
 * @returns {GeneratedToken} 已签名的 token 及其元数据。
 */
export function generateToken({ userId, username }) {
  const jti = crypto.randomUUID().replace(/-/g, '');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + config.jwt.expirationMs;
  const token = jwt.sign({ uid: userId }, SIGNING_KEY, {
    algorithm: 'HS256',
    subject: String(username),
    jwtid: jti,
    expiresIn: Math.floor(config.jwt.expirationMs / 1000),
  });
  return { token, jti, issuedAt, expiresAt };
}

/**
 * 校验并解码 JWT。
 *
 * @param {string} token - 紧凑 JWT 字符串。
 * @returns {object} 解码后的载荷（`sub`、`jti`、`uid`、`iat`、`exp`）。
 * @throws {object} token 无效或过期时抛出。
 */
export function verifyToken(token) {
  return /** @type {object} */ (jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] }));
}

export default { generateToken, verifyToken };
