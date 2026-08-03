const CACHE_NAME = 'snatch-v2';
const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/core.js',
  '/js/boxers.js',
  '/js/payments.js',
  '/js/calendar.js',
  '/js/training.js',
  '/js/documents.js',
  '/logo.png',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls : réseau d'abord, pas de cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Fichiers statiques : cache d'abord, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
