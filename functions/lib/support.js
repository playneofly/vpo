import { getSetting } from './vip.js';

export const AI_MODELS = [
  '@cf/qwen/qwen1.5-7b-chat-awq',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
];

export const AI_SYS =
  'تو پشتیبان فارسی سایت FILTERNET هستی. کوتاه، مودب و خودمانی جواب بده. ' +
  'سایت کانفیگ V2Ray می‌دهد: کاربر کپی یا QR می‌کند و در v2rayNG یا Hiddify از کلیپ‌بورد وارد می‌کند. لینک خام روی کارت عمومی نشان داده نمی‌شود. ' +
  'خرید اختصاصی کارت‌به‌کارت است. زمان پلن‌ها فقط مدت پشتیبانی است، نه قطع خودکار کانفیگ. ' +
  'اگر سفارش انجام شده، از دکمه طلایی «سرور های من» بالای صفحه بردارد. ' +
  'روی سایت پینگ نیست. کانفیگ نساز، UUID یا رمز نخواه، نگو فیلتر را برمی‌داری یا سرور را روشن می‌کنی. ' +
  'ساعت پشتیبان انسان: هر روز ۱۲ ظهر تا ۱۲ شب به وقت ایران، جمعه‌ها تعطیل. ' +
  'اگر نفهمیدی یا کار به تأیید فیش/سفارش کشید بگو از گزینه «چت با ادمین» استفاده کند. فارسی جواب بده.';

export function tehranParts(d) {
  const date = d || new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
    minute: 'numeric',
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  return { hour, weekday: map.weekday, minute: parseInt(map.minute, 10) || 0 };
}

export function adminDeskOpen(d) {
  const t = tehranParts(d);
  if (t.weekday === 'Fri') return false;
  return t.hour >= 12 && t.hour < 24;
}

export function hoursInfo(d) {
  const t = tehranParts(d);
  const open = adminDeskOpen(d);
  let message = 'پشتیبان آنلاین است (۱۲ ظهر تا ۱۲ شب).';
  if (!open) {
    message =
      t.weekday === 'Fri'
        ? 'جمعه‌ها تعطیل است. پیامت می‌ماند تا شنبه ساعت ۱۲ ظهر.'
        : 'الان خارج از ساعت کاری است (هر روز ۱۲ ظهر تا ۱۲ شب، جمعه تعطیل). پیامت می‌ماند.';
  }
  return { open, tz: 'Asia/Tehran', days: 'هر روز ۱۲ تا ۲۴ به‌جز جمعه', message, hour: t.hour, weekday: t.weekday };
}

export function validVisitor(id) {
  const s = String(id || '').trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(s);
}

export function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

export function aiText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out.trim();
  if (out.response) return String(out.response).trim();
  if (out.result && out.result.response) return String(out.result.response).trim();
  if (Array.isArray(out) && out[0]) {
    if (typeof out[0] === 'string') return out[0].trim();
    if (out[0].response) return String(out[0].response).trim();
  }
  return '';
}

export async function runAI(env, history) {
  if (!env || !env.AI || typeof env.AI.run !== 'function') {
    const err = new Error('NO_AI');
    err.code = 'NO_AI';
    throw err;
  }
  const messages = [{ role: 'system', content: AI_SYS }].concat(history);
  let last = null;
  for (const model of AI_MODELS) {
    try {
      const out = await env.AI.run(model, { messages, max_tokens: 420 });
      const text = aiText(out);
      if (text) return { text, model };
      last = new Error('empty');
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('AI_FAIL');
}

export async function supportName(db) {
  return (await getSetting(db, 'support_name', 'پشتیبان FILTERNET')) || 'پشتیبان FILTERNET';
}

export async function cannedList(db) {
  const raw = await getSetting(db, 'support_canned', '');
  if (!raw) {
    return [
      'سلام، پیام را دیدم. چند دقیقه دیگر جواب می‌دهم.',
      'فیش را از بخش خرید اختصاصی همان مرورگر بفرست.',
      'اگر سفارش انجام شده، از دکمه طلایی «سرور های من» بالای صفحه بردار.',
      'کانفیگ را کپی کن و در v2rayNG یا Hiddify: افزودن ← وارد کردن از کلیپ‌بورد.',
    ];
  }
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];
  } catch (e) {
    return [];
  }
}
