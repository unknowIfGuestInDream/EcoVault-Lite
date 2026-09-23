import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import config from '../config/index.js';

/**
 * @file SQLite database bootstrap.
 *
 * Opens (or creates) the better-sqlite3 database, applies pragmatic pragmas for
 * a lightweight single-writer workload, and executes the schema. A single
 * shared connection is exported because better-sqlite3 is synchronous and
 * SQLite only supports one writer at a time.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(moduleDir, 'schema.sql');

/**
 * Ensure the parent directory for a file-based database exists.
 *
 * @param {string} dbPath - Configured database path.
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
 * Create and initialise a database connection.
 *
 * @param {string} [dbPath] - Optional database path override (used by tests).
 * @returns {object} An initialised database handle.
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
 * The shared application database connection.
 *
 * @type {object}
 */
const db = createDatabase();

export default db;
