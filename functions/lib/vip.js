export const PLANS = {
  bronze: { id: 'bronze', title: 'برنز', price: 120000, configs: 10 },
  silver: { id: 'silver', title: 'نقره', price: 240000, configs: 20 },
  gold: { id: 'gold', title: 'طلایی', price: 360000, configs: 30 },
};

export const DEFAULT_PLAN_CONFIGS = { bronze: 10, silver: 20, gold: 30 };

export function clampPlanN(n, fallback) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x) || x < 1) return fallback;
  return Math.min(200, x);
}

export function mergePlanConfigs(raw) {
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
    const fb = DEFAULT_PLAN_CONFIGS[id];
    const src = parsed && parsed[id] != null ? parsed[id] : fb;
    out[id] = clampPlanN(src, fb);
  }
  return out;
}

export function planConfigCount(counts, plan) {
  const id = plan && DEFAULT_PLAN_CONFIGS[plan] != null ? plan : 'bronze';
  if (counts && counts[id] != null) return counts[id];
  return DEFAULT_PLAN_CONFIGS[id];
}

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

export function parseTags(raw) {
  if (!raw) return [];
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else {
    const s = String(raw).trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) arr = p;
      else arr = s.split(/[,،]/);
    } catch (e) {
      arr = s.split(/[,،]/);
    }
  }
  const seen = {};
  const out = [];
  arr.forEach((x) => {
    const t = String(x || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24);
    if (!t || seen[t]) return;
    seen[t] = 1;
    out.push(t);
  });
  return out.slice(0, 10);
}

export function dumpTags(raw) {
  return JSON.stringify(parseTags(raw));
}

export function parseCategoryTags(raw) {
  let obj = {};
  if (!raw) return obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return {};
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  Object.keys(obj).forEach((k) => {
    const cat = String(k || '').trim();
    if (!cat) return;
    const tags = parseTags(obj[k]);
    if (tags.length) out[cat] = tags;
  });
  return out;
}

export function findOrderCode(text) {
  const u = String(text || '')
    .toUpperCase()
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '');
  const m = u.match(/FL-?\s*([A-Z0-9]{6})/);
  return m ? 'FL-' + m[1] : '';
}

export function faDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

export function faLeftPhrase(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s <= 0) return '';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const bits = [];
  if (d) bits.push(faDigits(d) + ' روز');
  if (h) bits.push(faDigits(h) + ' ساعت');
  if (!d && (m || !h)) bits.push(faDigits(Math.max(1, m)) + ' دقیقه');
  return bits.join(' و ');
}

export function tehranStamp(unix) {
  const t = Number(unix) || 0;
  if (!t) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(t * 1000));
  } catch (e) {
    return '';
  }
}

const PLAN_FA = { bronze: 'برنز', silver: 'نقره', gold: 'طلایی' };
const ST_FA = {
  awaiting_receipt: 'در انتظار ارسال فیش',
  pending: 'فیش رسیده؛ منتظر تأیید ادمین',
  in_progress: 'در حال آماده‌سازی کانفیگ',
  done: 'انجام شده',
  rejected: 'رد شده',
  expired: 'زمان ارسال فیش تمام شده',
};

export function orderFactsBlock(row, code) {
  if (!code) return 'کد سفارشی در پیام نیست.';
  if (!row) return 'کد ' + code + ' در سیستم پیدا نشد.';
  const now = Math.floor(Date.now() / 1000);
  const until = supportUntilOf(row);
  const left = until - now;
  const used = Number(row.replace_used) || 0;
  const max = replaceCapOf(row.plan);
  let s =
    'کد:' +
    row.code +
    '\nپلن:' +
    (PLAN_FA[row.plan] || row.plan) +
    '\nوضعیت:' +
    (ST_FA[row.status] || row.status);
  if (row.status === 'done') {
    s +=
      '\nپشتیبانی_تا:' +
      (tehranStamp(until) || until) +
      '\nمانده_ثانیه:' +
      Math.max(0, left) +
      '\nمانده_متن:' +
      (left > 0 ? faLeftPhrase(left) : 'تمام شده') +
      '\nجایگزینی:' +
      used +
      ' از ' +
      max;
  }
  if (row.status === 'rejected' && row.reject_reason) s += '\nدلیل_رد:' + String(row.reject_reason).slice(0, 160);
  return s;
}

export function orderDeskReply(row, code) {
  if (!code) {
    return 'کد سفارشت را بفرست؛ به شکل FL- و شش حرف یا عدد (همان که موقع خرید دیدی). با همان دقیق می‌گویم چقدر از پشتیبانی مانده.';
  }
  if (!row) {
    return (
      'کد ' +
      code +
      ' در سیستم نیست. یک‌بار دیگر همان کد روی رسید/صفحه خرید را بدون فاصله اضافه بفرست. اگر همین الان خریدی و هنوز فیش نفرستادی، از همان مرورگر بخش خرید را باز کن.'
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const title = PLAN_FA[row.plan] || row.plan;
  const st = ST_FA[row.status] || row.status;
  let s = 'کد «' + row.code + '» را پیدا کردم.\nپلن: ' + title + '\nوضعیت: ' + st + '.';
  if (row.status === 'done') {
    const until = supportUntilOf(row);
    const left = until - now;
    const used = Number(row.replace_used) || 0;
    const max = replaceCapOf(row.plan);
    if (left > 0) {
      const untilFa = tehranStamp(until);
      s +=
        '\nاز مدت پشتیبانی دقیقاً «' +
        faLeftPhrase(left) +
        '» مانده' +
        (untilFa ? ' (تا ' + untilFa + ' به وقت تهران)' : '') +
        '.';
    } else {
      s += '\nمدت پشتیبانی این سفارش تمام شده. کانفیگ قطعِ خودکار نمی‌شود؛ فقط درخواست جایگزینی دیگر فعال نیست.';
    }
    s +=
      '\nجایگزینی: ' +
      faDigits(used) +
      ' از ' +
      faDigits(max) +
      ' استفاده شده.';
    s += '\nکانفیگ را از دکمه طلایی «سرور های من» بالای صفحه بردار. لینک خام اینجا فرستاده نمی‌شود.';
  } else if (row.status === 'awaiting_receipt') {
    s += '\nهنوز فیش نیامده. از همان مرورگری که خرید زدی، عکس فیش را در بخش پرداخت بفرست.';
  } else if (row.status === 'pending') {
    s += '\nفیش رسیده و در صف بررسی ادمین است. همین‌جا صبر کن؛ بعد از تأیید، کانفیگ در «سرور های من» می‌آید.';
  } else if (row.status === 'in_progress') {
    s += '\nسفارش تأیید شده و کانفیگ در حال آماده‌سازی است. به‌محض انجام شدن، از «سرور های من» بردار.';
  } else if (row.status === 'rejected') {
    s += row.reject_reason ? '\nدلیل: ' + String(row.reject_reason).slice(0, 160) : '';
    s += '\nاگر فکر می‌کنی اشتباه شده، فیش را دوباره از بخش خرید همان مرورگر بفرست یا دلیل را همین‌جا بنویس.';
  } else if (row.status === 'expired') {
    s += '\nمهلت یک‌ساعتهٔ فیش تمام شده. از دکمه خرید یک سفارش تازه بگیر و فیش را همان موقع بفرست.';
  }
  return s;
}

export function wantsOrderInfo(text) {
  const t = String(text || '');
  if (findOrderCode(t) && t.replace(/FL-?\s*[A-Za-z0-9]{6}/gi, '').replace(/\s+/g, '').length < 8) return true;
  return /پشتیبانی|چقدر\s*موند|چقد[ر]?\s*موند|چند\s*روز|تا\s*کی|کی\s*تموم|باقی|مهلت|انقضا|وضعیت\s*سفارش|سفارشم|کد\s*سفارش|چقدر\s*مانده|چقدر\s*مونده|چقد[ر]?\s*مانده/i.test(
    t
  );
}

export function isDownAsk(text) {
  const t = String(text || '');
  return /وصل\s*نمی|وصل\s*نم[یي]ش|کار\s*نمی[\s\u200c]*کن|فیلتر\s*شد|جایگزین|سرور\s*(قطع|خراب|مرده)|قطع\s+شده|نمیاد\s*بالا/i.test(
    t
  );
}

export function orderPublicBlurb(row) {
  if (!row) return 'سفارشی با این کد پیدا نشد.';
  const titles = { bronze: 'برنز', silver: 'نقره', gold: 'طلایی' };
  const st = {
    awaiting_receipt: 'در انتظار ارسال فیش',
    pending: 'فیش رسیده، منتظر تأیید ادمین',
    in_progress: 'در حال آماده‌سازی کانفیگ',
    done: 'انجام شده',
    rejected: 'رد شده',
    expired: 'زمان فیش تمام شده',
  };
  const now = Math.floor(Date.now() / 1000);
  let s =
    'کد ' +
    row.code +
    ' — پلن ' +
    (titles[row.plan] || row.plan) +
    ' — وضعیت: ' +
    (st[row.status] || row.status) +
    '.';
  if (row.status === 'done') {
    const until = supportUntilOf(row);
    const left = until - now;
    if (left > 0) s += ' حدود ' + Math.ceil(left / 86400) + ' روز از پشتیبانی مانده.';
    else s += ' مدت پشتیبانی تمام شده.';
    s += ' کانفیگ را از دکمه طلایی «سرور های من» بالای صفحه بردار.';
  } else if (row.status === 'awaiting_receipt') {
    s += ' از همان مرورگر فیش را بفرست.';
  } else if (row.status === 'rejected') {
    s += row.reject_reason ? ' دلیل: ' + String(row.reject_reason).slice(0, 120) : '';
  }
  return s;
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

export async function getPlanConfigs(db) {
  const raw = await getSetting(db, 'plan_configs', '');
  return mergePlanConfigs(raw);
}

export function mergePlanCopyKeep(current, incoming) {
  const cur = mergePlanCopy(current || {});
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  const out = {};
  for (const id of ['bronze', 'silver', 'gold']) {
    const p = src[id] || {};
    const c = cur[id];
    const title = String(p.title != null ? p.title : '').trim() || c.title;
    const subIn = p.subtitle != null ? String(p.subtitle) : null;
    const subtitle = subIn != null && subIn.trim() !== '' ? subIn : c.subtitle;
    let bullets = [];
    if (Array.isArray(p.bullets)) bullets = p.bullets.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof p.bullets === 'string')
      bullets = String(p.bullets)
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    if (!bullets.length) bullets = (c.bullets || []).slice();
    out[id] = { title, subtitle, bullets };
  }
  return out;
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
