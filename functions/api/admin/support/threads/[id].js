import { readyDB, noDb, dbError } from '../../../../lib/db.js';
import { verify, deny } from '../../../../lib/auth.js';
import { clip } from '../../../../lib/support.js';

export async function onRequestGet({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  const id = parseInt(params.id, 10);
  try {
    const th = await db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(id).first();
    if (!th) return Response.json({ ok: false, error: 'گفتگو پیدا نشد' }, { status: 404 });
    const { results } = await db
      .prepare(
        'SELECT id, sender, body, created_at FROM support_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 80'
      )
      .bind(id)
      .all();
    if (results) results.reverse();
    await db.prepare('UPDATE support_threads SET unread_admin = 0 WHERE id = ?').bind(id).run();
    return Response.json({ ok: true, thread: th, messages: results || [] });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  const id = parseInt(params.id, 10);
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const action = String(body.action || 'reply');
  const now = Math.floor(Date.now() / 1000);
  try {
    const th = await db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(id).first();
    if (!th) return Response.json({ ok: false, error: 'گفتگو پیدا نشد' }, { status: 404 });

    if (action === 'close') {
      await db.prepare("UPDATE support_threads SET status = 'closed' WHERE id = ?").bind(id).run();
      return Response.json({ ok: true });
    }
    if (action === 'open') {
      await db.prepare("UPDATE support_threads SET status = 'open' WHERE id = ?").bind(id).run();
      return Response.json({ ok: true });
    }

    const text = String(body.body || '').trim().slice(0, 2000);
    const image = String(body.image || '');
    const hasImg = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image) && image.length < 700000;
    if (!text && !hasImg) {
      return Response.json({ ok: false, error: 'متن یا عکس لازم است' }, { status: 400 });
    }
    const img = hasImg ? image : '';
    await db
      .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, 'admin', text, img, now)
      .run();
    await db
      .prepare(
        "UPDATE support_threads SET last_at = ?, last_preview = ?, unread_user = unread_user + 1, unread_admin = 0, status = 'open' WHERE id = ?"
      )
      .bind(now, clip(text || '📷 عکس', 80), id)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
