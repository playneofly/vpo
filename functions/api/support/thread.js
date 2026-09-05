import { readyDB, noDb, dbError } from '../../lib/db.js';
import { validVisitor, hoursInfo, supportName, getAI } from '../../lib/support.js';

export async function onRequestPost({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  const visitorId = String(body.visitorId || '').trim();
  const channel = 'ai';
  const vipCode = String(body.vipCode || '').trim().slice(0, 32);
  if (!validVisitor(visitorId)) {
    return Response.json({ ok: false, error: 'شناسه نامعتبر' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    let row = await db
      .prepare(
        "SELECT * FROM support_threads WHERE visitor_id = ? AND channel = ? AND status = 'open' ORDER BY id DESC"
      )
      .bind(visitorId, channel)
      .first();
    if (!row) {
      const info = await db
        .prepare(
          'INSERT INTO support_threads (visitor_id, vip_code, channel, status, last_at, last_preview, unread_admin, unread_user, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(visitorId, vipCode, channel, 'open', now, '', 0, 0, now)
        .run();
      row = {
        id: info.meta.last_row_id,
        visitor_id: visitorId,
        vip_code: vipCode,
        channel,
        status: 'open',
        last_at: now,
        last_preview: '',
        unread_admin: 0,
        unread_user: 0,
        created_at: now,
      };
    } else if (vipCode && !row.vip_code) {
      await db.prepare('UPDATE support_threads SET vip_code = ? WHERE id = ?').bind(vipCode, row.id).run();
      row.vip_code = vipCode;
    }
    return Response.json({
      ok: true,
      thread: { id: row.id, channel: row.channel, status: row.status, vipCode: row.vip_code || '' },
      hours: hoursInfo(),
      supportName: await supportName(db),
      aiReady: !!getAI(env),
    });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestGet({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const visitorId = String(url.searchParams.get('visitorId') || '').trim();
  if (!validVisitor(visitorId)) {
    return Response.json({ ok: false, error: 'شناسه نامعتبر' }, { status: 400 });
  }
  try {
    const { results } = await db
      .prepare(
        "SELECT id, channel, status, last_at, last_preview, unread_user FROM support_threads WHERE visitor_id = ? AND channel = 'ai' ORDER BY last_at DESC"
      )
      .bind(visitorId)
      .all();
    const unread = (results || []).reduce((n, t) => n + (t.unread_user || 0), 0);
    return Response.json({
      ok: true,
      threads: results || [],
      unread,
      hours: hoursInfo(),
      aiReady: !!getAI(env),
    });
  } catch (e) {
    return dbError(e);
  }
}
