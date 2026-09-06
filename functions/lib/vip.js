export const PLANS = {
  bronze: { id: 'bronze', title: 'برنز', price: 120000, configs: 10 },
  silver: { id: 'silver', title: 'نقره', price: 240000, configs: 20 },
  gold: { id: 'gold', title: 'طلایی', price: 360000, configs: 30 },
};

export const SUPPORT_WEEKS = { bronze: 1, silver: 2, gold: 3 };
export const REPLACE_CAPS = { bronze: 3, silver: 5, gold: 10 };

export function supportUntilOf(row) {
  const n = Number(row && row.support_until) || 0;
  if (n > 0) return n;
  if (!row || row.status !== 'done') return 0;
  const w = SUPPORT_WEEKS[row.plan] || 1;
  return (Number(row.created_at) || 0) + w * 7 * 86400;
}

export function replaceCapOf(plan) {
  return REPLACE_CAPS[plan] || 3;
}

export function withSlots(list) {
  const arr = Array.isArray(list) ? list : parseAssigned(list);
  return arr.map((c, i) => ({
    ...c,
    slot: c.slot != null && String(c.slot) !== '' ? String(c.slot) : String(i),
  }));
}

export const DEFAULT_PLAN_COPY = {
  bronze: {
    title: 'برنز',
    subtitle: 'شروع اقتصادی',
    bullets: ['۱۰ کانفیگ اختصاصی', 'پشتیبانی ۱ هفته', 'سرعت بالا'],
  },
  silver: {
    title: 'نقره',
    subtitle: 'انتخاب متعادل',
    bullets: ['۲۰ کانفیگ اختصاصی', 'پشتیبانی ۲ هفته', 'بدون قطعی، مناسب اینترنت سیم‌کارت'],
  },
  gold: {
    title: 'طلایی',
    subtitle: 'بهترین تجربه',
    bullets: [
      '۳۰ کانفیگ اختصاصی',
      'پشتیبانی ۳ هفته',
      'بدون قطعی، سرعت بالا، تست‌شده روی اینترنت‌های مختلف و انتخاب بهترین پینگ',
    ],
  },
};

export function mergePlanCopy(raw) {
  let parsed = null;
  if (raw) {
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      parsed = null;
    }
  }
  const out = {};
  for (const id of ['bronze', 'silver', 'gold']) {
    const d = DEFAULT_PLAN_COPY[id];
    const p = (parsed && parsed[id]) || {};
    const title = p.title != null ? String(p.title).trim() : '';
    const subtitle = p.subtitle != null ? String(p.subtitle) : d.subtitle;
    let bullets = Array.isArray(p.bullets)
      ? p.bullets.map((x) => String(x).trim()).filter(Boolean)
      : typeof p.bullets === 'string'
        ? String(p.bullets)
            .split(/\r?\n/)
            .map((x) => x.trim())
            .filter(Boolean)
        : d.bullets.slice();
    if (!bullets.length) bullets = d.bullets.slice();
    out[id] = {
      title: title || d.title,
      subtitle,
      bullets,
    };
  }
  return out;
}

export function newCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'FL-';
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export async function getSetting(db, k, fallback) {
  try {
    const row = await db.prepare('SELECT v FROM vip_settings WHERE k = ?').bind(k).first();
    return row && row.v != null ? String(row.v) : fallback;
  } catch (e) {
    return fallback;
  }
}

export async function setSetting(db, k, v) {
  await db
    .prepare('INSERT INTO vip_settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .bind(k, String(v))
    .run();
}

export async function getPlanCopy(db) {
  const raw = await getSetting(db, 'plan_copy', '');
  return mergePlanCopy(raw);
}

export function parseAssigned(raw) {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (typeof item === 'string') {
        const link = item.trim();
        return link ? { name: 'کانفیگ اختصاصی', country: '', protocol: 'vless', link, category: '', featured: 0 } : null;
      }
      const link = String((item && item.link) || '').trim();
      if (!link) return null;
      const slot = item && item.slot != null && String(item.slot) !== '' ? String(item.slot) : undefined;
      return {
        name: String((item && item.name) || 'کانفیگ اختصاصی'),
        country: String((item && item.country) || ''),
        protocol: String((item && item.protocol) || 'vless'),
        link,
        category: String((item && item.category) || ''),
        featured: item && item.featured ? 1 : 0,
        slot,
      };
    })
    .filter(Boolean);
}
