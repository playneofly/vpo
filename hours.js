import { hoursInfo } from '../../lib/support.js';
import { assertGate } from '../../lib/gate.js';

export async function onRequestGet({ env, request }) {
  const blocked = await assertGate(env, request);
  if (blocked) return blocked;
  return Response.json({ ok: true, hours: hoursInfo() });
}
