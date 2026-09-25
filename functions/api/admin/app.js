import { readyDB, noDb, dbError } from '../../lib/db.js';
import { verify, deny } from '../../lib/auth.js';
import { loadAppMeta, publicAppPayload, saveAppMeta, clearAppFile } from '../../lib/appfile.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const meta = await loadAppMeta(db);
    return Response.json({ ok: true, ...publicAppPayload(meta) }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    await clearAppFile(db);
    return Response.json({ ok: true, available: false });
  } catch (e) {
    return dbError(e);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    const meta = await saveAppMeta(db, {
      url: body.url || body.link || '',
      name: body.name,
      version: body.version,
    });
    return Response.json({ ok: true, ...publicAppPayload(meta) });
  } catch (e) {
    if (e && e.status === 400) {
      return Response.json({ ok: false, error: e.message || 'لینک نامعتبر است' }, { status: 400 });
    }
    return dbError(e);
  }
}
