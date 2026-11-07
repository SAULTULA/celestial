/* ==================================================================
   CELESTIAL FM 106.7 — Service Worker v2
   Cachea los archivos base para funcionamiento offline.
   El stream de audio y SSE NO se interceptan (pasan directo a la red).
   ================================================================== */

const CACHE_NAME = 'celestial-fm-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/pwa.js',
  './manifest.json',
  './favicon.ico',
  './logo.png',
  './image/logo.png',
  './image/logo-192.png',
  './image/logo-512.png'
];

// -------- INSTALL: precachear con tolerancia a fallos --------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS_TO_CACHE.map(asset =>
          cache.add(asset).catch(err => {
            console.warn(`[SW] No se pudo precachear: ${asset}`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// -------- ACTIVATE: limpiar versiones anteriores --------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// -------- FETCH: estrategia segura y fluida --------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Audio stream, Zeno API y iTunes: PASO DIRECTO A LA RED (sin interceptar)
  // No usar respondWith() para evitar errores 503 sintéticos o buffering en streaming
  if (
    url.hostname.includes('zeno.fm') ||
    url.hostname.includes('surfernetwork.com') ||
    url.hostname.includes('itunes.apple.com') ||
    event.request.destination === 'audio' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/event-stream'))
  ) {
    return;
  }

  // 2. Favicon: resolución asegurada ante peticiones a raíz de dominio o ruta relativa
  if (url.pathname.endsWith('/favicon.ico')) {
    event.respondWith(
      caches.match('./favicon.ico').then((cached) => {
        return cached || fetch('./favicon.ico').catch(() => fetch('favicon.ico'));
      })
    );
    return;
  }

  // 3. Recursos locales del mismo origen: Cache First con Network Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // 4. Recursos externos estáticos
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 408, statusText: 'Request Timeout' }))
  );
});
