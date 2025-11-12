/* Migbit Finance – Service Worker (DEV safe) */
const CACHE = 'finance-static-v12'; // ⬅️ bump this on each deploy

const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './js/script.js',
  './manifest.json'
  // Sem offline.html em DEV para evitar erros
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .catch(() => { /* evita falhar a instalação em dev */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // ignore CDNs

  const jsModule = sameOrigin && url.pathname.startsWith('/js/');
  if (jsModule) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        return new Response('', { status: 503, statusText: 'Module unavailable' });
      }
    })());
    return;
  }

  // Treat HTML/documents as network-first so new markup (like your KPI card)
  // shows up on the first reload after a deploy.
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith((async () => {
      try {
        // no-store to avoid intermediate caches
        const fresh = await fetch(req, { cache: 'no-store' });
        // optional: keep a copy in cache for offline
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        // fallback to cache if offline
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        return cached || new Response(
          '<h1>Offline</h1><p>Tenta novamente quando tiveres ligação.</p>',
          { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
        );
      }
    })());
    return;
  }

  // Static assets: cache-first with background fill
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Try cache first (ignoreSearch lets you use ?v=26 busting)
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    // Otherwise go to network and cache it
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  })());
});
