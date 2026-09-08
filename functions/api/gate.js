import { readyDB, noDb, dbError } from '../lib/db.js';
import {
  loadGate,
  cookieOk,
  codesEqual,
  gateCookieHeader,
  clearGateCookieHeader,
  gateToken,
} from '../lib/gate.js';

function pack(data, cookie, status) {
  const h = new Headers();
  h.set('Content-Type', 'application/json; charset=utf-8');
  h.set('Cache-Control', 'private, no-store');
  if (cookie) h.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status: status || 200, headers: h });
}

export async function onRequestGet({ request, env }) {
  try {
    const g = await loadGate(env);
    if (!g.db) return noDb();
    if (!g.code) {
      return pack({ ok: true, open: true, ver: 0, unlocked: true }, clearGateCookieHeader());
    }
    const unlocked = await cookieOk(request, env, g.ver);
    const token = unlocked ? await gateToken(env, g.ver) : '';
    return pack({ ok: true, open: false, ver: g.ver, unlocked: !!unlocked, token: token || undefined });
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
      return pack({ ok: true, open: true, ver: 0, token: '' }, clearGateCookieHeader());
    }
    if (!codesEqual(body.code, g.code)) {
      return pack({ ok: false, error: 'کد نادرست است' }, null, 403);
    }
    const token = await gateToken(env, g.ver);
    const cookie = await gateCookieHeader(env, g.ver);
    return pack({ ok: true, ver: g.ver, token }, cookie);
  } catch (e) {
    return dbError(e);
  }
}
