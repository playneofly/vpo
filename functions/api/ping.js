// GET /api/ping — اندازه‌گیری تأخیر کاربر تا سایت
export async function onRequestGet() {
  return Response.json(
    { ok: true, t: Date.now() },
    { headers: { 'Cache-Control': 'no-store, no-cache' } }
  );
}
