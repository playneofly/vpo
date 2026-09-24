import { readyDB, noDb, dbError } from '../../lib/db.js';
import { verify, deny } from '../../lib/auth.js';
import {
  loadAppMeta, publicAppPayload, safeFilename, clearAppFile,
  startAppUpload, writeAppChunk, finishAppUpload, MAX_BYTES,
} from '../../lib/appfile.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const meta = await loadAppMeta(db);
    return Response.json({ ok: true, ...publicAppPayload(meta) });
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

  const ctype = request.headers.get('content-type') || '';
  try {
    if (ctype.includes('application/json')) {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
      const action = String(body.action || '');
      if (action === 'start') {
        const size = Number(body.size) || 0;
        if (size > MAX_BYTES) {
          return Response.json({ ok: false, error: 'حجم فایل زیاد است (حداکثر ۲۰۰ مگ)' }, { status: 400 });
        }
        const filename = safeFilename(body.filename || body.name || 'filternet.apk');
        const started = await startAppUpload(db, {
          name: String(body.name || 'FILTERNET').trim().slice(0, 48) || 'FILTERNET',
          version: String(body.version || '').trim().slice(0, 32),
          filename,
          size,
        });
        return Response.json({ ok: true, chunks: started.chunks, size: started.size });
      }
      if (action === 'finish') {
        const meta = await finishAppUpload(db);
        return Response.json({ ok: true, ...publicAppPayload(meta) });
      }
      return Response.json({ ok: false, error: 'درخواست نامعتبر است' }, { status: 400 });
    }

    const form = await request.formData();
    const action = String(form.get('action') || 'chunk');
    if (action !== 'chunk') {
      return Response.json({ ok: false, error: 'درخواست نامعتبر است' }, { status: 400 });
    }
    const i = form.get('i');
    const part = form.get('chunk');
    if (!part || typeof part === 'string') {
      return Response.json({ ok: false, error: 'تکه نرسید' }, { status: 400 });
    }
    const buf = await part.arrayBuffer();
    await writeAppChunk(db, i, buf);
    return Response.json({ ok: true, i: Number(i) });
  } catch (e) {
    if (e && e.status === 400) {
      return Response.json({ ok: false, error: e.message || 'خطا' }, { status: 400 });
    }
    try {
      return dbError(e);
    } catch (e2) {
      return Response.json({ ok: false, error: 'خطای سرور در ذخیرهٔ فایل' }, { status: 500 });
    }
  }
}
