// GET /api/servers — لیست سرورهای فعال برای کاربران
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.VPO.prepare(
      "SELECT id, name, country, protocol, link FROM servers WHERE enabled = 1 ORDER BY id DESC"
    ).all();
    return Response.json({ ok: true, servers: results });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
