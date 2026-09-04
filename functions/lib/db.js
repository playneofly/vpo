// دسترسی به D1 + ساخت خودکار جدول
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT DEFAULT '', protocol TEXT NOT NULL DEFAULT 'vless', link TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
  "CREATE INDEX IF NOT EXISTS idx_servers_enabled ON servers (enabled)",
].join(';');

export function getDB(env) {
  return (env && (env.VPO || env.vpo)) || null;
}

export async function readyDB(env) {
  const db = getDB(env);
  if (!db) return null;
  try {
    await db.exec(SCHEMA);
  } catch (e) {
    // اگر جدول از قبل باشد مشکلی نیست
  }
  return db;
}

export function noDb() {
  return Response.json(
    {
      ok: false,
      error:
        'دیتابیس وصل نیست. در پروژه Pages برو Settings → Bindings → Add → D1 database — Variable name را دقیقاً VPO بگذار و Database را vpo انتخاب کن. بعد Deployments → Retry deployment.',
    },
    { status: 500 }
  );
}

export function dbError(e) {
  const msg = String(e && e.message ? e.message : e);
  if (/no such table/i.test(msg)) {
    return Response.json(
      { ok: false, error: 'جدول سرورها ساخته نشده. schema.sql را در Console دیتابیس vpo اجرا کن.' },
      { status: 500 }
    );
  }
  return Response.json({ ok: false, error: msg }, { status: 500 });
}
