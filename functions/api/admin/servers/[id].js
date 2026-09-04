// POST/DELETE /api/admin/servers/:id — ویرایش / تغییر وضعیت / حذف
import { readyDB, noDb, dbError } from '../../../lib/db.js';

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

const deny = () => Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

export async function onRequestPost({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();

  const id = parseInt(params.id, 10);
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  try {
    if (body.toggle) {
      await db.prepare('UPDATE servers SET enabled = 1 - enabled WHERE id = ?').bind(id).run();
      return Response.json({ ok: true });
    }

    const name = String(body.name || '').trim();
    const link = String(body.link || '').trim();
    if (!name || !link) {
      return Response.json({ ok: false, error: 'نام و لینک کانفیگ الزامی است' }, { status: 400 });
    }
    await db
      .prepare(
        'UPDATE servers SET name = ?, country = ?, protocol = ?, link = ?, enabled = ?, category = ? WHERE id = ?'
      )
      .bind(
        name,
        String(body.country || ''),
        String(body.protocol || 'vless'),
        link,
        body.enabled === false ? 0 : 1,
        String(body.category || '').trim(),
        id
      )
      .run();

    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  const id = parseInt(params.id, 10);
  try {
    await db.prepare('DELETE FROM servers WHERE id = ?').bind(id).run();
    return Response.json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
