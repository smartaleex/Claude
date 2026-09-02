/* ============================================================
   Alex HQ service worker.

   Cache-first for the app shell so it opens instantly and works with no
   signal. Nothing else is cached — AI calls go straight out.

   Bump CACHE on every deploy or phones keep serving the old build.
   ============================================================ */

const CACHE = 'alexhq-v16';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/tokens.css',
  './assets/css/app.css',
  './assets/icon-maskable.png',
  './assets/js/main.js',
  './assets/js/core/icons.js',
  './assets/js/core/photos.js',
  './assets/js/core/store.js',
  './assets/js/core/ui.js',
  './assets/js/core/ai.js',
  './assets/js/apps/day.js',
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
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();

    /* Claiming an already-loaded page is what froze the app on the last
       update. The page was running the previous build's main.js, we then
       deleted the cache it came from and took over its fetches — so its
       dynamic imports resolved against the NEW build, and modules that
       did not exist in the old one (day.js, icons.js) simply failed.
       A failed ES module import kills the whole graph: blank screen,
       nothing to tap, no visible error.

       So tell the page instead of silently swapping the ground under it.
       It reloads once and old and new code never mix. */
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.postMessage({ type: 'sw-updated', cache: CACHE });
  })());
});

/** A real Response, never undefined — see the fetch handler. */
const offlineResponse = req =>
  new Response(
    req.destination === 'script' ? '/* offline */' : '',
    { status: 503, statusText: 'Offline', headers: { 'Content-Type':
      req.destination === 'script' ? 'application/javascript' : 'text/plain' } }
  );

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
      }).catch(async () => {
        // Offline and uncached. A navigation falls back to the shell so
        // the app still opens. Anything else MUST still return a
        // Response — returning undefined rejects the request, and for a
        // module import that takes the entire app down with it.
        if (request.mode === 'navigate'){
          return (await caches.match('./index.html')) || offlineResponse(request);
        }
        return offlineResponse(request);
      });
    })
  );
});

/* Lets the app force an update from Settings without reinstalling. */
self.addEventListener('message', e => {
  if (e.data?.type === 'skip-waiting') self.skipWaiting();
});
