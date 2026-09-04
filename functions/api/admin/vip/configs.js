import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';

function rowFrom(body) {
  const name = String(body.name || '').trim();
  const link = String(body.link || '').trim();
  const country = String(body.country || '').trim();
  const protocol = String(body.protocol || 'vless').trim();
  const category = String(body.category || '').trim();
  const enabled = body.enabled === false ? 0 : 1;
  const featured = body.featured ? 1 : 0;
  return { name, link, country, protocol, category, enabled, featured };
}

const INSERT =
  'INSERT INTO vip_configs (name, country, protocol, link, enabled, category, featured) VALUES (?, ?, ?, ?, ?, ?, ?)';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db.prepare('SELECT * FROM vip_configs ORDER BY featured DESC, id DESC').all();
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

  if (body.disableCategory != null) {
    const cat = String(body.disableCategory || '').trim();
    if (!cat) return Response.json({ ok: false, error: 'دسته خالی است' }, { status: 400 });
    try {
      await db.prepare('UPDATE vip_configs SET enabled = 0 WHERE category = ?').bind(cat).run();
      return Response.json({ ok: true });
    } catch (e) {
      return dbError(e);
    }
  }

  if (Array.isArray(body.bulk)) {
    const items = body.bulk.slice(0, 80).map(rowFrom).filter((r) => r.name && r.link);
    if (!items.length) return Response.json({ ok: false, error: 'هیچ لینک معتبری پیدا نشد' }, { status: 400 });
    try {
      const ids = [];
      for (let i = items.length - 1; i >= 0; i--) {
        const r = items[i];
        const info = await db
          .prepare(INSERT)
          .bind(r.name, r.country, r.protocol, r.link, r.enabled, r.category, r.featured)
          .run();
        ids.unshift(info.meta.last_row_id);
      }
      return Response.json({ ok: true, ids });
    } catch (e) {
      return dbError(e);
    }
  }

  const r = rowFrom(body);
  if (!r.name || !r.link) {
    return Response.json({ ok: false, error: 'نام و لینک لازم است' }, { status: 400 });
  }
  try {
    const info = await db
      .prepare(INSERT)
      .bind(r.name, r.country, r.protocol, r.link, r.enabled, r.category, r.featured)
      .run();
    return Response.json({ ok: true, id: info.meta.last_row_id });
  } catch (e) {
    return dbError(e);
  }
}
