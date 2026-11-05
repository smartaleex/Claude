/* ============================================================
   Shell: the service worker (offline + updates). The worker itself is
   /sw.js; this file only registers it and handles "a new build arrived".
   ============================================================ */

export function registerWorker(){
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;

  /* updateViaCache:'none' matters more than it looks. By default the
     browser may serve sw.js itself from the HTTP cache for up to 24
     hours, so a new build can sit on the server all day while the phone
     never notices. This forces a real byte-check every time. */
  navigator.serviceWorker.register('./sw.js', { updateViaCache:'none' })
    .then(reg => {
      reg.update().catch(() => {});
      /* An installed PWA resumed from the app switcher never performs a
         navigation, so nothing would otherwise trigger an update check.
         Check whenever it comes back to the foreground. */
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    })
    .catch(() => {});

  /* When a new build activates it takes over this already-running page.
     Reloading once is the only way to guarantee old and new code never
     mix — that mixing is what froze the app on the previous update.
     The guard stops a reload loop if anything ever goes wrong here. */
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data?.type !== 'sw-updated') return;
    try{
      if (sessionStorage.getItem('alexhq:reloaded') === ev.data.cache) return;
      sessionStorage.setItem('alexhq:reloaded', ev.data.cache);
    }catch{}
    location.reload();
  });
}
