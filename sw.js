/* =========================================================
   sw.js — service worker: cache the entire app shell so the
   app loads and works with no network connection at all.
   ========================================================= */

const CACHE_NAME = 'duka-ledger-v11';

const CORE_ASSETS = [
  './',
  './index.html',
  './privacy.html',
  './terms.html',
  './manifest.json',
  './style.css',
  './db.js',
  './utils.js',
  './lock.js',
  './welcome.js',
  './sound.js',
  './stats.js',
  './app.js',
  './customers.js',
  './profile.js',
  './transactions.js',
  './reports.js',
  './statement.js',
  './settings.js',
  './about.js',
  './notifications.js',
  './history.js',
  './backup.js',
  './google-drive.js',
  './referral.js',
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
  );
  // Note: no self.skipWaiting() here on purpose. On a brand-new install
  // (no prior service worker) the browser activates this worker right
  // away regardless. On an *update*, this lets the new worker sit in
  // "waiting" until the person taps "Update Now" in the app, which
  // posts SKIP_WAITING below — that's what shows the update banner
  // instead of silently swapping the app out from under them.
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
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API routes are dynamic (live counters, Google Drive calls) — never
  // cache-first these, always hit the network. Also true for calls to
  // Google's own domains during the Drive backup flow.
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('google.com')) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ ok: false, error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

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
