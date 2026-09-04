// GET /api/servers — لیست سرورهای فعال برای کاربران
import { readyDB, noDb, dbError } from '../lib/db.js';

export async function onRequestGet({ env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db
      .prepare(
        'SELECT id, name, country, protocol, link, category FROM servers WHERE enabled = 1 ORDER BY id DESC'
      )
      .all();
    return Response.json({ ok: true, servers: results });
  } catch (e) {
    return dbError(e);
  }
}
