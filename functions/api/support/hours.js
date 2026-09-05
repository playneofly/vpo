import { hoursInfo } from '../../lib/support.js';

export async function onRequestGet() {
  return Response.json({ ok: true, hours: hoursInfo() });
}
