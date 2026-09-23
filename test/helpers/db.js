import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createContext } from '../../src/context.js';

/**
 * @file 测试基础设施：内存数据库与上下文工厂。
 *
 * 所有集成测试通过内存 SQLite 数据库运行，保证彼此完全隔离、
 * 无磁盘副作用且执行迅速。schema 直接读取自生产用的
 * `src/db/schema.sql`，确保测试与真实建表语句一致。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../../src/db/schema.sql');
const SCHEMA = fs.readFileSync(schemaPath, 'utf8');

/**
 * 创建一个已初始化 schema 的内存数据库。
 *
 * @returns {import('better-sqlite3').Database} 内存数据库句柄。
 */
export function createTestDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

/**
 * 基于内存数据库构建完整的应用上下文（仓储 + 服务）。
 *
 * @returns {{ db: object, context: object, repositories: object, services: object }} 已装配的上下文。
 */
export function createTestContext() {
  const db = createTestDatabase();
  const context = createContext(db);
  return { db, context, repositories: context.repositories, services: context.services };
}

/**
 * 直接向 `users` 表插入一条测试用户记录。
 *
 * @param {object} db - 数据库句柄。
 * @param {object} [overrides] - 覆盖默认字段的值。
 * @returns {object} 已插入用户的原始行（含自增 id）。
 */
export function insertUser(db, overrides = {}) {
  const user = {
    username: 'tester',
    password: 'hash',
    nickname: '测试用户',
    email: 'tester@example.com',
    role: 'USER',
    enabled: 1,
    created_at: '2024-01-01 00:00:00',
    updated_at: '2024-01-01 00:00:00',
    ...overrides,
  };
  const info = db
    .prepare(
      `INSERT INTO users (username, password, nickname, email, role, enabled, created_at, updated_at)
       VALUES (@username, @password, @nickname, @email, @role, @enabled, @created_at, @updated_at)`
    )
    .run(user);
  return { id: Number(info.lastInsertRowid), ...user };
}
