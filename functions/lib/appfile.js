import { getSetting, setSetting } from './vip.js';

export const APP_META_KEY = 'app_file';

export function sanitizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 2000) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href;
  } catch (e) {
    return '';
  }
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
  const url = sanitizeUrl(o.url || o.link || '');
  if (!url) return null;
  return {
    name: String(o.name || 'FILTERNET').trim().slice(0, 48) || 'FILTERNET',
    version: String(o.version || '').trim().slice(0, 32),
    url,
    uploadedAt: Number(o.uploaded_at || o.saved_at) || 0,
  };
}

export async function loadAppMeta(db) {
  if (!db) return null;
  return parseAppMeta(await getSetting(db, APP_META_KEY, ''));
}

export async function saveAppMeta(db, info) {
  const url = sanitizeUrl(info && info.url);
  if (!url) {
    const err = new Error('لینک معتبر نیست (باید http یا https باشد)');
    err.status = 400;
    throw err;
  }
  const meta = {
    name: String((info && info.name) || 'FILTERNET').trim().slice(0, 48) || 'FILTERNET',
    version: String((info && info.version) || '').trim().slice(0, 32),
    url,
    uploaded_at: Math.floor(Date.now() / 1000),
  };
  await setSetting(db, APP_META_KEY, JSON.stringify(meta));
  return parseAppMeta(meta);
}

export async function clearAppFile(db) {
  await setSetting(db, APP_META_KEY, '{}');
}

export function publicAppPayload(meta) {
  if (!meta || !meta.url) return { ok: true, available: false };
  return {
    ok: true,
    available: true,
    name: meta.name,
    version: meta.version,
    url: meta.url,
    uploadedAt: meta.uploadedAt,
    platform: 'android',
  };
}
