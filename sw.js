var CACHE = 'smartview-v1';
var META = 'smartview-meta';
var VIDEOS = ['/feijao.mp4', '/bt.mp4', '/adegabaronesa.mp4'];
var CHECK_MS = 24 * 60 * 60 * 1000; // 24h

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.all(VIDEOS.map(function(url) {
        return fetch(url).then(function(r) {
          if (r.ok) return cache.put(url, r);
        }).catch(function() {});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (!url.pathname.endsWith('.mp4')) return;

  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        if (cached) {
          // serve do cache e verifica atualização em background
          e.waitUntil(checkUpdate(cache, e.request, cached));
          return cached;
        }
        return fetch(e.request).then(function(r) {
          if (r.ok) cache.put(e.request, r.clone());
          return r;
        });
      });
    })
  );
});

function checkUpdate(cache, request, cached) {
  return getLastCheck(request.url).then(function(last) {
    var now = Date.now();
    if (last && now - last < CHECK_MS) return; // ainda dentro das 24h
    return setLastCheck(request.url, now).then(function() {
      var headers = new Headers();
      var etag = cached.headers.get('ETag');
      var lm = cached.headers.get('Last-Modified');
      if (etag) headers.set('If-None-Match', etag);
      if (lm) headers.set('If-Modified-Since', lm);
      return fetch(request, { headers: headers }).then(function(r) {
        if (r.status === 200) cache.put(request, r); // nova versão
        // 304 = sem mudança, mantém cache
      }).catch(function() {});
    });
  });
}

function getLastCheck(key) {
  return caches.open(META).then(function(c) {
    return c.match(key).then(function(r) {
      return r ? r.text().then(Number) : null;
    });
  });
}

function setLastCheck(key, ts) {
  return caches.open(META).then(function(c) {
    return c.put(key, new Response(String(ts)));
  });
}
