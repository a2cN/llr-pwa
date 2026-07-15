const CACHE_NAME = 'llr-v2';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.hostname === 'api.github.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for documents AND the manifest, so manifest changes
  // (e.g. share_target) reach the browser without a cache-name bump.
  if (e.request.mode === 'navigate' || e.request.destination === 'document'
      || url.pathname.endsWith('/manifest.json')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
