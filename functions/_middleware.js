import { requireGate, gateDeny } from './lib/gate.js';

export async function onRequest(context) {
  const p = new URL(context.request.url).pathname;
  if (!p.startsWith('/api/')) return context.next();
  if (p === '/api/gate' || p.startsWith('/api/admin')) return context.next();
  const g = await requireGate(context.env, context.request);
  if (!g.allow) return gateDeny();
  return context.next();
}
