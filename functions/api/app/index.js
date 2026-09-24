// GET /api/app — مشخصات فایل دانلود (عمومی، پشت گیت)
import { readyDB, noDb, dbError } from '../../lib/db.js';
import { assertGate } from '../../lib/gate.js';
import { loadAppMeta, publicAppPayload } from '../../lib/appfile.js';

export async function onRequestGet({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const meta = await loadAppMeta(db);
    return Response.json(publicAppPayload(meta), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return dbError(e);
  }
}
