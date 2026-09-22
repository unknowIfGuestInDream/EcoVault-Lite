import dotenv from 'dotenv';
import path from 'node:path';
import process from 'node:process';

dotenv.config({ quiet: true });

/**
 * @file Centralised application configuration.
 *
 * Values are sourced from environment variables (optionally provided through a
 * `.env` file) and fall back to development-friendly defaults that mirror the
 * original Java `application.yml`. See `.env.example` for documentation.
 */

/**
 * Parse an integer environment variable with a fallback.
 *
 * @param {string | undefined} value - Raw environment value.
 * @param {number} fallback - Default when unset or not a finite number.
 * @returns {number} Parsed integer or the fallback.
 */
function intOr(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const rootDir = path.resolve(process.cwd());
const dbPathRaw = process.env.ECOVAULT_DB_PATH ?? 'data/ecovault.db';

/**
 * Immutable application configuration object.
 *
 * @typedef {object} AppConfig
 * @property {string} env - Node environment (development|production|test).
 * @property {boolean} isProduction - Whether running in production mode.
 * @property {number} port - HTTP listen port.
 * @property {string} host - HTTP bind address.
 * @property {string} rootDir - Absolute project root directory.
 * @property {{ path: string }} db - Database settings.
 * @property {{ secret: string, expirationMs: number, maxDevices: number, cookieName: string }} jwt - JWT settings.
 * @property {{ secret: string }} crypto - AES secret settings.
 * @property {{ username: string, password: string }} admin - Bootstrap admin account.
 * @property {{ level: string }} log - Logging settings.
 */

/** @type {AppConfig} */
const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: intOr(process.env.ECOVAULT_PORT, 8100),
  host: process.env.ECOVAULT_HOST ?? '0.0.0.0',
  rootDir,
  db: Object.freeze({
    // Allow ":memory:" (used by the test-suite) to pass through untouched.
    path: dbPathRaw === ':memory:' ? dbPathRaw : path.resolve(rootDir, dbPathRaw),
  }),
  jwt: Object.freeze({
    secret:
      process.env.ECOVAULT_JWT_SECRET ??
      'Zm9vYmFyLWVjb3ZhdWx0LXNlY3JldC1rZXktY2hhbmdlLW1lLTEyMzQ1Njc4OTA=',
    expirationMs: intOr(process.env.ECOVAULT_JWT_EXPIRATION_MS, 7200000),
    maxDevices: Math.max(1, intOr(process.env.ECOVAULT_MAX_DEVICES, 1)),
    cookieName: 'ECOVAULT_TOKEN',
  }),
  crypto: Object.freeze({
    secret: process.env.ECOVAULT_CRYPTO_SECRET ?? 'ecovault-aes-secret-change-me-32b',
  }),
  admin: Object.freeze({
    username: process.env.ECOVAULT_ADMIN_USERNAME ?? 'admin',
    password: process.env.ECOVAULT_ADMIN_PASSWORD ?? 'Admin@123',
  }),
  log: Object.freeze({
    level: process.env.ECOVAULT_APP_LOG_LEVEL ?? 'info',
  }),
});

export default config;
