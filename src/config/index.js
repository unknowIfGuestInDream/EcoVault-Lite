import dotenv from 'dotenv';
import path from 'node:path';
import process from 'node:process';

dotenv.config({ quiet: true });

/**
 * @file 集中式应用配置。
 *
 * 值来源于环境变量（可选择通过
 * `.env` 文件提供），并回退到与
 * 原 Java `application.yml` 对应的开发友好默认值。请参阅 `.env.example` 文档。
 */

/**
 * 解析整数环境变量，并提供回退值。
 *
 * @param {string | undefined} value - 原始环境变量值。
 * @param {number} fallback - 未设置或不是有限数字时的默认值。
 * @returns {number} 解析后的整数或回退值。
 */
function intOr(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const rootDir = path.resolve(process.cwd());
const dbPathRaw = process.env.ECOVAULT_DB_PATH ?? 'data/ecovault.db';

/**
 * 不可变的应用配置对象。
 *
 * @typedef {object} AppConfig
 * @property {string} env - Node 环境（development|production|test）。
 * @property {boolean} isProduction - 是否以生产模式运行。
 * @property {number} port - HTTP 监听端口。
 * @property {string} host - HTTP 绑定地址。
 * @property {string} rootDir - 项目根目录的绝对路径。
 * @property {{ path: string }} db - 数据库设置。
 * @property {{ secret: string, expirationMs: number, maxDevices: number, cookieName: string }} jwt - JWT 设置。
 * @property {{ secret: string }} crypto - AES 密钥设置。
 * @property {{ username: string, password: string }} admin - 引导管理员账号。
 * @property {{ level: string }} log - 日志设置。
 */

/** @type {AppConfig} */
const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: intOr(process.env.ECOVAULT_PORT, 8100),
  host: process.env.ECOVAULT_HOST ?? '0.0.0.0',
  rootDir,
  db: Object.freeze({
    // 允许 ":memory:"（由测试套件使用）原样通过。
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
