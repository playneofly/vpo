import { readyDB, noDb, dbError } from '../../lib/db.js';
import { validVisitor, clip, hoursInfo, runAI, supportName } from '../../lib/support.js';

async function ownThread(db, visitorId, threadId) {
  return db
    .prepare('SELECT * FROM support_threads WHERE id = ? AND visitor_id = ?')
    .bind(threadId, visitorId)
    .first();
}

export async function onRequestGet({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  const url = new URL(request.url);
  const visitorId = String(url.searchParams.get('visitorId') || '').trim();
  const threadId = parseInt(url.searchParams.get('threadId'), 10);
  const afterId = parseInt(url.searchParams.get('afterId') || '0', 10) || 0;
  if (!validVisitor(visitorId) || !threadId) {
    return Response.json({ ok: false, error: 'پارامتر ناقص' }, { status: 400 });
  }
  try {
    const th = await ownThread(db, visitorId, threadId);
    if (!th) return Response.json({ ok: false, error: 'گفتگو پیدا نشد' }, { status: 404 });
    const { results } = await db
      .prepare(
        'SELECT id, sender, body, image, created_at FROM support_messages WHERE thread_id = ? AND id > ? ORDER BY id ASC'
      )
      .bind(threadId, afterId)
      .all();
    await db.prepare('UPDATE support_threads SET unread_user = 0 WHERE id = ?').bind(threadId).run();
    return Response.json({
      ok: true,
      thread: { id: th.id, channel: th.channel, status: th.status },
      messages: results || [],
      hours: hoursInfo(),
      supportName: await supportName(db),
    });
  } catch (e) {
    return dbError(e);
  }
}

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
  const threadId = parseInt(body.threadId, 10);
  const text = String(body.body || '').trim().slice(0, 2000);
  const image = String(body.image || '');
  const hasImg = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image) && image.length < 700000;
  if (!validVisitor(visitorId) || !threadId) {
    return Response.json({ ok: false, error: 'پارامتر ناقص' }, { status: 400 });
  }
  if (!text && !hasImg) {
    return Response.json({ ok: false, error: 'متن یا عکس لازم است' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    const th = await ownThread(db, visitorId, threadId);
    if (!th) return Response.json({ ok: false, error: 'گفتگو پیدا نشد' }, { status: 404 });
    if (th.status === 'closed') {
      await db.prepare("UPDATE support_threads SET status = 'open' WHERE id = ?").bind(threadId).run();
    }

    if (th.channel === 'ai') {
      const since = now - 86400;
      const cnt = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM support_messages WHERE thread_id = ? AND sender = 'user' AND created_at >= ?"
        )
        .bind(threadId, since)
        .first();
      if (cnt && cnt.n >= 20) {
        return Response.json({ ok: false, error: 'سهمیه پیام هوش مصنوعی امروز تمام شد. با ادمین حرف بزن.' }, { status: 429 });
      }
    }

    const img = hasImg ? image : '';
    const info = await db
      .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(threadId, 'user', text, img, now)
      .run();
    const userMsg = { id: info.meta.last_row_id, sender: 'user', body: text, image: img ? '1' : '', created_at: now };
    await db
      .prepare(
        'UPDATE support_threads SET last_at = ?, last_preview = ?, unread_admin = unread_admin + 1, status = ? WHERE id = ?'
      )
      .bind(now, clip(text || '📷 عکس', 80), 'open', threadId)
      .run();

    const extra = [];
    if (th.channel === 'ai') {
      const { results } = await db
        .prepare('SELECT sender, body FROM support_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 12')
        .bind(threadId)
        .all();
      const hist = (results || [])
        .reverse()
        .filter((m) => m.body)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: String(m.body).slice(0, 800),
        }));
      try {
        const ai = await runAI(env, hist);
        const aiNow = Math.floor(Date.now() / 1000);
        const aiInfo = await db
          .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(threadId, 'ai', ai.text, '', aiNow)
          .run();
        extra.push({ id: aiInfo.meta.last_row_id, sender: 'ai', body: ai.text, image: '', created_at: aiNow });
        await db
          .prepare('UPDATE support_threads SET last_at = ?, last_preview = ?, unread_user = unread_user + 1 WHERE id = ?')
          .bind(aiNow, clip(ai.text, 80), threadId)
          .run();
      } catch (e) {
        const msg =
          e && e.code === 'NO_AI'
            ? 'هوش مصنوعی هنوز وصل نیست. در کلادفلر: Settings → Bindings → Workers AI با اسم دقیقاً AI، بعد Retry deployment. فعلاً از چت با ادمین استفاده کن.'
            : 'هوش مصنوعی الان جواب نداد. دوباره بفرست یا با ادمین حرف بزن.';
        const aiNow = Math.floor(Date.now() / 1000);
        const aiInfo = await db
          .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(threadId, 'ai', msg, '', aiNow)
          .run();
        extra.push({ id: aiInfo.meta.last_row_id, sender: 'ai', body: msg, image: '', created_at: aiNow });
      }
    }

    return Response.json({
      ok: true,
      message: userMsg,
      replies: extra,
      hours: hoursInfo(),
      supportName: await supportName(db),
    });
  } catch (e) {
    return dbError(e);
  }
}
