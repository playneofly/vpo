import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';

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
  const image = String(body.image || '');
  const caption = String(body.caption || '').trim();
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
    return Response.json({ ok: false, error: 'عکس jpg/png لازم است' }, { status: 400 });
  }
  if (image.length > 900000) {
    return Response.json({ ok: false, error: 'حجم عکس زیاد است؛ کمی کوچک‌ترش کن' }, { status: 400 });
  }
  try {
    const countRow = await db.prepare('SELECT COUNT(*) AS n FROM site_photos').first();
    if (countRow && countRow.n >= 12) {
      return Response.json({ ok: false, error: 'حداکثر ۱۲ عکس' }, { status: 400 });
    }
    const sort = countRow ? Number(countRow.n) || 0 : 0;
    const info = await db
      .prepare('INSERT INTO site_photos (caption, image, sort) VALUES (?, ?, ?)')
      .bind(caption, image, sort)
      .run();
    return Response.json({ ok: true, id: info.meta.last_row_id });
  } catch (e) {
    return dbError(e);
  }
}
