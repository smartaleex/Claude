/* ============================================================
   native.js — the doorway to the iPhone app.

   Alex HQ also ships as an iPhone app (see ios/). Inside it, this page runs
   in a web view and can ask the phone for things a web page cannot do: real
   haptics, reminders that fire with the app closed, Apple Health, Face ID,
   a lock-screen rest timer, a home-screen widget.

   In a normal browser every function here does nothing and returns null, so
   no other file needs to ask "am I in the app?". The matching Swift is
   ios/AlexHQ/NativeBridge.swift; to add a feature, add a case there and a
   wrapper here.
   ============================================================ */

const bridge = () => (typeof window !== 'undefined' ? window.webkit?.messageHandlers?.native : null);

/** True only inside the iPhone app. */
export const isNative = () => typeof window !== 'undefined' && !!window.__NATIVE__ && !!bridge();

/** Ask the phone to do something and wait for its answer. Null if not native or it failed. */
export async function send(cmd, args = {}){
  if (!isNative()) return null;
  try{ return await bridge().postMessage({ cmd, ...args }); }
  catch(e){ console.warn('native', cmd, e?.message || e); return null; }
}

/** Fire and forget, for things like a tap. */
function fire(cmd, args = {}){
  if (!isNative()) return;
  try{ bridge().postMessage({ cmd, ...args }).catch(() => {}); }catch{ /* never break the page */ }
}

/* ---------------- feel ---------------- */

/** style: selection | light | medium | heavy | success | warning | error */
export const haptic = style => fire('haptic', { style });

/** Tell the phone the page's colour so the frame and status bar match. */
export const theme = (bg, dark) => fire('theme', { bg, dark });

/* ---------------- text and files ---------------- */

/** Copy text. Works in a browser too (where the page is allowed to). */
export async function copyText(text){
  if (isNative()) return !!(await send('copy', { text }));
  try{ await navigator.clipboard.writeText(text); return true; }catch{ return false; }
}

/** Open the share sheet with a text file (Save to Files, AirDrop, Mail). */
export const shareFile = (name, text) => send('share', { name, text });

/** Quietly keep a copy in the app's Files folder. */
export const saveBackup = (name, text) => send('backup', { name, text });

/* ---------------- reminders ---------------- */

export const info = () => send('info');
export const askNotifications = () => send('notify.permission');
export const scheduleDaily = r => send('notify.daily', r);
export const cancelReminders = ids => send('notify.cancel', { ids });

/* ---------------- rest timer ---------------- */

/** A notification for when the rest ends, plus the lock-screen countdown. */
export const restStart = (seconds, label) => fire('rest.start', { seconds, label });
export const restStop = () => fire('rest.stop');

/* ---------------- Apple Health ---------------- */

export const healthConnect = () => send('health.connect');
export const healthSleep = () => send('health.sleep');
export const healthWeight = () => send('health.weight');
export const healthWorkout = (start, end) => send('health.workout', { start, end });

/* ---------------- lock and widget ---------------- */

export const setLock = enabled => send('lock.set', { enabled });

/** The numbers the home-screen widget shows: [{ label, value, sub }]. */
export const snapshot = (tiles, headline = 'Alex HQ') => fire('snapshot', { tiles, headline });
