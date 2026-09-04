import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db.prepare('SELECT * FROM vip_configs ORDER BY id DESC').all();
    return Response.json({ ok: true, configs: results || [] });
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
  const name = String(body.name || '').trim();
  const link = String(body.link || '').trim();
  if (!name || !link) {
    return Response.json({ ok: false, error: 'نام و لینک لازم است' }, { status: 400 });
  }
  try {
    const info = await db.prepare('INSERT INTO vip_configs (name, link) VALUES (?, ?)').bind(name, link).run();
    return Response.json({ ok: true, id: info.meta.last_row_id });
  } catch (e) {
    return dbError(e);
  }
}
