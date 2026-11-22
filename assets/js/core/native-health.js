/* ============================================================
   native-health.js — Apple Health, as the rest of the app sees it.

   Inside the iPhone app, once Health has been connected in Settings:
   - the sleep and bodyweight sheets offer today's value from Health as a
     one-tap button (never filled in silently, so a wrong reading is easy to
     ignore);
   - a finished gym session is saved to Health as a strength workout, if
     that switch is on.
   In a browser, all of it does nothing.
   ============================================================ */

import * as native from './native.js';
import { nativePrefs } from './native-prefs.js';
import { haptic } from './ui.js';

const KINDS = {
  sleep:  { read: () => native.healthSleep(),  value: r => r?.hours, label: v => `Use Apple Health: ${v} h` },
  weight: { read: () => native.healthWeight(), value: r => r?.kg,    label: v => `Use Apple Health: ${v} kg` },
};

/** Add a "use the Health value" button under the number field `inputId`, if there is one to offer. */
export async function offerFromHealth(kind, inputId){
  if (!native.isNative()) return;
  const k = KINDS[kind];
  await nativePrefs.load();
  if (!k || !nativePrefs.get().health) return;

  const value = k.value(await k.read());
  const input = document.getElementById(inputId);
  if (!value || !input) return;                       // nothing in Health, or the sheet was closed

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.style.marginTop = '8px';
  btn.textContent = k.label(value);
  btn.addEventListener('click', () => { input.value = value; haptic(); });
  input.insertAdjacentElement('afterend', btn);
}

/** Save a finished session to Health, if connected and switched on. */
export async function saveSessionToHealth(startedAt, endedAt){
  if (!native.isNative() || !startedAt || !endedAt) return;
  await nativePrefs.load();
  const p = nativePrefs.get();
  if (!p.health || !p.workouts) return;
  const mins = (endedAt - startedAt) / 60000;
  if (mins < 5 || mins > 240) return;                 // same sanity window the session history uses
  await native.healthWorkout(startedAt, endedAt);
}
