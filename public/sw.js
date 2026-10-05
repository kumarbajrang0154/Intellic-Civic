const CACHE_NAME = 'intellicivic-v2'; // upgraded from intellicivic-v1
const STATIC_ASSETS = [
  '/',
  '/citizen',
  '/citizen/complaints/new',
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

// Fetch Event — Network-first for API, Cache-first for Static Assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or non-http protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. API Calls — Never cache API responses (avoids caching personal/authenticated data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'You are currently offline. Please check your internet connection.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Static Assets & Pages — Cache-First with Network fallback (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // If HTML navigation request fails offline, fallback to cached offline route
          if (request.mode === 'navigate') {
            if (url.pathname.includes('/citizen/complaints/new')) {
              return caches.match('/citizen/complaints/new').then((res) => res || caches.match('/'));
            }
            if (url.pathname.includes('/citizen')) {
              return caches.match('/citizen').then((res) => res || caches.match('/'));
            }
            return caches.match('/');
          }
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
