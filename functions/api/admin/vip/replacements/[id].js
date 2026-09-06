import { readyDB, noDb, dbError } from '../../../../lib/db.js';
import { verify, deny } from '../../../../lib/auth.js';
import { parseAssigned, withSlots, supportUntilOf } from '../../../../lib/vip.js';

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
  const action = String(body.action || 'fulfill');
  const now = Math.floor(Date.now() / 1000);
  try {
    const rep = await db.prepare('SELECT * FROM vip_replacements WHERE id = ?').bind(id).first();
    if (!rep) return Response.json({ ok: false, error: 'درخواست پیدا نشد' }, { status: 404 });
    if (rep.status !== 'pending') {
      return Response.json({ ok: false, error: 'این درخواست دیگر باز نیست' }, { status: 400 });
    }
    const row = await db.prepare('SELECT * FROM vip_orders WHERE id = ?').bind(rep.order_id).first();
    if (!row) return Response.json({ ok: false, error: 'سفارش پیدا نشد' }, { status: 404 });

    if (action === 'reject') {
      await db.prepare("UPDATE vip_replacements SET status = 'rejected', done_at = ? WHERE id = ?").bind(now, id).run();
      return Response.json({ ok: true });
    }

    const until = supportUntilOf(row);
    if (!until || until <= now) {
      return Response.json({ ok: false, error: 'مدت پشتیبانی این سفارش تمام شده.' }, { status: 403 });
    }

    const configId = parseInt(body.configId, 10);
    if (!configId) return Response.json({ ok: false, error: 'کانفیگ جایگزین را انتخاب کن' }, { status: 400 });
    const cfg = await db
      .prepare('SELECT id, name, country, protocol, link, category, featured FROM vip_configs WHERE id = ?')
      .bind(configId)
      .first();
    if (!cfg) return Response.json({ ok: false, error: 'کانفیگ پیدا نشد' }, { status: 404 });

    const assigned = withSlots(parseAssigned(row.assigned));
    let idx = assigned.findIndex((c) => String(c.slot) === String(rep.slot));
    if (idx < 0) idx = assigned.findIndex((c) => c.link === rep.old_link);
    if (idx < 0) return Response.json({ ok: false, error: 'سرور قبلی در لیست این سفارش نیست' }, { status: 404 });

    if (assigned.some((c, i) => i !== idx && c.link === cfg.link)) {
      return Response.json({ ok: false, error: 'این لینک همین حالا در لیست این کاربر هست' }, { status: 400 });
    }

    assigned[idx] = {
      name: cfg.name,
      country: cfg.country || '',
      protocol: cfg.protocol || 'vless',
      link: cfg.link,
      category: cfg.category || '',
      featured: cfg.featured ? 1 : 0,
      slot: assigned[idx].slot,
    };

    await db
      .prepare('UPDATE vip_orders SET assigned = ?, replace_used = COALESCE(replace_used, 0) + 1 WHERE id = ?')
      .bind(JSON.stringify(assigned), row.id)
      .run();
    await db
      .prepare("UPDATE vip_replacements SET status = 'done', new_name = ?, new_link = ?, done_at = ? WHERE id = ?")
      .bind(cfg.name || '', cfg.link, now, id)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
