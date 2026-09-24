// POST /api/admin/logout — خروج
export async function onRequestPost({ request }) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': `vpo_admin=; HttpOnly; Path=/; Max-Age=0${secure}`,
      },
    }
  );
}
