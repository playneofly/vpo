import { readyDB, noDb, dbError } from '../../lib/db.js';
import { verify, deny } from '../../lib/auth.js';
import { loadGate, saveGate } from '../../lib/gate.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const g = await loadGate(env);
    return Response.json({ ok: true, code: g.code || '', ver: g.ver || 0 });
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
    const saved = await saveGate(db, body.code);
    return Response.json({ ok: true, ver: saved.ver, code: saved.code });
  } catch (e) {
    return dbError(e);
  }
}
