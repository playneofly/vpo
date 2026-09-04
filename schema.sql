-- اسکیمای دیتابیس vpo (Cloudflare D1)
-- اجرا با: wrangler d1 execute vpo --file=schema.sql

CREATE TABLE IF NOT EXISTS servers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  country    TEXT DEFAULT '',
  protocol   TEXT NOT NULL DEFAULT 'vless',
  link       TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  category   TEXT DEFAULT '',
  featured   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_servers_enabled ON servers (enabled);

CREATE TABLE IF NOT EXISTS vip_settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vip_configs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  country    TEXT DEFAULT '',
  protocol   TEXT DEFAULT 'vless',
  link       TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  category   TEXT DEFAULT '',
  featured   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vip_orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL,
  status        TEXT NOT NULL,
  receipt       TEXT DEFAULT '',
  reject_reason TEXT DEFAULT '',
  assigned      TEXT DEFAULT '',
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vip_orders_code ON vip_orders (code);

CREATE TABLE IF NOT EXISTS site_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  caption    TEXT DEFAULT '',
  image      TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- اگر جدول از قبل بدون ستون دسته ساخته شده:
-- ALTER TABLE servers ADD COLUMN category TEXT DEFAULT '';
