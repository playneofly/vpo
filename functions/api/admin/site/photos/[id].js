import { readyDB, noDb, dbError } from '../../../../lib/db.js';
import { verify, deny } from '../../../../lib/auth.js';

export async function onRequestDelete({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    await db.prepare('DELETE FROM site_photos WHERE id = ?').bind(parseInt(params.id, 10)).run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  try {
    if (body.caption != null) {
      await db
        .prepare('UPDATE site_photos SET caption = ? WHERE id = ?')
        .bind(String(body.caption).trim(), parseInt(params.id, 10))
        .run();
    }
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
