/**
 * @file SQLite 数据库引导集成测试。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

let sequence = 0;

beforeEach(() => {
  sequence += 1;
});

function uniqueRuntimeDir(prefix) {
  return path.join(
    process.cwd(),
    '.test-runtime',
    `${prefix}-${process.pid}-${Date.now()}-${sequence}`
  );
}

function cleanupRuntimeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

let dbModulePromise;

async function loadDbModule() {
  if (!dbModulePromise) {
    const previousDbPath = process.env.ECOVAULT_DB_PATH;
    process.env.ECOVAULT_DB_PATH = ':memory:';
    dbModulePromise = import(`../../../src/db/index.js?db-test=${process.pid}-${Date.now()}`);
    if (previousDbPath === undefined) {
      delete process.env.ECOVAULT_DB_PATH;
    } else {
      process.env.ECOVAULT_DB_PATH = previousDbPath;
    }
  }
  return dbModulePromise;
}

function tableNames(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
}

test('createDatabase 可创建内存库并执行完整 schema', async (t) => {
  const { createDatabase, default: singletonDb } = await loadDbModule();
  const db = createDatabase(':memory:');
  t.after(() => {
    db.close();
    singletonDb.close();
  });

  assert.ok(tableNames(db).includes('users'));
  assert.ok(tableNames(db).includes('user_sessions'));
  assert.ok(tableNames(db).includes('password_entries'));
  assert.ok(tableNames(db).includes('salary_records'));
  assert.ok(tableNames(db).includes('ledger_entries'));
  assert.ok(tableNames(db).includes('operation_logs'));
  assert.ok(tableNames(db).includes('role_permissions'));
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
});

test('createDatabase 为文件库创建缺失目录并处理已存在目录', async (t) => {
  const { createDatabase } = await loadDbModule();
  const runtimeDir = uniqueRuntimeDir('ecovault-db');
  const nestedDir = path.join(runtimeDir, 'nested');
  const firstDbPath = path.join(nestedDir, 'first.db');
  const secondDbPath = path.join(nestedDir, 'second.db');
  t.after(() => cleanupRuntimeDir(runtimeDir));

  assert.equal(fs.existsSync(nestedDir), false);
  const firstDb = createDatabase(firstDbPath);
  firstDb.close();
  assert.equal(fs.existsSync(firstDbPath), true);
  assert.equal(fs.existsSync(nestedDir), true);

  const secondDb = createDatabase(secondDbPath);
  secondDb.close();
  assert.equal(fs.existsSync(secondDbPath), true);
});

test('默认导出的数据库单例按配置路径初始化', (t) => {
  const runtimeDir = uniqueRuntimeDir('ecovault-singleton');
  const singletonPath = path.join(runtimeDir, 'singleton.db');
  t.after(() => cleanupRuntimeDir(runtimeDir));

  const script = `
    import db from './src/db/index.js';
    const result = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'").get();
    db.close();
    console.log(JSON.stringify({ count: result.count }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, ECOVAULT_DB_PATH: singletonPath },
    encoding: 'utf8',
  });
  const result = JSON.parse(output);

  assert.ok(result.count >= 8);
  assert.equal(fs.existsSync(singletonPath), true);
});
