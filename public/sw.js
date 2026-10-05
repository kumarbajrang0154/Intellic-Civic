const CACHE_NAME = 'intellicivic-v3'; // upgraded cache version
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install Event — Pre-cache App Shell & Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or non-http protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. API Calls & Next.js internal calls — Never cache or intercept; let browser handle directly
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return;
  }

  // 2. Navigation requests — Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        let cached = null;
        if (url.pathname.includes('/citizen/complaints/new')) {
          cached = await caches.match('/citizen/complaints/new');
        }
        if (!cached) {
          cached = await caches.match('/');
        }
        return (
          cached ||
          new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline - IntelliCivic</title></head><body><div style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Offline</h2><p>You are currently offline. Please check your internet connection.</p></div></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        );
      })
    );
    return;
  }

  // 3. Static Assets — Cache-First with Network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});

// 3. Background Sync (where supported by browser)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-complaints') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC' });
        });
      })
    );
  }
});
