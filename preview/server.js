// سرور پیش‌نمایش محلی — فقط برای تست قبل از دیپلوی روی کلادفلر
// اجرا: node preview/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8787;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin9831';

// ساختار دیتابیس در حافظه (بدون داده پیش‌فرض)
let servers = [];
let nextId = 1;

// در حافظه: دیتابیس SQLite سبک
function q(sql, params) {
  if (sql.includes('SELECT')) {
    let rows;
    if (sql.includes('enabled = 1') && sql.includes('ORDER BY id DESC')) {
      rows = servers.filter(s => s.enabled).slice().sort((a, b) => b.id - a.id);
    } else if (sql.includes('ORDER BY id DESC')) {
      rows = servers.slice().sort((a, b) => b.id - a.id);
    } else {
      rows = servers.slice();
    }
    return { results: rows.map(s => Object.assign({}, s)) };
  }
  if (sql.startsWith('INSERT')) {
    const [name, country, protocol, link, enabled] = params;
    const row = { id: nextId++, name, country, protocol, link, enabled, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
    servers.push(row);
    return { meta: { last_row_id: row.id } };
  }
  if (sql.includes('UPDATE servers SET enabled = 1 - enabled')) {
    const id = params[0];
    const s = servers.find(x => x.id === id);
    if (s) s.enabled = 1 - s.enabled;
    return {};
  }
  if (sql.startsWith('UPDATE')) {
    const [name, country, protocol, link, enabled, id] = params;
    const s = servers.find(x => x.id === id);
    if (s) Object.assign(s, { name, country, protocol, link, enabled });
    return {};
  }
  if (sql.startsWith('DELETE')) {
    const id = params[0];
    servers = servers.filter(x => x.id !== id);
    return {};
  }
  return { results: [] };
}

function json(res, obj, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Credentials': 'true' });
  res.end(JSON.stringify(obj));
}

function hmacToken(exp) {
  return exp + '.' + crypto.createHmac('sha256', ADMIN_PASSWORD).update('vpo:' + exp).digest('hex');
}
function verifyCookie(cookieHeader) {
  if (!cookieHeader) return false;
  const m = cookieHeader.match(/(?:^|;\s*)vpo_admin=([^;]+)/);
  if (!m) return false;
  const [exp, hex] = m[1].split('.');
  if (!exp || !hex) return false;
  if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  const good = crypto.createHmac('sha256', ADMIN_PASSWORD).update('vpo:' + exp).digest('hex');
  return good === hex;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  const m = req.method.toUpperCase();

  // OPTIONS برای CORS
  if (m === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Credentials': 'true' }); res.end(); return; }

  // ---- API ----
  if (p === '/api/servers' && m === 'GET') {
    const r = q("SELECT id, name, country, protocol, link FROM servers WHERE enabled = 1 ORDER BY id DESC");
    return json(res, { ok: true, servers: r.results });
  }
  if (p === '/api/admin/login' && m === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', function () {
      let password = '';
      try { password = JSON.parse(body).password || ''; } catch (e) {}
      if (password !== ADMIN_PASSWORD) return json(res, { ok: false, error: 'رمز عبور اشتباه است' }, 401);
      const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'vpo_admin=' + hmacToken(exp) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800' });
      return res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (p === '/api/admin/logout' && m === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'vpo_admin=; HttpOnly; Path=/; Max-Age=0' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (p === '/api/admin/check' && m === 'GET') {
    return json(res, { ok: verifyCookie(req.headers.cookie) });
  }
  if (p === '/api/admin/servers' && (m === 'GET' || m === 'POST')) {
    if (!verifyCookie(req.headers.cookie)) return json(res, { ok: false, error: 'unauthorized' }, 401);
    if (m === 'GET') {
      const r = q("SELECT * FROM servers ORDER BY id DESC");
      return json(res, { ok: true, servers: r.results });
    }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', function () {
      try {
        const b = JSON.parse(body);
        if (!b.name || !b.link) return json(res, { ok: false, error: 'نام و لینک کانفیگ الزامی است' }, 400);
        const r = q('INSERT INTO servers (name, country, protocol, link, enabled) VALUES (?,?,?,?,?)', [b.name, b.country || '', b.protocol || 'vless', b.link, b.enabled === false ? 0 : 1]);
        return json(res, { ok: true, id: r.meta.last_row_id });
      } catch (e) { return json(res, { ok: false, error: String(e) }, 400); }
    });
    return;
  }
  const idMatch = p.match(/^\/api\/admin\/servers\/(\d+)$/);
  if (idMatch) {
    const id = parseInt(idMatch[1], 10);
    if (!verifyCookie(req.headers.cookie)) return json(res, { ok: false, error: 'unauthorized' }, 401);
    if (m === 'DELETE') { q('DELETE FROM servers WHERE id = ?', [id]); return json(res, { ok: true }); }
    if (m === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', function () {
        try {
          const b = JSON.parse(body);
          if (b.toggle) { q('UPDATE servers SET enabled = 1 - enabled WHERE id = ?', [id]); return json(res, { ok: true }); }
          if (!b.name || !b.link) return json(res, { ok: false, error: 'نام و لینک کانفیگ الزامی است' }, 400);
          q('UPDATE servers SET name = ?, country = ?, protocol = ?, link = ?, enabled = ? WHERE id = ?', [b.name, b.country || '', b.protocol || 'vless', b.link, b.enabled === false ? 0 : 1, id]);
          return json(res, { ok: true });
        } catch (e) { return json(res, { ok: false, error: String(e) }, 400); }
      });
      return;
    }
  }

  // ---- فایل‌های استاتیک ----
  let filePath = p === '/' ? '/index.html' : p;
  if (p === '/admin9831') filePath = '/admin9831.html';
  const full = path.join(ROOT, path.normalize(filePath));
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('✅ پیش‌نمایش FILTERNET روی http://localhost:' + PORT);
  console.log('   پنل عمومی:  http://localhost:' + PORT + '/');
  console.log('   پنل ادمین:  http://localhost:' + PORT + '/admin9831  (رمز: ' + ADMIN_PASSWORD + ')');
});
