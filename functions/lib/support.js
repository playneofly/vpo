import {
  getSetting,
  findOrderCode,
  isDownAsk,
  orderDeskReply,
  orderFactsBlock,
  supportUntilOf,
  getPlanCopy,
  getPlanConfigs,
  PLANS,
} from './vip.js';

export const AI_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/meta/llama-3.1-8b-instruct',
];

export const AI_SYS =
  'تو ادمین پشتیبانی FILTERNET هستی. مثل پشتیبان کاربلد و مسلط جواب بده: مودب، دقیق، کامل، بدون حاشیه. فقط فارسی روان. ' +
  'لحن انسانی و حرفه‌ای؛ قالب تکراری و روباتی ممنوع. به همان سؤال کاربر جواب بده، نه متن آماده. ' +
  'عدد، قیمت، تعداد کانفیگ، روز/ساعت پشتیبانی و وضعیت سفارش را فقط از بلوک دانش زنده بردار. اگر آنجا نبود، حدس نزن؛ بپرس یا بگو باید از روی کد FL- چک شود. ' +
  '\nدانش محصول:\n' +
  'FILTERNET سایت کانفیگ V2Ray است. روی کارت عمومی «کپی کانفیگ» یا QR؛ بعد در v2rayNG یا Hiddify: افزودن ← وارد کردن از کلیپ‌بورد. لینک خام روی صفحه دیده نمی‌شود. ' +
  'دسته را که انتخاب کند می‌تواند همهٔ کانفیگ همان دسته را یکجا کپی کند؛ روی «همه» کپیِ همه نیست. ' +
  'خرید اختصاصی: دکمه طلایی، پلن برنز/نقره/طلایی، کارت‌به‌کارت، یک ساعت برای فیش از همان مرورگر. شماره کارت را از حفظ نگو؛ بگو روی صفحه پرداخت است. ' +
  'مدت پلن فقط مدت پشتیبانی است؛ کانفیگ خودش قطع نمی‌شود. بعد از انجام شدن سفارش، کانفیگ فقط از دکمه طلایی «سرور های من». ' +
  'اگر سرور اختصاصی قطع شد و پشتیبانی مانده: از «سرور های من» روی همان سرور درخواست جایگزینی؛ یک‌به‌یک عوض می‌شود تا سقف پلن. اگر پشتیبانی تمام شده جایگزینی نیست. ' +
  'ورود سایت با کد ورود است نه ثبت‌نام. کد ورود را از کانال می‌گیرند؛ تو کد ورود را نمی‌دانی و نباید بسازی. ' +
  'پینگ روی سایت نیست. اشتراک/سابسکریپشن نداریم. اپ جدا نمی‌دهیم. تلگرام‌بات پشتیبانی نداریم؛ همین چت است و ۲۴ ساعته. ' +
  'کانفیگ نساز. UUID، رمز، آی‌پی، لینک vless/vmess نفرست. ادعا نکن فیلتر کشور را برمی‌داری. آدرس پنل ادمین نده. ' +
  'اگر کد سفارش در دانش زنده نیست و سؤال دربارهٔ سفارش/پشتیبانی/مانده است، مؤدب همان کد FL- را بخواه.';

export function getAI(env) {
  if (env && env.AI && typeof env.AI.run === 'function') return env.AI;
  if (env && env.ai && typeof env.ai.run === 'function') return env.ai;
  return null;
}

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
  return {
    open: true,
    tz: 'Asia/Tehran',
    days: '۲۴ ساعته',
    message: 'هوش مصنوعی ۲۴ ساعته است.',
    hour: tehranParts(d).hour,
    weekday: tehranParts(d).weekday,
  };
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

function looksPersian(s) {
  const fa = (String(s).match(/[\u0600-\u06FF]/g) || []).length;
  return fa >= 4;
}

export function aiText(out) {
  if (!out) return '';
  let t = '';
  if (typeof out === 'string') t = out;
  else if (out.response) t = String(out.response);
  else if (out.result) {
    if (typeof out.result === 'string') t = out.result;
    else if (out.result.response) t = String(out.result.response);
  } else {
    const choice = out.choices && out.choices[0];
    if (choice) {
      if (choice.message && choice.message.content) t = String(choice.message.content);
      else if (choice.text) t = String(choice.text);
      else if (choice.delta && choice.delta.content) t = String(choice.delta.content);
    } else if (Array.isArray(out) && out[0]) {
      if (typeof out[0] === 'string') t = out[0];
      else if (out[0].response) t = String(out[0].response);
    }
  }
  t = String(t || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

export async function runAI(env, history, extraSys) {
  const ai = getAI(env);
  if (!ai) {
    const err = new Error('NO_AI');
    err.code = 'NO_AI';
    throw err;
  }
  const sys = extraSys ? AI_SYS + '\n\n' + extraSys : AI_SYS;
  const messages = [{ role: 'system', content: sys }].concat(history);
  let last = null;
  for (const model of AI_MODELS) {
    try {
      const out = await ai.run(model, { messages, max_tokens: 480, temperature: 0.28 });
      const text = aiText(out);
      if (text && looksPersian(text)) return { text, model };
      if (text) last = new Error('not-fa:' + model);
      else last = new Error('empty:' + model);
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('AI_FAIL');
}

async function loadOrderByCode(db, code) {
  if (!code) return null;
  try {
    return await db.prepare('SELECT * FROM vip_orders WHERE code = ?').bind(code).first();
  } catch (e) {
    return null;
  }
}

function collectCodes(thread, messages) {
  const blobs = [thread && thread.vip_code, ...(messages || []).map((m) => m.body)];
  let found = '';
  blobs.forEach((b) => {
    const c = findOrderCode(b);
    if (c) found = c;
  });
  return found;
}

async function liveDeskContext(db, order, code) {
  const lines = ['--- دانش زنده (فقط از این اعداد استفاده کن) ---'];
  try {
    const on = (await getSetting(db, 'vip_enabled', '0')) === '1';
    lines.push('خرید_اختصاصی: ' + (on ? 'فعال' : 'فعلاً خاموش'));
    const copy = await getPlanCopy(db);
    const counts = await getPlanConfigs(db);
    const fa = { bronze: 'برنز', silver: 'نقره', gold: 'طلایی' };
    for (const id of ['bronze', 'silver', 'gold']) {
      const p = copy[id] || {};
      const price = PLANS[id] && PLANS[id].price;
      const bullets = Array.isArray(p.bullets) ? p.bullets.join('؛ ') : '';
      lines.push(
        fa[id] +
          ': عنوان=' +
          (p.title || fa[id]) +
          ' | کانفیگ=' +
          counts[id] +
          ' | قیمت_تومان=' +
          price +
          ' | زیرعنوان=' +
          (p.subtitle || '') +
          ' | ویژگی=' +
          bullets
      );
    }
  } catch (e) {
    lines.push('پلن‌ها از دیتابیس خوانده نشد.');
  }
  lines.push('--- سفارش این گفتگو ---');
  lines.push(orderFactsBlock(order, code));
  lines.push(
    'اگر کاربر کد FL- داد یا پرسید چقدر پشتیبانی مانده، از مانده_متن و پشتیبانی_تا دقیق بگو. لینک کانفیگ نده.'
  );
  return lines.join('\n');
}

export async function generateAiReply(env, db, threadId) {
  const now = Math.floor(Date.now() / 1000);
  const thread = await db.prepare('SELECT * FROM support_threads WHERE id = ?').bind(threadId).first();
  const { results } = await db
    .prepare('SELECT sender, body FROM support_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 12')
    .bind(threadId)
    .all();
  const raw = (results || []).slice().reverse();
  const hist = raw
    .filter((m) => m.body && !/جواب ندادم|وصل نیست|Retry deployment/i.test(String(m.body)))
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: String(m.body).slice(0, 700),
    }))
    .slice(-10);
  const lastUser = [...raw].reverse().find((m) => m.sender === 'user' && m.body) || { body: '' };
  const lastText = String(lastUser.body || '');
  const code = collectCodes(thread, raw);
  if (code && thread && thread.vip_code !== code) {
    try {
      await db.prepare('UPDATE support_threads SET vip_code = ? WHERE id = ?').bind(code, threadId).run();
    } catch (e) {}
  }
  const order = await loadOrderByCode(db, code);
  let hint = '';
  if (isDownAsk(lastText) && order && order.status === 'done' && supportUntilOf(order) > now) hint = 'replace';

  const extraSys = await liveDeskContext(db, order, code);
  let text = '';
  try {
    const ai = await runAI(env, hist, extraSys);
    text = ai.text;
  } catch (e) {
    if (code) text = orderDeskReply(order, code);
    else
      text =
        e && e.code === 'NO_AI'
          ? 'هوش مصنوعی هنوز وصل نیست. در کلادفلر: Settings → Bindings → Workers AI با اسم دقیقاً AI، بعد Retry deployment.'
          : 'الان نتونستم درست جواب بدم. یک‌بار دیگه کوتاه بپرس. اگر سؤال سفارش است کد FL- را بفرست.';
  }

  const info = await db
    .prepare('INSERT INTO support_messages (thread_id, sender, body, image, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(threadId, 'ai', text, '', now)
    .run();
  await db
    .prepare('UPDATE support_threads SET last_at = ?, last_preview = ?, unread_user = unread_user + 1 WHERE id = ?')
    .bind(now, clip(text, 80), threadId)
    .run();
  return {
    id: info.meta.last_row_id,
    sender: 'ai',
    body: text,
    image: '',
    created_at: now,
    hint,
  };
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
