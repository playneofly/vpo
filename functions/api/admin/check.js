import { getDB, readyDB } from '../../lib/db.js';

async function verify(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)vpo_admin=([^;]+)/);
  if (!m) return false;
  const token = m[1];
  const [payload, hex] = token.split('.');
  if (!payload || !hex) return false;
  const exp = parseInt(payload, 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const secret = env.ADMIN_PASSWORD;
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sig = new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode('vpo:' + payload));
}

export async function onRequestGet({ request, env }) {
  const ok = await verify(request, env);
  if (!ok) return Response.json({ ok: false });
  const bound = !!getDB(env);
  let db = bound;
  let serverCount = null;
  if (bound) {
    try {
      const conn = await readyDB(env);
      const row = await conn.prepare('SELECT COUNT(*) AS n FROM servers').first();
      serverCount = row && row.n != null ? Number(row.n) : 0;
    } catch (e) {
      try {
        const conn = getDB(env);
        const row = await conn.prepare('SELECT COUNT(*) AS n FROM servers').first();
        serverCount = row && row.n != null ? Number(row.n) : 0;
      } catch (e2) {
        db = false;
      }
    }
  }
  return Response.json({ ok: true, db, serverCount });
}
