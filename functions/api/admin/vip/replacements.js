import { readyDB, noDb, dbError } from '../../../lib/db.js';
import { verify, deny } from '../../../lib/auth.js';
import { supportUntilOf, replaceCapOf } from '../../../lib/vip.js';

export async function onRequestGet({ request, env }) {
  if (!(await verify(request, env))) return deny();
  const db = await readyDB(env);
  if (!db) return noDb();
  const now = Math.floor(Date.now() / 1000);
  try {
    const { results } = await db
      .prepare(
        "SELECT r.id, r.order_id, r.code, r.plan, r.slot, r.old_name, r.old_country, r.old_protocol, r.old_category, r.status, r.created_at, r.done_at, r.new_name, o.support_until, o.replace_used, o.status AS order_status, o.created_at AS order_created FROM vip_replacements r LEFT JOIN vip_orders o ON o.id = r.order_id ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.id DESC LIMIT 200"
      )
      .all();
    const list = (results || []).map((r) => {
      const until = supportUntilOf({
        support_until: r.support_until,
        status: r.order_status || 'done',
        plan: r.plan,
        created_at: r.order_created,
      });
      const left = Math.max(0, until - now);
      return {
        id: r.id,
        orderId: r.order_id,
        code: r.code,
        plan: r.plan,
        slot: r.slot,
        oldName: r.old_name,
        oldCountry: r.old_country,
        oldProtocol: r.old_protocol,
        oldCategory: r.old_category,
        status: r.status,
        createdAt: r.created_at,
        doneAt: r.done_at,
        newName: r.new_name || '',
        supportUntil: until,
        supportLeft: left,
        replaceUsed: Number(r.replace_used) || 0,
        replaceMax: replaceCapOf(r.plan),
      };
    });
    const pending = list.filter((x) => x.status === 'pending').length;
    return Response.json({ ok: true, replacements: list, pending });
  } catch (e) {
    return dbError(e);
  }
}
