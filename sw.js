/* ============================================================
   Alex HQ service worker.

   Strategy: cache-first for the app shell so it opens instantly and
   works with no signal, network-first for nothing (there is no API to
   talk to — AI calls go straight out and are never cached).

   Bump CACHE when you deploy or phones will keep serving the old build.
   ============================================================ */

const CACHE = 'alexhq-v8';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/tokens.css',
  './assets/css/app.css',
  './assets/icon-maskable.png',
  './assets/js/main.js',
  './assets/js/core/store.js',
  './assets/js/core/ui.js',
  './assets/js/core/ai.js',
  './assets/js/apps/fuel.js',
  './assets/js/apps/forge.js',
  './assets/js/apps/ledger.js',
  './assets/js/apps/shout.js',
  './assets/js/apps/clear.js',
  './assets/js/apps/vale.js',
  './assets/js/data/foods.js',
  './assets/js/data/workouts.js',
  './assets/js/data/spanish.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    // addAll rejects the whole batch if one file 404s, which would leave
    // the SW uninstalled. Add individually and tolerate misses.
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never touch AI traffic or anything cross-origin beyond fonts.
  if (url.origin !== location.origin && !url.host.includes('fonts.g')) return;

  e.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(res => {
        if (res.ok && url.origin === location.origin){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() =>
        // Offline and uncached: for a navigation, fall back to the shell
        // so the app still opens instead of showing the browser error.
        request.mode === 'navigate' ? caches.match('./index.html') : undefined
      );
    })
  );
});
