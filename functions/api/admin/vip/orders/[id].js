import { readyDB, noDb, dbError } from '../../../../lib/db.js';
import { verify, deny } from '../../../../lib/auth.js';
import { PLANS } from '../../../../lib/vip.js';

export async function onRequestGet({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const row = await db.prepare('SELECT * FROM vip_orders WHERE id = ?').bind(parseInt(params.id, 10)).first();
    if (!row) return Response.json({ ok: false, error: 'سفارش پیدا نشد' }, { status: 404 });
    return Response.json({ ok: true, order: row });
  } catch (e) {
    return dbError(e);
  }
}

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
  const action = String(body.action || '');
  try {
    const row = await db.prepare('SELECT * FROM vip_orders WHERE id = ?').bind(id).first();
    if (!row) return Response.json({ ok: false, error: 'سفارش پیدا نشد' }, { status: 404 });

    if (action === 'reject') {
      await db
        .prepare("UPDATE vip_orders SET status = 'rejected', reject_reason = ? WHERE id = ?")
        .bind(String(body.reason || 'سفارش رد شد'), id)
        .run();
      return Response.json({ ok: true });
    }

    if (action === 'approve') {
      if (row.status !== 'pending') {
        return Response.json({ ok: false, error: 'فقط سفارش در انتظار را می‌توان تأیید کرد' }, { status: 400 });
      }
      await db.prepare("UPDATE vip_orders SET status = 'in_progress' WHERE id = ?").bind(id).run();
      return Response.json({ ok: true });
    }

    if (action === 'complete') {
      if (row.status !== 'in_progress') {
        return Response.json({ ok: false, error: 'اول باید فیش تأیید شود' }, { status: 400 });
      }
      const plan = PLANS[row.plan] || PLANS.bronze;
      const ids = Array.isArray(body.configIds) ? body.configIds.map(Number).filter(Boolean) : [];
      if (!ids.length) return Response.json({ ok: false, error: 'حداقل یک کانفیگ انتخاب کن' }, { status: 400 });
      if (ids.length > plan.configs) {
        return Response.json({ ok: false, error: 'برای این پلن حداکثر ' + plan.configs + ' کانفیگ' }, { status: 400 });
      }
      const { results } = await db
        .prepare('SELECT id, name, country, protocol, link, category, featured FROM vip_configs')
        .all();
      const map = {};
      (results || []).forEach((c) => {
        map[c.id] = {
          name: c.name,
          country: c.country || '',
          protocol: c.protocol || 'vless',
          link: c.link,
          category: c.category || '',
          featured: c.featured ? 1 : 0,
        };
      });
      const assigned = ids.map((i) => map[i]).filter(Boolean);
      if (assigned.length !== ids.length) {
        return Response.json({ ok: false, error: 'بعضی کانفیگ‌ها پیدا نشد' }, { status: 400 });
      }
      await db
        .prepare("UPDATE vip_orders SET status = 'done', assigned = ? WHERE id = ?")
        .bind(JSON.stringify(assigned), id)
        .run();
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'عملیات نامعتبر' }, { status: 400 });
  } catch (e) {
    return dbError(e);
  }
}
