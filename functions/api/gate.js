import { readyDB, noDb, dbError } from '../lib/db.js';
import {
  loadGate,
  cookieOk,
  codesEqual,
  gateCookieHeader,
  clearGateCookieHeader,
} from '../lib/gate.js';

export async function onRequestGet({ request, env }) {
  try {
    const g = await loadGate(env);
    if (!g.db) return noDb();
    if (!g.code) {
      return Response.json(
        { ok: true, open: true, ver: 0, unlocked: true },
        { headers: { 'Set-Cookie': clearGateCookieHeader(), 'Cache-Control': 'private, no-store' } }
      );
    }
    const unlocked = await cookieOk(request, env, g.ver);
    return Response.json(
      { ok: true, open: false, ver: g.ver, unlocked: !!unlocked },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestPost({ request, env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  try {
    const g = await loadGate(env);
    if (!g.code) {
      return Response.json({ ok: true, open: true, ver: 0 });
    }
    if (!codesEqual(body.code, g.code)) {
      return Response.json({ ok: false, error: 'کد نادرست است' }, { status: 403 });
    }
    const cookie = await gateCookieHeader(env, g.ver);
    return Response.json(
      { ok: true, ver: g.ver },
      { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'private, no-store' } }
    );
  } catch (e) {
    return dbError(e);
  }
}
