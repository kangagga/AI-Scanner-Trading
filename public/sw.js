/**
 * Service worker — caches the app shell so the control center opens offline.
 * API/bot traffic is NEVER cached: stale bot status would be misleading.
 */

const CACHE = 'aist-control-center-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './css/app.css',
  './js/app.js',
  './js/core/api.js',
  './js/core/store.js',
  './js/core/format.js',
  './js/core/demo.js',
  './js/ui/shell.js',
  './js/ui/components.js',
  './js/ui/charts.js',
  './js/screens/dashboard.js',
  './js/screens/scanner.js',
  './js/screens/signals.js',
  './js/screens/paper.js',
  './js/screens/market.js',
  './js/screens/history.js',
  './js/screens/performance.js',
  './js/screens/strategy.js',
  './js/screens/monitor.js',
  './js/screens/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never serve bot/API data from cache.
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

  // Network-first for navigation so a redeploy is picked up immediately.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
    })
  );
});
