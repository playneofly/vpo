import { readyDB, noDb, dbError } from '../lib/db.js';
import { assertGate } from '../lib/gate.js';
import { listMenu, publicItem } from '../lib/menu.js';

export async function onRequestGet({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const items = (await listMenu(db)).map(publicItem).filter((x) => x.title);
    return Response.json({ ok: true, items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return dbError(e);
  }
}
