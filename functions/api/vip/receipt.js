import { readyDB, noDb, dbError } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const code = String(body.code || '').trim();
  const image = String(body.image || '');
  if (!code || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
    return Response.json({ ok: false, error: 'کد و عکس فیش (jpg/png) لازم است' }, { status: 400 });
  }
  if (image.length > 900000) {
    return Response.json({ ok: false, error: 'حجم عکس زیاد است؛ عکس کوچک‌تری بفرست' }, { status: 400 });
  }
  try {
    const row = await db.prepare('SELECT status, expires_at FROM vip_orders WHERE code = ?').bind(code).first();
    if (!row) return Response.json({ ok: false, error: 'سفارش پیدا نشد' }, { status: 404 });
    const now = Math.floor(Date.now() / 1000);
    if (row.status !== 'awaiting_receipt') {
      return Response.json({ ok: false, error: 'برای این سفارش دیگر نمی‌توان فیش فرستاد' }, { status: 400 });
    }
    if (row.expires_at < now) {
      await db.prepare("UPDATE vip_orders SET status = 'expired' WHERE code = ?").bind(code).run();
      return Response.json({ ok: false, error: 'زمان ارسال فیش تمام شده' }, { status: 400 });
    }
    await db
      .prepare("UPDATE vip_orders SET receipt = ?, status = 'pending' WHERE code = ?")
      .bind(image, code)
      .run();
    return Response.json({ ok: true, status: 'pending' });
  } catch (e) {
    return dbError(e);
  }
}
