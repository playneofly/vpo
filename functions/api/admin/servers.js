// GET/POST /api/admin/servers — لیست کامل + افزودن سرور
import { readyDB, noDb, dbError } from '../../lib/db.js';

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
  if (!(await verify(request, env))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db.prepare('SELECT * FROM servers ORDER BY id DESC').all();
    return Response.json({ ok: true, servers: results });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await verify(request, env))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = await readyDB(env);
  if (!db) return noDb();

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const name = String(body.name || '').trim();
  const link = String(body.link || '').trim();
  if (!name || !link) {
    return Response.json({ ok: false, error: 'نام و لینک کانفیگ الزامی است' }, { status: 400 });
  }

  const country = String(body.country || '').trim();
  const protocol = String(body.protocol || 'vless').trim();
  const enabled = body.enabled === false ? 0 : 1;

  try {
    const info = await db
      .prepare('INSERT INTO servers (name, country, protocol, link, enabled) VALUES (?, ?, ?, ?, ?)')
      .bind(name, country, protocol, link, enabled)
      .run();
    return Response.json({ ok: true, id: info.meta.last_row_id });
  } catch (e) {
    return dbError(e);
  }
}
