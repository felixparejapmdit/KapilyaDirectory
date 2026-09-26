// Bump on caching-strategy changes: activate() deletes every other cache.
const CACHE_NAME = 'kapilya-cache-v2';
const STATIC_ASSETS = ['/', '/near-me', '/districts', '/saved', '/manifest.json', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

/** Network first (fresh data and new deployments), falling back to the cached copy offline. */
function networkFirst(request, offlineFallback) {
  return caches.open(CACHE_NAME).then((cache) =>
    fetch(request)
      .then((response) => {
        if (response.status === 200) cache.put(request, response.clone());
        return response;
      })
      .catch(() => cache.match(request).then((hit) => hit || (offlineFallback ? cache.match(offlineFallback) : undefined)))
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Admin-only visitor data: never kept in the offline cache.
  if (url.pathname.startsWith('/api/access-log')) return;

  // Directory data and pages: always try the network so syncs and redeploys show up right away.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, '/'));
    return;
  }

  // Hashed build assets never change: cache first.
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
    )
  );
});
