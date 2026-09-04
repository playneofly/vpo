export async function verify(request, env) {
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

export const deny = () => Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
