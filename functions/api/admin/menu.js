import { readyDB, noDb, dbError } from '../../lib/db.js';
import { verify, deny } from '../../lib/auth.js';
import { listMenu, ensureMenu } from '../../lib/menu.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const items = await listMenu(db);
    return Response.json({ ok: true, items });
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
  const title = String(body.title || '').trim().slice(0, 80);
  const section = String(body.section || '').trim().slice(0, 40);
  const text = String(body.body || '').trim().slice(0, 8000);
  if (!title) return Response.json({ ok: false, error: 'اسم لازم است' }, { status: 400 });
  try {
    await ensureMenu(db);
    const last = await db.prepare('SELECT MAX(sort) AS n FROM site_menu').first();
    const sort = (Number(last && last.n) || 0) + 1;
    const now = Math.floor(Date.now() / 1000);
    const info = await db
      .prepare('INSERT INTO site_menu (section, title, body, sort, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(section, title, text, sort, now)
      .run();
    return Response.json({ ok: true, id: info.meta.last_row_id });
  } catch (e) {
    return dbError(e);
  }
}
