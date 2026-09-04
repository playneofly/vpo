import { readyDB, noDb, dbError } from '../../lib/db.js';
import { getSetting } from '../../lib/vip.js';

export async function onRequestGet({ env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const enabled = (await getSetting(db, 'vip_enabled', '0')) === '1';
    const cardNumber = await getSetting(db, 'card_number', '');
    const cardName = await getSetting(db, 'card_name', '');
    return Response.json({ ok: true, enabled, cardNumber, cardName });
  } catch (e) {
    return dbError(e);
  }
}
