// StorePrint Service Worker for PWA installability and caching
const CACHE_NAME = 'storeprint-pwa-v20';
const STATIC_ASSETS = [
  './',
  './index.html',
  './order.html',
  './order/index.html',
  './stock.html',
  './stock/index.html',
  './landing.html',
  './landing/index.html',
  './manifest.json',
  './order-manifest.json',
  './stock-manifest.json',
  './favicon.svg',
  './order-icon.svg',
  './order-favicon.svg',
  './order-icon-192.png',
  './order-icon-512.png',
  './order-icon-maskable-512.png',
  './order-apple-touch-icon.png',
  './stock-icon.svg',
  './stock-favicon.svg',
  './stock-icon-192.png',
  './stock-icon-512.png',
  './stock-icon-maskable-512.png',
  './stock-apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('SW pre-cache warning:', asset, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // CRITICAL: NEVER intercept cross-origin requests (Google Sheets, Firestore, CDNs, Proxies)
  // Let the browser handle external requests directly without SW interference!
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network First for local assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse =
          (await caches.match(event.request)) ||
          (await caches.match(event.request, { ignoreSearch: true }));
        if (cachedResponse) return cachedResponse;

        if (event.request.mode === 'navigate') {
          if (url.pathname.includes('/order')) {
            return (await caches.match('./order.html')) || (await caches.match('./order/index.html'));
          }
          if (url.pathname.includes('/stock')) {
            return (await caches.match('./stock.html')) || (await caches.match('./stock/index.html'));
          }
          if (url.pathname.includes('/landing')) {
            return (await caches.match('./landing.html')) || (await caches.match('./landing/index.html'));
          }
          return (await caches.match('./index.html')) || (await caches.match('./'));
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
