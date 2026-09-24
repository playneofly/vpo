import { readyDB, noDb, dbError } from '../../lib/db.js';
import { verify, deny } from '../../lib/auth.js';
import { getSetting, setSetting } from '../../lib/vip.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const text = await getSetting(db, 'footer_text', '');
    const announce = String(await getSetting(db, 'announce_text', '')).trim();
    const { results } = await db
      .prepare('SELECT id, caption, sort FROM site_photos ORDER BY sort ASC, id ASC')
      .all();
    return Response.json({ ok: true, text, announce, photos: results || [] });
  } catch (e) {
    return dbError(e);
  }
}

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
  try {
    if (body.text != null) await setSetting(db, 'footer_text', String(body.text));
    if (body.announce != null) {
      await setSetting(db, 'announce_text', String(body.announce).trim().slice(0, 240));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
