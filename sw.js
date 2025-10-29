/* Migbit Finance – Service Worker (DEV safe) */
const CACHE = 'finance-static-v6'; 

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

  // Só trata pedidos da mesma origem; ignora CDNs (Firebase, etc.)
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (!sameOrigin) return;

  event.respondWith((async () => {
    // 1) cache-first
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      // 2) rede
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      // 3) fallback suave só para navegação
      if (req.mode === 'navigate') {
        return new Response(
          '<h1>Offline</h1><p>Tenta novamente quando tiveres ligação.</p>',
          { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
        );
      }
      // deixa a falha propagar (útil em dev)
      throw err;
    }
  })());
});
