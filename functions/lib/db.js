// دسترسی به D1 + ساخت خودکار جدول
const CREATE_TABLE =
  "CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT DEFAULT '', protocol TEXT NOT NULL DEFAULT 'vless', link TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, category TEXT DEFAULT '', featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))";

export function getDB(env) {
  return (env && (env.VPO || env.vpo)) || null;
}

export async function readyDB(env) {
  const db = getDB(env);
  if (!db) return null;
  try {
    await db.exec(CREATE_TABLE);
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE servers ADD COLUMN category TEXT DEFAULT ''");
  } catch (e) {}
  try {
    await db.exec('ALTER TABLE servers ADD COLUMN featured INTEGER NOT NULL DEFAULT 0');
  } catch (e) {}
  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_servers_enabled ON servers (enabled)');
  } catch (e) {}
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
