import { readyDB, noDb, dbError } from '../../lib/db.js';
import { validVisitor, clip, hoursInfo } from '../../lib/support.js';

export async function onRequestPost({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const visitorId = String(body.visitorId || '').trim();
  const fromId = parseInt(body.threadId, 10);
  if (!validVisitor(visitorId) || !fromId) {
    return Response.json({ ok: false, error: 'پارامتر ناقص' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    const src = await db
      .prepare('SELECT * FROM support_threads WHERE id = ? AND visitor_id = ?')
      .bind(fromId, visitorId)
      .first();
    if (!src) return Response.json({ ok: false, error: 'گفتگو پیدا نشد' }, { status: 404 });

    let dest = await db
      .prepare(
        "SELECT * FROM support_threads WHERE visitor_id = ? AND channel = 'admin' AND status = 'open' ORDER BY id DESC"
      )
      .bind(visitorId)
      .first();
    if (!dest) {
      const info = await db
        .prepare(
          'INSERT INTO support_threads (visitor_id, vip_code, channel, status, last_at, last_preview, unread_admin, unread_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(visitorId, src.vip_code || '', 'admin', 'open', now, 'انتقال از هوش مصنوعی', 1, 0, now)
        .run();
      dest = { id: info.meta.last_row_id };
    }
    const note = 'کاربر خواست به ادمین وصل شود (از چت هوش مصنوعی).';
    await db
      .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(dest.id, 'ai', note, '', now)
      .run();
    const { results } = await db
      .prepare('SELECT sender, body FROM support_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 6')
      .bind(fromId)
      .all();
    const hist = (results || []).reverse();
    for (const m of hist) {
      if (!m.body) continue;
      await db
        .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(dest.id, m.sender, '[AI] ' + String(m.body).slice(0, 500), '', now)
        .run();
    }
    await db
      .prepare(
        'UPDATE support_threads SET last_at = ?, last_preview = ?, unread_admin = unread_admin + 1, status = ? WHERE id = ?'
      )
      .bind(now, clip(note, 80), 'open', dest.id)
      .run();
    return Response.json({ ok: true, threadId: dest.id, hours: hoursInfo() });
  } catch (e) {
    return dbError(e);
  }
}
