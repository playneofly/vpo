import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';
import { ensureMenu } from '../../../lib/menu.js';

export async function onRequestPost({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  const id = parseInt(params.id, 10);
  if (!id) return Response.json({ ok: false, error: 'شناسه نامعتبر' }, { status: 400 });
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  try {
    await ensureMenu(db);
    const row = await db.prepare('SELECT * FROM site_menu WHERE id = ?').bind(id).first();
    if (!row) return Response.json({ ok: false, error: 'پیدا نشد' }, { status: 404 });
    if (body.move === 'up' || body.move === 'down') {
      const { results } = await db.prepare('SELECT id, sort FROM site_menu ORDER BY sort ASC, id ASC').all();
      const list = results || [];
      const i = list.findIndex((x) => x.id === id);
      const j = body.move === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return Response.json({ ok: true });
      const a = list[i];
      const b = list[j];
      await db.prepare('UPDATE site_menu SET sort = ? WHERE id = ?').bind(b.sort, a.id).run();
      await db.prepare('UPDATE site_menu SET sort = ? WHERE id = ?').bind(a.sort, b.id).run();
      return Response.json({ ok: true });
    }
    const title = body.title != null ? String(body.title).trim().slice(0, 80) : row.title;
    const section = body.section != null ? String(body.section).trim().slice(0, 40) : row.section;
    const text = body.body != null ? String(body.body).trim().slice(0, 8000) : row.body;
    if (!title) return Response.json({ ok: false, error: 'اسم لازم است' }, { status: 400 });
    await db
      .prepare('UPDATE site_menu SET section = ?, title = ?, body = ? WHERE id = ?')
      .bind(section, title, text, id)
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
  const id = parseInt(params.id, 10);
  try {
    await ensureMenu(db);
    await db.prepare('DELETE FROM site_menu WHERE id = ?').bind(id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
