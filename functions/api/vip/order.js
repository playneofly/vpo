import { readyDB, noDb, dbError } from '../../lib/db.js';
import { PLANS, newCode, getSetting, parseAssigned, withSlots, supportUntilOf, replaceCapOf } from '../../lib/vip.js';

export async function onRequestPost({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  if ((await getSetting(db, 'vip_enabled', '0')) !== '1') {
    return Response.json({ ok: false, error: 'خرید فعلاً غیرفعال است' }, { status: 403 });
  }
  const plan = PLANS[body.plan];
  if (!plan) return Response.json({ ok: false, error: 'پلن نامعتبر است' }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  let code = newCode();
  for (let i = 0; i < 5; i++) {
    const exists = await db.prepare('SELECT id FROM vip_orders WHERE code = ?').bind(code).first();
    if (!exists) break;
    code = newCode();
  }
  try {
    await db
      .prepare(
        'INSERT INTO vip_orders (code, plan, status, receipt, reject_reason, assigned, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(code, plan.id, 'awaiting_receipt', '', '', '', now, now + 3600)
      .run();
    return Response.json({ ok: true, code, plan: plan.id, expiresAt: now + 3600 });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestGet({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  const code = new URL(request.url).searchParams.get('code') || '';
  if (!code) return Response.json({ ok: false, error: 'کد لازم است' }, { status: 400 });
  try {
    const row = await db.prepare('SELECT * FROM vip_orders WHERE code = ?').bind(code.trim()).first();
    if (!row) return Response.json({ ok: false, error: 'سفارش پیدا نشد' }, { status: 404 });
    const now = Math.floor(Date.now() / 1000);
    if (row.status === 'awaiting_receipt' && row.expires_at < now) {
      await db.prepare("UPDATE vip_orders SET status = 'expired' WHERE code = ?").bind(row.code).run();
      row.status = 'expired';
    }
    const configs = row.status === 'done' ? withSlots(parseAssigned(row.assigned)) : [];
    let pendingSlots = [];
    if (row.status === 'done') {
      try {
        const { results } = await db
          .prepare("SELECT slot FROM vip_replacements WHERE code = ? AND status = 'pending'")
          .bind(row.code)
          .all();
        pendingSlots = (results || []).map((r) => String(r.slot));
      } catch (e) {}
    }
    const supportUntil = supportUntilOf(row);
    return Response.json({
      ok: true,
      code: row.code,
      plan: row.plan,
      status: row.status,
      rejectReason: row.reject_reason || '',
      expiresAt: row.expires_at,
      supportUntil,
      supportLeft: Math.max(0, supportUntil - now),
      replaceUsed: Number(row.replace_used) || 0,
      replaceMax: replaceCapOf(row.plan),
      pendingSlots,
      configs,
      links: configs.map((c) => c.link),
    });
  } catch (e) {
    return dbError(e);
  }
}
