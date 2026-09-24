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
  tags       TEXT DEFAULT '',
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
  expires_at    INTEGER NOT NULL,
  support_until INTEGER DEFAULT 0,
  replace_used  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vip_orders_code ON vip_orders (code);

CREATE TABLE IF NOT EXISTS site_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  caption    TEXT DEFAULT '',
  image      TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_threads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id    TEXT NOT NULL,
  vip_code      TEXT DEFAULT '',
  channel       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  last_at       INTEGER NOT NULL DEFAULT 0,
  last_preview  TEXT DEFAULT '',
  unread_admin  INTEGER NOT NULL DEFAULT 0,
  unread_user   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL,
  sender     TEXT NOT NULL,
  body       TEXT DEFAULT '',
  image      TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_vis ON support_threads (visitor_id, channel);
CREATE INDEX IF NOT EXISTS idx_support_msg ON support_messages (thread_id, id);

CREATE TABLE IF NOT EXISTS app_file_chunks (
  i    INTEGER PRIMARY KEY,
  data TEXT NOT NULL
);

-- اگر جدول از قبل بدون ستون دسته ساخته شده:
-- ALTER TABLE servers ADD COLUMN category TEXT DEFAULT '';
-- ALTER TABLE servers ADD COLUMN tags TEXT DEFAULT '';
