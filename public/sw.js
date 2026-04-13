// Service Worker for Lado Cristao - Cache First strategy for static assets
const CACHE_NAME = 'tess-v1';
const STATIC_ASSETS = ['/logo.webp', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Cache first for static assets (images, CSS, JS with hashes)
  if (url.pathname.startsWith('/_astro/') || url.pathname.match(/\.(webp|png|svg|ico|woff2)$/)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(e.request, c)); }
      return res;
    })));
    return;
  }

  // Stale-while-revalidate for HTML pages
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(e.request, c)); }
        return res;
      });
      return cached || fetched;
    }));
    return;
  }

  // Network first for API calls
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
