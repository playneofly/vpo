import { readyDB, noDb, dbError } from '../../lib/db.js';
import { getSetting, getPlanCopy, PLANS } from '../../lib/vip.js';

export async function onRequestGet({ env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const enabled = (await getSetting(db, 'vip_enabled', '0')) === '1';
    const cardNumber = await getSetting(db, 'card_number', '');
    const cardName = await getSetting(db, 'card_name', '');
    const planCopy = await getPlanCopy(db);
    const plans = {};
    for (const id of ['bronze', 'silver', 'gold']) {
      plans[id] = Object.assign({}, PLANS[id], planCopy[id]);
    }
    return Response.json(
      { ok: true, enabled, cardNumber, cardName, plans },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return dbError(e);
  }
}
