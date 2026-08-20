/* Migbit Finance – Service Worker */
const CACHE_PREFIX = 'finance-static-';
const CACHE = `${CACHE_PREFIX}v36`;

const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './css/styles.pcolor.css',
  './css/mobile.css',
  './js/script.js',
  './js/toast.js',
  './js/ginasio.js',
  './js/alimentacao.js',
  './js/alimentacao-core.js',
  './js/alimentacao-recipes.js',
  './js/meditacao.js',
  './js/meditacao-recommender.js',
  './modules/ginasio.html',
  './modules/alimentacao.html',
  './modules/meditacao.html',
  './css/alimentacao.css',
  './css/meditacao.css',
  './data/meditations/buddhist.json',
  './data/meditations/asian-non-buddhist.json',
  './data/meditations/global-modern.json',
  './manifest.json',
  './icons/icon-192-v2.png',
  './icons/icon-512-v2.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))
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

  const networkFirstAsset = req.destination === 'script' || req.destination === 'style';
  if (networkFirstAsset) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        return new Response('', { status: 503, statusText: 'Asset unavailable' });
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
        if (fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        // fallback to cache if offline
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
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

    const cached = await cache.match(req);
    if (cached) return cached;

    // Otherwise go to network and cache it
    const fresh = await fetch(req);
    if (fresh && fresh.ok) await cache.put(req, fresh.clone());
    return fresh;
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  const raw = event.data?.text() || '';
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { body: raw };
    }
  }
  const title = payload.title || 'Ginásio';
  const options = {
    body: payload.body || 'Tens uma atualização no teu treino.',
    icon: './icons/icon-192-v2.png',
    badge: './icons/icon-192-v2.png',
    tag: payload.tag || 'gym-update',
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || './modules/ginasio.html',
      ...(payload.data || {})
    },
    actions: [{ action: 'dismiss', title: 'Fechar' }]
  };
  if (Array.isArray(payload.vibrate)) options.vibrate = payload.vibrate;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || './modules/ginasio.html';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const requestedUrl = new URL(url, self.location.origin);
    const targetUrl = requestedUrl.origin === self.location.origin
      ? requestedUrl.href
      : new URL('./modules/ginasio.html', self.registration.scope).href;
    const existing = allClients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if ('navigate' in existing && existing.url !== targetUrl) await existing.navigate(targetUrl);
      await existing.focus();
      return;
    }
    await clients.openWindow(targetUrl);
  })());
});
