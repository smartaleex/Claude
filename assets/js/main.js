/* ============================================================
   Alex HQ: boot. The app shell lives in ./shell/ (registry of tools,
   router, home, more, settings); each tool is in ./apps/. This file only
   wires them together and starts the app.
   ============================================================ */

import { initAI } from './core/ai.js';
import { registerScreens, navigate } from './shell/router.js';
import { homeScreen } from './shell/home.js';
import { moreScreen } from './shell/more.js';
import { applyStoredLook } from './shell/look.js';
import { registerWorker } from './shell/worker.js';
import { toast } from './core/ui.js';

(async function boot(){
  applyStoredLook();
  registerScreens({ home: homeScreen, more: moreScreen });

  await initAI();
  await navigate(location.hash.slice(1) || 'home');

  // Tell the boot watchdog in index.html we made it.
  window.__booted?.();

  /* After boot, an uncaught error should not leave a silent, half-working
     screen. Say so once in a while; the data is untouched. */
  let lastSnag = 0;
  const snag = () => { if (Date.now() - lastSnag > 8000){ lastSnag = Date.now(); toast('Something went wrong. Your data is saved.'); } };
  window.addEventListener('error', e => { console.error(e.error || e.message); snag(); });
  window.addEventListener('unhandledrejection', e => { console.error(e.reason); snag(); });

  registerWorker();
})();
