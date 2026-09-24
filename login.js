// POST /api/admin/login — ورود با پسورد (متغیر ADMIN_PASSWORD)
export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  const pass = String(body.password || '');
  const real = env.ADMIN_PASSWORD;

  if (!real) {
    return Response.json({ ok: false, error: 'ADMIN_PASSWORD در تنظیمات ست نشده است' }, { status: 500 });
  }
  if (pass !== real) {
    return Response.json({ ok: false, error: 'رمز عبور اشتباه است' }, { status: 401 });
  }

  // ساخت توکن امضاشده با HMAC-SHA256
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // ۷ روز اعتبار
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(real),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('vpo:' + exp));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const token = exp + '.' + hex;

  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': `vpo_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${secure}`,
      },
    }
  );
}
