// GET /api/servers — لیست سرورهای فعال برای کاربران
import { getDB, readyDB, noDb, dbError } from '../lib/db.js';
import { getSetting, parseTags, parseCategoryTags } from '../lib/vip.js';

const SQL =
  'SELECT id, name, country, protocol, link, category, featured, tags FROM servers WHERE enabled = 1 ORDER BY featured DESC, id DESC';

function pack(results, categoryTags) {
  let featuredSeen = false;
  const servers = (results || []).map((s) => {
    const featured = s.featured && !featuredSeen ? 1 : 0;
    if (featured) featuredSeen = true;
    return {
      id: s.id,
      name: s.name,
      country: s.country,
      protocol: s.protocol,
      link: s.link,
      category: s.category || '',
      featured,
      tags: parseTags(s.tags),
    };
  });
  return Response.json(
    { ok: true, servers, categoryTags: categoryTags || {} },
    { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=60' } }
  );
}

export async function onRequestGet({ env }) {
  let db = getDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db.prepare(SQL).all();
    const categoryTags = parseCategoryTags(await getSetting(db, 'category_tags', ''));
    return pack(results, categoryTags);
  } catch (e) {
    db = await readyDB(env);
    if (!db) return noDb();
    try {
      const { results } = await db.prepare(SQL).all();
      const categoryTags = parseCategoryTags(await getSetting(db, 'category_tags', ''));
      return pack(results, categoryTags);
    } catch (e2) {
      return dbError(e2);
    }
  }
}
