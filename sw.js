/* =========================================================
   sw.js — service worker: cache the entire app shell so the
   app loads and works with no network connection at all.
   ========================================================= */

const CACHE_NAME = 'duka-ledger-v3';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './db.js',
  './utils.js',
  './lock.js',
  './app.js',
  './customers.js',
  './profile.js',
  './transactions.js',
  './reports.js',
  './statement.js',
  './settings.js',
  './about.js',
  './backup.js',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-192-maskable.png',
  './icon-384.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first strategy for all app-shell requests, with a network
// fallback that re-populates the cache. Navigation requests fall
// back to the cached index.html so the app still opens offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
