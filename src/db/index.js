import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import config from '../config/index.js';

/**
 * @file SQLite 数据库引导。
 *
 * 打开（或创建）better-sqlite3 数据库，为
 * 轻量级单写入者负载应用实用的 pragma，并执行 schema。单个
 * 共享连接被导出，因为 better-sqlite3 是同步的，且
 * SQLite 同一时间只支持一个写入者。
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(moduleDir, 'schema.sql');

/**
 * 确保基于文件的数据库的父目录存在。
 *
 * @param {string} dbPath - 已配置的数据库路径。
 * @returns {void}
 */
function ensureDbDir(dbPath) {
  if (dbPath === ':memory:') {
    return;
  }
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 创建并初始化数据库连接。
 *
 * @param {string} [dbPath] - 可选的数据库路径覆盖值（供测试使用）。
 * @returns {object} 已初始化的数据库句柄。
 */
export function createDatabase(dbPath = config.db.path) {
  ensureDbDir(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  return db;
}

/**
 * 共享的应用数据库连接。
 *
 * @type {object}
 */
const db = createDatabase();

export default db;
