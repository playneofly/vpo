/* FILTERNET — کش برای نت ضعیف / فیلتر. آپدیت: fn-shell-2 */
var VER = 'fn-shell-2';

function netTimeout(req, ms) {
  if (typeof AbortController === 'undefined') return fetch(req);
  var ctrl = new AbortController();
  var t = setTimeout(function () {
    try {
      ctrl.abort();
    } catch (e) {}
  }, ms);
  return fetch(req, { signal: ctrl.signal }).then(
    function (r) {
      clearTimeout(t);
      return r;
    },
    function (e) {
      clearTimeout(t);
      throw e;
    }
  );
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches
      .open(VER)
      .then(function (c) {
        return c.add('/').catch(function () {});
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            if (k !== VER) return caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  var p = url.pathname;
  if (p === '/sw.js') return;
  if (p.indexOf('/api/admin') === 0 || p.indexOf('/admin') === 0) return;
  if (p.indexOf('/api/support') === 0) return;
  if (p.indexOf('/api/vip/order') === 0 || p.indexOf('/api/vip/receipt') === 0 || p.indexOf('/api/vip/replace') === 0)
    return;

  if (p === '/api/servers' || p === '/api/vip/settings' || p === '/api/site') {
    event.respondWith(
      netTimeout(req, 4000)
        .then(function (res) {
          var copy = res.clone();
          caches.open(VER).then(function (c) {
            c.put(req, copy);
          });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            if (hit) return hit;
            return new Response('{"ok":false}', { headers: { 'Content-Type': 'application/json' } });
          });
        })
    );
    return;
  }

  if (p.indexOf('/api/site/photo/') === 0 || p === '/qr.js') {
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(VER).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        });
      })
    );
    return;
  }

  if (req.mode === 'navigate' || p === '/' || p === '/index.html') {
    event.respondWith(
      caches.match('/') .then(function (hit) {
        var net = netTimeout(req, 5000)
          .then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(VER).then(function (c) {
                c.put('/', copy);
              });
            }
            return res;
          })
          .catch(function () {
            return hit || caches.match('/');
          });
        if (hit) {
          event.waitUntil(net);
          return hit;
        }
        return net;
      })
    );
  }
});
