import { assertGate } from '../../lib/gate.js';

export async function onRequestPost({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  return Response.json({ ok: false, error: 'این بخش حذف شده' }, { status: 404 });
}
