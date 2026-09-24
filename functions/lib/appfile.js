import { getSetting, setSetting } from './vip.js';

export const APP_META_KEY = 'app_file';
export const CHUNK = 360000;
export const MAX_BYTES = 200 * 1024 * 1024;

export async function ensureAppChunks(db) {
  await db
    .prepare('CREATE TABLE IF NOT EXISTS app_file_chunks (i INTEGER PRIMARY KEY, data BLOB NOT NULL)')
    .run();
}

export function u8ToB64(u8) {
  const step = 4096;
  let s = '';
  for (let i = 0; i < u8.length; i += step) {
    s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + step, u8.length)));
  }
  return btoa(s);
}

export function b64ToU8(b64) {
  const bin = atob(String(b64 || ''));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function toU8(data) {
  if (data == null) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return b64ToU8(data);
  return new Uint8Array(data);
}

export function parseAppMeta(raw) {
  if (!raw) return null;
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (!o || typeof o !== 'object') return null;
  if (o.complete === false) return null;
  const filename = String(o.filename || '').replace(/[^\w.\-]+/g, '') || 'filternet.apk';
  const size = Number(o.size) || 0;
  const uploadedAt = Number(o.uploaded_at) || 0;
  const chunks = Number(o.chunks) || 0;
  if (!size || !chunks) return null;
  return {
    name: String(o.name || 'FILTERNET').trim().slice(0, 48) || 'FILTERNET',
    version: String(o.version || '').trim().slice(0, 32),
    filename: filename.slice(0, 80),
    size,
    uploadedAt,
    chunks,
  };
}

export async function loadRawMeta(db) {
  if (!db) return null;
  const raw = await getSetting(db, APP_META_KEY, '');
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

export async function loadAppMeta(db) {
  if (!db) return null;
  return parseAppMeta(await getSetting(db, APP_META_KEY, ''));
}

export async function saveAppMeta(db, meta) {
  await setSetting(db, APP_META_KEY, JSON.stringify(meta && typeof meta === 'object' ? meta : {}));
}

export function publicAppPayload(meta) {
  if (!meta) return { ok: true, available: false };
  return {
    ok: true,
    available: true,
    name: meta.name,
    version: meta.version,
    filename: meta.filename,
    size: meta.size,
    uploadedAt: meta.uploadedAt,
    platform: 'android',
  };
}

export function safeFilename(name) {
  let s = String(name || '').split(/[/\\]/).pop() || '';
  s = s.replace(/[^\w.\-]+/g, '_');
  if (!/\.apk$/i.test(s)) s += '.apk';
  return s.slice(0, 80) || 'filternet.apk';
}

export function chunkCount(size) {
  const n = Number(size) || 0;
  if (n < 1) return 0;
  return Math.ceil(n / CHUNK);
}

export async function clearAppFile(db) {
  try {
    await db.prepare('DROP TABLE IF EXISTS app_file_chunks').run();
  } catch (e) {}
  await ensureAppChunks(db);
  await saveAppMeta(db, {});
}

export async function startAppUpload(db, info) {
  const size = Number(info.size) || 0;
  if (size < 1 || size > MAX_BYTES) {
    const err = new Error('حجم فایل باید تا ۲۰۰ مگ باشد');
    err.status = 400;
    throw err;
  }
  const chunks = chunkCount(size);
  try {
    await db.prepare('DROP TABLE IF EXISTS app_file_chunks').run();
  } catch (e) {}
  await ensureAppChunks(db);
  await saveAppMeta(db, {
    name: info.name,
    version: info.version,
    filename: info.filename,
    size,
    chunks,
    complete: false,
    uploaded_at: 0,
  });
  return { size, chunks };
}

export async function writeAppChunk(db, i, data) {
  await ensureAppChunks(db);
  const idx = parseInt(i, 10);
  if (!Number.isFinite(idx) || idx < 0 || idx > 4000) {
    const err = new Error('شماره تکه نامعتبر است');
    err.status = 400;
    throw err;
  }
  const u8 = toU8(data);
  if (!u8.length || u8.length > CHUNK + 64) {
    const err = new Error('تکه نامعتبر است');
    err.status = 400;
    throw err;
  }
  try {
    await db
      .prepare('INSERT INTO app_file_chunks (i, data) VALUES (?, ?) ON CONFLICT(i) DO UPDATE SET data = excluded.data')
      .bind(idx, u8)
      .run();
  } catch (e1) {
    await db
      .prepare('INSERT INTO app_file_chunks (i, data) VALUES (?, ?) ON CONFLICT(i) DO UPDATE SET data = excluded.data')
      .bind(idx, u8ToB64(u8))
      .run();
  }
}

export async function finishAppUpload(db) {
  await ensureAppChunks(db);
  const raw = await loadRawMeta(db);
  const expect = raw && Number(raw.chunks) ? Number(raw.chunks) : 0;
  if (!expect) {
    const err = new Error('آپلود شروع نشده');
    err.status = 400;
    throw err;
  }
  const row = await db.prepare('SELECT COUNT(*) AS n FROM app_file_chunks').first();
  const n = row ? Number(row.n) || 0 : 0;
  if (n !== expect) {
    const err = new Error('همهٔ تکه‌ها نرسید (' + n + ' از ' + expect + ')');
    err.status = 400;
    throw err;
  }
  raw.complete = true;
  raw.uploaded_at = Math.floor(Date.now() / 1000);
  await saveAppMeta(db, raw);
  return parseAppMeta(raw);
}

export function streamAppFile(db, meta) {
  let i = 0;
  const n = meta && meta.chunks ? meta.chunks : 0;
  return new ReadableStream({
    async pull(controller) {
      if (i >= n) {
        controller.close();
        return;
      }
      const row = await db.prepare('SELECT data FROM app_file_chunks WHERE i = ?').bind(i).first();
      i += 1;
      if (!row || row.data == null) {
        controller.error(new Error('تکهٔ فایل پیدا نشد'));
        return;
      }
      controller.enqueue(toU8(row.data));
    },
  });
}
