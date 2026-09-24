// GET /api/app/file — دانلود استریم از D1 (عمومی، پشت گیت)
import { readyDB, noDb, dbError } from '../../lib/db.js';
import { assertGate } from '../../lib/gate.js';
import { loadAppMeta, streamAppFile } from '../../lib/appfile.js';

export async function onRequestGet({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const meta = await loadAppMeta(db);
    if (!meta) {
      return Response.json({ ok: false, error: 'فایل هنوز آماده نیست' }, { status: 404 });
    }
    const filename = meta.filename || 'filternet.apk';
    const headers = {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Cache-Control': 'private, no-store',
    };
    if (meta.size) headers['Content-Length'] = String(meta.size);
    return new Response(streamAppFile(db, meta), { headers });
  } catch (e) {
    return dbError(e);
  }
}
