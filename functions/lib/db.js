// دسترسی به D1 + ساخت خودکار جدول
const CREATE_TABLE =
  "CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT DEFAULT '', protocol TEXT NOT NULL DEFAULT 'vless', link TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, category TEXT DEFAULT '', featured INTEGER NOT NULL DEFAULT 0, tags TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))";

export function getDB(env) {
  return (env && (env.VPO || env.vpo)) || null;
}

let bootPromise = null;

async function migrate(db) {
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

  const vipSql = [
    'CREATE TABLE IF NOT EXISTS vip_settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
    "CREATE TABLE IF NOT EXISTS vip_configs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT DEFAULT '', protocol TEXT DEFAULT 'vless', link TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, category TEXT DEFAULT '', featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
    "CREATE TABLE IF NOT EXISTS vip_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, plan TEXT NOT NULL, status TEXT NOT NULL, receipt TEXT DEFAULT '', reject_reason TEXT DEFAULT '', assigned TEXT DEFAULT '', created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
    'CREATE INDEX IF NOT EXISTS idx_vip_orders_code ON vip_orders (code)',
    "CREATE TABLE IF NOT EXISTS site_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, caption TEXT DEFAULT '', image TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))",
    "CREATE TABLE IF NOT EXISTS support_threads (id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_id TEXT NOT NULL, vip_code TEXT DEFAULT '', channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', last_at INTEGER NOT NULL DEFAULT 0, last_preview TEXT DEFAULT '', unread_admin INTEGER NOT NULL DEFAULT 0, unread_user INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS support_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL, sender TEXT NOT NULL, body TEXT DEFAULT '', image TEXT DEFAULT '', created_at INTEGER NOT NULL)",
    'CREATE INDEX IF NOT EXISTS idx_support_vis ON support_threads (visitor_id, channel)',
    'CREATE INDEX IF NOT EXISTS idx_support_msg ON support_messages (thread_id, id)',
    "CREATE TABLE IF NOT EXISTS vip_replacements (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, code TEXT NOT NULL, plan TEXT NOT NULL, slot TEXT NOT NULL, old_name TEXT DEFAULT '', old_link TEXT NOT NULL, old_country TEXT DEFAULT '', old_protocol TEXT DEFAULT '', old_category TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', new_name TEXT DEFAULT '', new_link TEXT DEFAULT '', created_at INTEGER NOT NULL, done_at INTEGER NOT NULL DEFAULT 0)",
    'CREATE INDEX IF NOT EXISTS idx_vip_rep_code ON vip_replacements (code, status)',
  ];
  for (const sql of vipSql) {
    try {
      await db.exec(sql);
    } catch (e) {}
  }
  const alters = [
    "ALTER TABLE vip_configs ADD COLUMN country TEXT DEFAULT ''",
    "ALTER TABLE vip_configs ADD COLUMN protocol TEXT DEFAULT 'vless'",
    "ALTER TABLE vip_configs ADD COLUMN category TEXT DEFAULT ''",
    'ALTER TABLE vip_configs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE vip_configs ADD COLUMN featured INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE vip_orders ADD COLUMN support_until INTEGER DEFAULT 0',
    'ALTER TABLE vip_orders ADD COLUMN replace_used INTEGER DEFAULT 0',
    "ALTER TABLE servers ADD COLUMN tags TEXT DEFAULT ''",
  ];
  for (const sql of alters) {
    try {
      await db.exec(sql);
    } catch (e) {}
  }
}

export async function readyDB(env) {
  const db = getDB(env);
  if (!db) return null;
  if (!bootPromise) {
    bootPromise = migrate(db).then(
      function () {
        return db;
      },
      function () {
        bootPromise = null;
        return db;
      }
    );
  }
  await bootPromise;
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
