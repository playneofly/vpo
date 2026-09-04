function b64decode(s) {
  s = String(s || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try {
    return atob(s);
  } catch (e) {
    return '';
  }
}

function splitHostPort(hp) {
  hp = String(hp || '').trim();
  if (!hp) return null;
  if (hp.startsWith('[')) {
    const m = hp.match(/^\[([^\]]+)\]:(\d+)$/);
    if (!m) return null;
    return { host: m[1], port: parseInt(m[2], 10) };
  }
  const i = hp.lastIndexOf(':');
  if (i <= 0) return { host: hp, port: 443 };
  const port = parseInt(hp.slice(i + 1), 10);
  if (!port) return { host: hp, port: 443 };
  return { host: hp.slice(0, i), port };
}

export function parseEndpoint(link) {
  const raw = String(link || '').trim();
  if (!raw) return null;

  if (/^vmess:\/\//i.test(raw)) {
    try {
      const json = JSON.parse(b64decode(raw.slice(8).split(/[?#]/)[0]));
      const host = String(json.add || json.host || '')
        .trim()
        .replace(/^\[|\]$/g, '');
      const port = parseInt(json.port, 10) || 443;
      if (host && port) return { host, port };
    } catch (e) {}
    return null;
  }

  if (/^ss:\/\//i.test(raw)) {
    let rest = raw.slice(5);
    const hash = rest.indexOf('#');
    if (hash >= 0) rest = rest.slice(0, hash);
    const q = rest.indexOf('?');
    if (q >= 0) rest = rest.slice(0, q);
    const at = rest.lastIndexOf('@');
    if (at >= 0) {
      const parsed = splitHostPort(rest.slice(at + 1).split('/')[0]);
      if (parsed) return parsed;
    } else {
      const decoded = b64decode(rest);
      const at2 = decoded.lastIndexOf('@');
      if (at2 >= 0) {
        const parsed = splitHostPort(decoded.slice(at2 + 1));
        if (parsed) return parsed;
      }
    }
  }

  const m = raw.match(/:\/\/[^@\s/]*@(\[[^\]]+\]|[^\/:?#\s]+):(\d+)/);
  if (m) {
    return { host: m[1].replace(/^\[|\]$/g, ''), port: parseInt(m[2], 10) };
  }
  return null;
}

export function isBlockedHost(host) {
  const h = String(host || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local')) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h === 'metadata.google.internal') return true;
  return false;
}
