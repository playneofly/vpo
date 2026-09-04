import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db
      .prepare(
        "SELECT id, code, plan, status, reject_reason, assigned, created_at, expires_at, CASE WHEN receipt IS NOT NULL AND receipt != '' THEN 1 ELSE 0 END AS has_receipt FROM vip_orders ORDER BY id DESC"
      )
      .all();
    return Response.json({ ok: true, orders: results || [] });
  } catch (e) {
    return dbError(e);
  }
}
