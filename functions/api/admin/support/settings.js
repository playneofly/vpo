import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';
import { getSetting, setSetting } from '../../../lib/vip.js';
import { cannedList, supportName } from '../../../lib/support.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    return Response.json({
      ok: true,
      supportName: await supportName(db),
      canned: await cannedList(db),
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
    if (body.supportName != null) await setSetting(db, 'support_name', String(body.supportName).trim().slice(0, 40) || 'پشتیبان FILTERNET');
    if (body.canned != null) {
      const arr = Array.isArray(body.canned)
        ? body.canned.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
        : String(body.canned)
            .split(/\r?\n/)
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20);
      await setSetting(db, 'support_canned', JSON.stringify(arr));
    }
    return Response.json({
      ok: true,
      supportName: await getSetting(db, 'support_name', 'پشتیبان FILTERNET'),
      canned: await cannedList(db),
    });
  } catch (e) {
    return dbError(e);
  }
}
