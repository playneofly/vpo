import { getSetting } from './vip.js';

export const AI_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.2-3b-instruct',
];

export const AI_SYS =
  'تو پشتیبان فارسی FILTERNET هستی. فقط فارسی بنویس. کوتاه باش: حداکثر ۴ جمله. ' +
  'انگلیسی، شعر، لیست طولانی و حرف اضافه ننویس. مستقیم جواب بده. ' +
  'سایت کانفیگ V2Ray می‌دهد: کپی یا QR، بعد در v2rayNG یا Hiddify از کلیپ‌بورد وارد می‌شود. ' +
  'لینک خام روی کارت عمومی نیست. خرید اختصاصی کارت‌به‌کارت است. ' +
  'مدت پلن فقط پشتیبانی است، کانفیگ خودکار قطع نمی‌شود. ' +
  'اگر سفارش انجام شده از دکمه طلایی «سرور های من» بالای صفحه بردارد. ' +
  'پینگ روی سایت نیست. کانفیگ نساز، UUID و رمز نخواه، ادعا نکن فیلتر را برمی‌داری. ' +
  'اگر نفهمیدی یک سوال کوتاه بپرس.';

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
  return fa >= 6;
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

export async function runAI(env, history) {
  const ai = getAI(env);
  if (!ai) {
    const err = new Error('NO_AI');
    err.code = 'NO_AI';
    throw err;
  }
  const messages = [{ role: 'system', content: AI_SYS }].concat(history);
  let last = null;
  for (const model of AI_MODELS) {
    try {
      const out = await ai.run(model, { messages, max_tokens: 220, temperature: 0.3 });
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

export async function generateAiReply(env, db, threadId) {
  const now = Math.floor(Date.now() / 1000);
  const { results } = await db
    .prepare('SELECT sender, body FROM support_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 8')
    .bind(threadId)
    .all();
  const hist = (results || [])
    .reverse()
    .filter((m) => m.body && !/جواب ندادم|وصل نیست|Retry deployment/i.test(String(m.body)))
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: String(m.body).slice(0, 500),
    }))
    .slice(-6);
  let text;
  try {
    const ai = await runAI(env, hist);
    text = ai.text;
  } catch (e) {
    text =
      e && e.code === 'NO_AI'
        ? 'هوش مصنوعی هنوز وصل نیست. در کلادفلر: Settings → Bindings → Workers AI با اسم دقیقاً AI، بعد Retry deployment.'
        : 'الان نتونستم درست جواب بدم. یک‌بار دیگه کوتاه بپرس.';
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
