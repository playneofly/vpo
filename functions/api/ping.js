// GET /api/ping           → ضربان سایت (برای پینگ کاربر تا خودِ صفحه)
// GET /api/ping?all=1     → پینگ TCP واقعی به پورت هر سرور
// GET /api/ping?id=12     → پینگ TCP یک سرور
import { readyDB, noDb, dbError } from '../lib/db.js';
import { parseEndpoint, isBlockedHost } from '../lib/endpoint.js';

async function tcpPing(host, port, timeoutMs) {
  const { connect } = await import('cloudflare:sockets');
  const started = Date.now();
  const socket = connect({ hostname: host, port: Number(port) });
  let timer;
  try {
    await Promise.race([
      socket.opened,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return Date.now() - started;
  } catch (e) {
    return -1;
  } finally {
    if (timer) clearTimeout(timer);
    try {
      socket.close();
    } catch (e) {}
  }
}

async function pingEndpoint(ep) {
  if (!ep || !ep.host || !ep.port) return -1;
  if (isBlockedHost(ep.host)) return -1;
  const port = Number(ep.port);
  if (!port || port < 1 || port > 65535) return -1;
  const a = await tcpPing(ep.host, port, 3500);
  if (a < 0) return -1;
  const b = await tcpPing(ep.host, port, 3500);
  if (b < 0) return a;
  return Math.min(a, b);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all');
  const id = url.searchParams.get('id');

  if (!all && !id) {
    return Response.json(
      { ok: true, t: Date.now() },
      { headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  }

  const db = await readyDB(env);
  if (!db) return noDb();

  try {
    let rows;
    if (id) {
      const one = await db.prepare('SELECT id, link FROM servers WHERE id = ? AND enabled = 1').bind(Number(id)).first();
      rows = one ? [one] : [];
    } else {
      const res = await db.prepare('SELECT id, link FROM servers WHERE enabled = 1 ORDER BY id DESC').all();
      rows = res.results || [];
    }

    const pings = {};
    const queue = rows.slice(0, 40);
    const conc = 6;
    let cursor = 0;

    async function worker() {
      while (cursor < queue.length) {
        const row = queue[cursor++];
        pings[String(row.id)] = await pingEndpoint(parseEndpoint(row.link));
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(conc, queue.length); i++) workers.push(worker());
    await Promise.all(workers);

    return Response.json(
      { ok: true, pings },
      { headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  } catch (e) {
    return dbError(e);
  }
}
