import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';
import { hoursInfo, cannedList, supportName } from '../../../lib/support.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db
      .prepare(
        'SELECT id, visitor_id, vip_code, channel, status, last_at, last_preview, unread_admin, created_at FROM support_threads ORDER BY unread_admin DESC, last_at DESC LIMIT 200'
      )
      .all();
    const unread = (results || []).reduce((n, t) => n + (t.unread_admin || 0), 0);
    return Response.json({
      ok: true,
      threads: results || [],
      unread,
      hours: hoursInfo(),
      canned: await cannedList(db),
      supportName: await supportName(db),
    });
  } catch (e) {
    return dbError(e);
  }
}
