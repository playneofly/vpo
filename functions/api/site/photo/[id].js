import { readyDB, noDb } from '../../../lib/db.js';
import { assertGate } from '../../../lib/gate.js';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function onRequestGet({ env, params }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  const id = parseInt(params.id, 10);
  try {
    const row = await db.prepare('SELECT image FROM site_photos WHERE id = ?').bind(id).first();
    if (!row || !row.image) return new Response('not found', { status: 404 });
    const m = String(row.image).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m) return new Response('not found', { status: 404 });
    return new Response(b64ToBytes(m[2].replace(/\s/g, '')), {
      headers: {
        'Content-Type': m[1],
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new Response('error', { status: 500 });
  }
}
