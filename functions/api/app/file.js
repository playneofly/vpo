// GET /api/app/file — ریدایرکت به لینک دانلود (عمومی، پشت گیت)
import { readyDB, noDb, dbError } from '../../lib/db.js';
import { assertGate } from '../../lib/gate.js';
import { loadAppMeta } from '../../lib/appfile.js';

export async function onRequestGet({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const meta = await loadAppMeta(db);
    if (!meta || !meta.url) {
      return Response.json({ ok: false, error: 'فایل هنوز آماده نیست' }, { status: 404 });
    }
    return Response.redirect(meta.url, 302);
  } catch (e) {
    return dbError(e);
  }
}
