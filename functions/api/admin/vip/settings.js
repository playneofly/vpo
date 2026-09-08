import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';
import {
  getSetting,
  setSetting,
  getPlanCopy,
  getPlanConfigs,
  mergePlanConfigs,
  mergePlanCopyKeep,
  DEFAULT_PLAN_CONFIGS,
  PLANS,
} from '../../../lib/vip.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    let planCopy = {};
    let planConfigs = Object.assign({}, DEFAULT_PLAN_CONFIGS);
    try {
      planCopy = await getPlanCopy(db);
    } catch (e) {}
    try {
      planConfigs = await getPlanConfigs(db);
    } catch (e) {}
    return Response.json({
      ok: true,
      enabled: (await getSetting(db, 'vip_enabled', '0')) === '1',
      cardNumber: await getSetting(db, 'card_number', ''),
      cardName: await getSetting(db, 'card_name', ''),
      planCopy,
      planConfigs,
      plans: PLANS,
    });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestPost({ request, env }) {
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
    if (body.cardNumber != null) await setSetting(db, 'card_number', String(body.cardNumber).trim());
    if (body.cardName != null) await setSetting(db, 'card_name', String(body.cardName).trim());
    if (body.enabled != null) await setSetting(db, 'vip_enabled', body.enabled ? '1' : '0');
    if (body.planCopy != null) {
      const cur = await getPlanCopy(db);
      await setSetting(db, 'plan_copy', JSON.stringify(mergePlanCopyKeep(cur, body.planCopy)));
    }
    if (body.planConfigs != null) {
      await setSetting(db, 'plan_configs', JSON.stringify(mergePlanConfigs(body.planConfigs)));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
