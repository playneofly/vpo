import { readyDB, noDb, dbError } from '../lib/db.js';
import { getSetting } from '../lib/vip.js';
import { assertGate } from '../lib/gate.js';

export async function onRequestGet({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const text = await getSetting(db, 'footer_text', '');
    const { results } = await db
      .prepare('SELECT id, caption FROM site_photos ORDER BY sort ASC, id ASC')
      .all();
    return Response.json(
      { ok: true, text, photos: results || [] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return dbError(e);
  }
}
