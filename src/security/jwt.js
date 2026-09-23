import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * @file JSON Web Token provider.
 *
 * Mirrors the Java `JwtTokenProvider`:
 * - Algorithm HS256.
 * - The signing key is the raw SHA-256 digest (32 bytes) of the configured
 *   secret string, not the secret itself.
 * - Registered claims: `sub` (username), `jti` (UUID without dashes), plus a
 *   custom `uid` claim holding the numeric user id.
 * - Default expiration is driven by `ECOVAULT_JWT_EXPIRATION_MS` (2h default).
 */

const SIGNING_KEY = crypto.createHash('sha256').update(config.jwt.secret, 'utf8').digest();

/**
 * @typedef {object} GeneratedToken
 * @property {string} token - Signed compact JWT.
 * @property {string} jti - Token identifier (also stored server-side as the session id).
 * @property {number} issuedAt - Issue time (epoch milliseconds).
 * @property {number} expiresAt - Expiry time (epoch milliseconds).
 */

/**
 * Generate a signed JWT for a user.
 *
 * @param {{ userId: number, username: string }} params - Subject details.
 * @returns {GeneratedToken} The signed token and its metadata.
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
 * Verify and decode a JWT.
 *
 * @param {string} token - Compact JWT string.
 * @returns {object} Decoded payload (`sub`, `jti`, `uid`, `iat`, `exp`).
 * @throws {object} When the token is invalid or expired.
 */
export function verifyToken(token) {
  return /** @type {object} */ (jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] }));
}

export default { generateToken, verifyToken };
