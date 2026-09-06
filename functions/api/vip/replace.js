import { readyDB, noDb, dbError } from '../../lib/db.js';
import { parseAssigned, withSlots, supportUntilOf, replaceCapOf } from '../../lib/vip.js';

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
  const slot = String(body.slot || '').trim();
  if (!code || !slot) {
    return Response.json({ ok: false, error: 'کد و سرور لازم است' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await db.prepare('SELECT * FROM vip_orders WHERE code = ?').bind(code).first();
    if (!row || row.status !== 'done') {
      return Response.json({ ok: false, error: 'سفارش پیدا نشد' }, { status: 404 });
    }
    const until = supportUntilOf(row);
    if (!until || until <= now) {
      return Response.json({ ok: false, error: 'مدت پشتیبانی این سفارش تمام شده.' }, { status: 403 });
    }
    const assigned = withSlots(parseAssigned(row.assigned));
    const cur = assigned.find((c) => String(c.slot) === slot);
    if (!cur) return Response.json({ ok: false, error: 'این سرور در سفارشت نیست' }, { status: 404 });

    const pending = await db
      .prepare("SELECT id FROM vip_replacements WHERE code = ? AND slot = ? AND status = 'pending'")
      .bind(code, slot)
      .first();
    if (pending) {
      return Response.json({ ok: false, error: 'برای این سرور همین حالا درخواست باز داری.' }, { status: 409 });
    }

    const cap = replaceCapOf(row.plan);
    const used = Number(row.replace_used) || 0;
    const pendN = await db
      .prepare("SELECT COUNT(*) AS n FROM vip_replacements WHERE code = ? AND status = 'pending'")
      .bind(code)
      .first();
    if (used + (pendN && pendN.n ? pendN.n : 0) >= cap) {
      return Response.json({ ok: false, error: 'سقف جایگزینی این پلن تمام شد.' }, { status: 403 });
    }

    await db
      .prepare(
        'INSERT INTO vip_replacements (order_id, code, plan, slot, old_name, old_link, old_country, old_protocol, old_category, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        row.id,
        code,
        row.plan,
        slot,
        cur.name || '',
        cur.link,
        cur.country || '',
        cur.protocol || '',
        cur.category || '',
        'pending',
        now
      )
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
