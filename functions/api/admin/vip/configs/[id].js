import { readyDB, noDb, dbError } from '../../../../lib/db.js';
import { verify, deny } from '../../../../lib/auth.js';

export async function onRequestDelete({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    await db.prepare('DELETE FROM vip_configs WHERE id = ?').bind(parseInt(params.id, 10)).run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
