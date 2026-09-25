import { getSetting, setSetting } from './vip.js';

export const APP_META_KEY = 'app_file';
export const APP_LINK_KEY = 'app_link';

export function sanitizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 4000) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href;
  } catch (e) {
    return '';
  }
}

function asObject(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const o = JSON.parse(String(raw));
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

export function parseAppMeta(raw) {
  const o = asObject(raw);
  const url = sanitizeUrl((o && (o.url || o.link)) || raw);
  if (!url) return null;
  return {
    name: String((o && o.name) || 'FILTERNET').trim().slice(0, 48) || 'FILTERNET',
    version: String((o && o.version) || '').trim().slice(0, 32),
    url,
    uploadedAt: Number((o && (o.uploaded_at || o.saved_at)) || 0) || 0,
  };
}

export async function loadAppMeta(db) {
  if (!db) return null;
  const plain = sanitizeUrl(await getSetting(db, APP_LINK_KEY, ''));
  const meta = parseAppMeta(await getSetting(db, APP_META_KEY, ''));
  const url = (meta && meta.url) || plain;
  if (!url) return null;
  return {
    name: (meta && meta.name) || 'FILTERNET',
    version: (meta && meta.version) || '',
    url,
    uploadedAt: (meta && meta.uploadedAt) || 0,
  };
}

export async function saveAppMeta(db, info) {
  const prev = await loadAppMeta(db);
  const url = sanitizeUrl(info && (info.url || info.link)) || (prev && prev.url) || '';
  if (!url) {
    const err = new Error('لینک معتبر نیست (باید http یا https باشد)');
    err.status = 400;
    throw err;
  }
  const meta = {
    name: String((info && info.name) || (prev && prev.name) || 'FILTERNET').trim().slice(0, 48) || 'FILTERNET',
    version: String((info && info.version) != null ? info.version : (prev && prev.version) || '').trim().slice(0, 32),
    url,
    uploaded_at: Math.floor(Date.now() / 1000),
  };
  await setSetting(db, APP_META_KEY, JSON.stringify(meta));
  await setSetting(db, APP_LINK_KEY, url);
  return parseAppMeta(meta);
}

export async function clearAppFile(db) {
  await setSetting(db, APP_META_KEY, '{}');
  await setSetting(db, APP_LINK_KEY, '');
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
