-- EcoVault Lite SQLite schema.
-- Money columns are stored as INTEGER cents to preserve exact 2-decimal
-- precision (the Java version used BigDecimal). Timestamps are stored as
-- `yyyy-MM-dd HH:mm:ss` text so range queries sort lexicographically.

PRAGMA foreign_keys = ON;

-- Users / accounts -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,
  password   TEXT    NOT NULL,
  nickname   TEXT,
  email      TEXT,
  role       TEXT    NOT NULL DEFAULT 'USER',
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Login sessions (server-side JWT jti registry) ------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  jti            TEXT    NOT NULL UNIQUE,
  device_info    TEXT,
  ip             TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL,
  last_active_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_jti ON user_sessions (jti);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions (user_id);

-- Password vault entries -----------------------------------------------------
CREATE TABLE IF NOT EXISTS password_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  title          TEXT    NOT NULL,
  account        TEXT,
  secret         TEXT    NOT NULL,
  url            TEXT,
  notes          TEXT,
  category       TEXT,
  tags           TEXT,
  strength_score INTEGER NOT NULL DEFAULT 0,
  strength_level TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pwd_user ON password_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_category ON password_entries (category);

-- Salary records -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_records (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                   INTEGER NOT NULL,
  year                      INTEGER NOT NULL,
  month                     INTEGER NOT NULL,
  base_salary               INTEGER NOT NULL DEFAULT 0,
  performance_salary        INTEGER NOT NULL DEFAULT 0,
  housing_allowance         INTEGER NOT NULL DEFAULT 0,
  meal_allowance            INTEGER NOT NULL DEFAULT 0,
  transport_allowance       INTEGER NOT NULL DEFAULT 0,
  overtime_pay              INTEGER NOT NULL DEFAULT 0,
  overtime_allowance        INTEGER NOT NULL DEFAULT 0,
  bonus                     INTEGER NOT NULL DEFAULT 0,
  medical_base              INTEGER NOT NULL DEFAULT 0,
  pension_unemployment_base INTEGER NOT NULL DEFAULT 0,
  housing_fund_base         INTEGER NOT NULL DEFAULT 0,
  medical_deduction         INTEGER NOT NULL DEFAULT 0,
  pension_deduction         INTEGER NOT NULL DEFAULT 0,
  unemployment_deduction    INTEGER NOT NULL DEFAULT 0,
  housing_fund_deduction    INTEGER NOT NULL DEFAULT 0,
  income_tax                INTEGER NOT NULL DEFAULT 0,
  serious_illness_medical   INTEGER NOT NULL DEFAULT 0,
  heating_allowance         INTEGER NOT NULL DEFAULT 0,
  net_pay                   INTEGER NOT NULL DEFAULT 0,
  gross_pay                 INTEGER,
  total_deduction           INTEGER,
  pre_tax_salary            INTEGER,
  after_tax_salary          INTEGER,
  remark                    TEXT,
  created_at                TEXT    NOT NULL,
  updated_at                TEXT    NOT NULL,
  UNIQUE (user_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_salary_user ON salary_records (user_id);
CREATE INDEX IF NOT EXISTS idx_salary_ym ON salary_records (year, month);

-- Income / expense ledger ----------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,
  entry_date TEXT    NOT NULL,
  remark     TEXT,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_entries (type);

CREATE TABLE IF NOT EXISTS ledger_entry_tags (
  entry_id INTEGER NOT NULL,
  tag      TEXT    NOT NULL,
  PRIMARY KEY (entry_id, tag),
  FOREIGN KEY (entry_id) REFERENCES ledger_entries (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ledger_tag ON ledger_entry_tags (tag);

-- Operation / audit logs -----------------------------------------------------
CREATE TABLE IF NOT EXISTS operation_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  username    TEXT,
  module      TEXT,
  operation   TEXT,
  method      TEXT,
  params      TEXT,
  ip          TEXT,
  status      TEXT,
  error_msg   TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_user ON operation_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_log_module ON operation_logs (module);
CREATE INDEX IF NOT EXISTS idx_log_created ON operation_logs (created_at);

-- Role -> page permissions (RBAC) --------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  role     TEXT NOT NULL,
  page_key TEXT NOT NULL,
  UNIQUE (role, page_key)
);
