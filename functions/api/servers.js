// GET /api/servers — لیست سرورهای فعال برای کاربران
import { readyDB, noDb, dbError } from '../lib/db.js';
import { getSetting, parseTags, parseCategoryTags } from '../lib/vip.js';

export async function onRequestGet({ env }) {
  const db = await readyDB(env);
  if (!db) return noDb();
  try {
    const { results } = await db
      .prepare(
        'SELECT id, name, country, protocol, link, category, featured, tags FROM servers WHERE enabled = 1 ORDER BY featured DESC, id DESC'
      )
      .all();
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
    const categoryTags = parseCategoryTags(await getSetting(db, 'category_tags', ''));
    return Response.json({ ok: true, servers, categoryTags });
  } catch (e) {
    return dbError(e);
  }
}
