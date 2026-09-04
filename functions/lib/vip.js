export const PLANS = {
  bronze: { id: 'bronze', title: 'برنز', price: 120000, configs: 10 },
  silver: { id: 'silver', title: 'نقره', price: 240000, configs: 20 },
  gold: { id: 'gold', title: 'طلایی', price: 360000, configs: 30 },
};

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
