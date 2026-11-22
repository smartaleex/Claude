/* ============================================================
   native-prefs.js — what the person has switched on in the iPhone app.

   Saved like everything else (so it is in a backup), but only ever read
   or changed through the iPhone-only block in Settings. Reminders are
   deliberately off until asked for: a reminder nobody chose is one more
   thing to feel behind on.
   ============================================================ */

import { Slice } from './store.js';

/* The daily reminders on offer. `body` is the whole message, so it is
   written to be plain and kind rather than urgent. */
export const REMINDERS = [
  { id:'meds', label:'Meds',            title:'Meds',      body:'Time for your meds.',                                   route:'day',  time:'08:00' },
  { id:'food', label:'Eat something',   title:'Food',      body:'Have you eaten? Something small counts.',               route:'fuel', time:'12:30' },
  { id:'mood', label:'Evening check-in', title:'Check-in', body:'How was today? A quick mood log takes ten seconds.',    route:'day',  time:'20:30' },
];

export const nativePrefs = new Slice('native', {
  reminders: Object.fromEntries(REMINDERS.map(r => [r.id, { on:false, time:r.time }])),
  health: false,        // Apple Health access was granted
  workouts: false,      // save finished gym sessions to Health
});

/** "08:30" -> { hour: 8, minute: 30 }. Anything that is not HH:MM becomes 08:00. */
export function parseTime(t){
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return { hour: 8, minute: 0 };
  return { hour: Math.min(23, +m[1]), minute: Math.min(59, +m[2]) };
}

export const reminderId = id => `alexhq-${id}`;
