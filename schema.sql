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

-- اگر جدول از قبل بدون ستون دسته ساخته شده:
-- ALTER TABLE servers ADD COLUMN category TEXT DEFAULT '';
