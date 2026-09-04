-- اسکیمای دیتابیس vpo (Cloudflare D1)
-- اجرا با: wrangler d1 execute vpo --file=schema.sql

CREATE TABLE IF NOT EXISTS servers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  country    TEXT DEFAULT '',          -- کد ۲ حرفی مثل DE یا ایموجی پرچم 🇩🇪
  protocol   TEXT NOT NULL DEFAULT 'vless',  -- vless | vmess | trojan | ss | ssr | hysteria2 | tuic
  link       TEXT NOT NULL,            -- لینک کامل کانفیگ مثل vless://...
  enabled    INTEGER NOT NULL DEFAULT 1,     -- 1 = فعال | 0 = غیرفعال
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_servers_enabled ON servers (enabled);
