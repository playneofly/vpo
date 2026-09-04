import { readyDB, noDb, dbError } from '../../../../lib/db.js';
import { verify, deny } from '../../../../lib/auth.js';

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
  try {
    if (body.toggle) {
      await db.prepare('UPDATE vip_configs SET enabled = 1 - enabled WHERE id = ?').bind(id).run();
      return Response.json({ ok: true });
    }
    if (body.toggleFeatured) {
      await db
        .prepare('UPDATE vip_configs SET featured = CASE WHEN featured = 1 THEN 0 ELSE 1 END WHERE id = ?')
        .bind(id)
        .run();
      return Response.json({ ok: true });
    }
    const name = String(body.name || '').trim();
    const link = String(body.link || '').trim();
    if (!name || !link) {
      return Response.json({ ok: false, error: 'نام و لینک کانفیگ الزامی است' }, { status: 400 });
    }
    await db
      .prepare(
        'UPDATE vip_configs SET name = ?, country = ?, protocol = ?, link = ?, enabled = ?, category = ?, featured = ? WHERE id = ?'
      )
      .bind(
        name,
        String(body.country || ''),
        String(body.protocol || 'vless'),
        link,
        body.enabled === false ? 0 : 1,
        String(body.category || '').trim(),
        body.featured ? 1 : 0,
        id
      )
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    await db.prepare('DELETE FROM vip_configs WHERE id = ?').bind(parseInt(params.id, 10)).run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
