// GET/POST /api/admin/servers — لیست کامل + افزودن + دسته‌ای + خاموش‌کردن دسته
import { readyDB, noDb, dbError } from '../../lib/db.js';
import { getSetting, setSetting, parseTags, dumpTags, parseCategoryTags } from '../../lib/vip.js';

async function verify(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)vpo_admin=([^;]+)/);
  if (!m) return false;
  const token = m[1];
  const [payload, hex] = token.split('.');
  if (!payload || !hex) return false;
  const exp = parseInt(payload, 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const secret = env.ADMIN_PASSWORD;
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sig = new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode('vpo:' + payload));
}

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    let results;
    try {
      const q = await db.prepare('SELECT * FROM servers ORDER BY featured DESC, id DESC').all();
      results = q.results;
    } catch (e1) {
      const q = await db
        .prepare(
          'SELECT id, name, country, protocol, link, enabled, category, featured FROM servers ORDER BY id DESC'
        )
        .all();
      results = q.results;
    }
    const servers = (results || []).map((s) => Object.assign({}, s, { tags: parseTags(s.tags) }));
    const categoryTags = parseCategoryTags(await getSetting(db, 'category_tags', ''));
    return Response.json({ ok: true, servers, categoryTags });
  } catch (e) {
    return dbError(e);
  }
}

function rowFrom(body) {
  const name = String(body.name || '').trim();
  const link = String(body.link || '').trim();
  const country = String(body.country || '').trim();
  const protocol = String(body.protocol || 'vless').trim();
  const category = String(body.category || '').trim();
  const enabled = body.enabled === false ? 0 : 1;
  const featured = body.featured ? 1 : 0;
  const tags = dumpTags(body.tags);
  return { name, link, country, protocol, category, enabled, featured, tags };
}

export async function onRequestPost({ request, env }) {
  if (!(await verify(request, env))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = await readyDB(env);
  if (!db) return noDb();

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  if (body.categoryTags != null) {
    try {
      await setSetting(db, 'category_tags', JSON.stringify(parseCategoryTags(body.categoryTags)));
      return Response.json({ ok: true });
    } catch (e) {
      return dbError(e);
    }
  }

  if (body.disableCategory != null) {
    const cat = String(body.disableCategory || '').trim();
    if (!cat) {
      return Response.json({ ok: false, error: 'دسته خالی است' }, { status: 400 });
    }
    try {
      await db.prepare('UPDATE servers SET enabled = 0 WHERE category = ?').bind(cat).run();
      return Response.json({ ok: true });
    } catch (e) {
      return dbError(e);
    }
  }

  const insertSql =
    'INSERT INTO servers (name, country, protocol, link, enabled, category, featured, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

  async function onlyFeatured(id) {
    if (!id) return;
    await db.prepare('UPDATE servers SET featured = 0').run();
    await db.prepare('UPDATE servers SET featured = 1 WHERE id = ?').bind(id).run();
  }

  if (Array.isArray(body.bulk)) {
    const items = body.bulk.slice(0, 80).map(rowFrom).filter((r) => r.name && r.link);
    if (!items.length) {
      return Response.json({ ok: false, error: 'هیچ لینک معتبری پیدا نشد' }, { status: 400 });
    }
    try {
      const ids = [];
      for (let i = items.length - 1; i >= 0; i--) {
        const r = items[i];
        const info = await db
          .prepare(insertSql)
          .bind(r.name, r.country, r.protocol, r.link, r.enabled, r.category, r.featured, r.tags)
          .run();
        ids.unshift(info.meta.last_row_id);
        if (r.featured) await onlyFeatured(info.meta.last_row_id);
      }
      return Response.json({ ok: true, ids });
    } catch (e) {
      return dbError(e);
    }
  }

  const r = rowFrom(body);
  if (!r.name || !r.link) {
    return Response.json({ ok: false, error: 'نام و لینک کانفیگ الزامی است' }, { status: 400 });
  }

  try {
    const info = await db
      .prepare(insertSql)
      .bind(r.name, r.country, r.protocol, r.link, r.enabled, r.category, r.featured, r.tags)
      .run();
    if (r.featured) await onlyFeatured(info.meta.last_row_id);
    return Response.json({ ok: true, id: info.meta.last_row_id });
  } catch (e) {
    return dbError(e);
  }
}
