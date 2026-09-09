import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';
import { clip } from '../../../lib/support.js';

export async function onRequestPost({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const text = String(body.body || '').trim().slice(0, 500);
  if (!text) {
    return Response.json({ ok: false, error: 'متن لازم است' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const preview = clip(text, 80);
  try {
    const { results } = await db
      .prepare("SELECT id FROM support_threads WHERE status = 'open' ORDER BY last_at DESC LIMIT 300")
      .all();
    const ids = (results || []).map((r) => r.id).filter(Boolean);
    if (!ids.length) {
      return Response.json({ ok: true, sent: 0 });
    }
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      const stmts = [];
      chunk.forEach((id) => {
        stmts.push(
          db
            .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
            .bind(id, 'admin', text, '', now)
        );
        stmts.push(
          db
            .prepare(
              'UPDATE support_threads SET last_at = ?, last_preview = ?, unread_user = unread_user + 1 WHERE id = ?'
            )
            .bind(now, preview, id)
        );
      });
      await db.batch(stmts);
    }
    return Response.json({ ok: true, sent: ids.length });
  } catch (e) {
    return dbError(e);
  }
}
