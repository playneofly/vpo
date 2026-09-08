import { getDB } from './db.js';
import { getSetting, setSetting } from './vip.js';

const COOKIE = 'fn_gate';

function hexOf(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return hexOf(sig);
}

function secretOf(env) {
  return env.ADMIN_PASSWORD || 'fn-gate';
}

export function gateDeny() {
  return Response.json({ ok: false, gate: true, error: 'gate' }, { status: 401 });
}

export async function assertGate(env, request) {
  const g = await requireGate(env, request);
  if (!g.allow) return gateDeny();
  return null;
}

export function readCookieVer(request) {
  const raw = request.headers.get('Cookie') || '';
  const m = raw.match(/(?:^|;\s*)fn_gate=([^;]+)/);
  if (!m) return null;
  const [verStr, hex] = decodeURIComponent(m[1]).split('.');
  const ver = parseInt(verStr, 10);
  if (!ver || !hex) return null;
  return { ver, hex };
}

export async function cookieOk(request, env, ver) {
  if (!ver) return true;
  const c = readCookieVer(request);
  if (!c || c.ver !== ver) return false;
  const expect = await hmacHex(secretOf(env), 'fn_gate:' + ver);
  return c.hex === expect;
}

export async function gateCookieHeader(env, ver) {
  const hex = await hmacHex(secretOf(env), 'fn_gate:' + ver);
  return (
    COOKIE +
    '=' +
    ver +
    '.' +
    hex +
    '; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly'
  );
}

export function clearGateCookieHeader() {
  return COOKIE + '=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly';
}

function normCode(s) {
  return String(s || '').trim();
}

export async function loadGate(env) {
  const db = getDB(env);
  if (!db) return { db: null, code: '', ver: 0 };
  const code = normCode(await getSetting(db, 'gate_code', ''));
  const ver = parseInt(await getSetting(db, 'gate_ver', '0'), 10) || 0;
  return { db, code, ver: code ? ver : 0 };
}

export async function requireGate(env, request) {
  const g = await loadGate(env);
  if (!g.code) return { allow: true, open: true, ver: 0, db: g.db };
  const unlocked = await cookieOk(request, env, g.ver);
  return { allow: unlocked, open: false, ver: g.ver, db: g.db, unlocked };
}

export async function saveGate(db, code) {
  const next = normCode(code);
  const prev = normCode(await getSetting(db, 'gate_code', ''));
  let ver = parseInt(await getSetting(db, 'gate_ver', '0'), 10) || 0;
  if (next !== prev) {
    ver = next ? ver + 1 : 0;
    if (ver < 1 && next) ver = 1;
  }
  await setSetting(db, 'gate_code', next);
  await setSetting(db, 'gate_ver', String(ver));
  return { code: next, ver };
}

export function codesEqual(a, b) {
  const x = normCode(a);
  const y = normCode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
