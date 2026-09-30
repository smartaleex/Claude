/* ============================================================
   timer.js — session clock and rest timer.

   Two design decisions carry most of the weight here.

   1. Everything is a timestamp, never a tick count. iOS suspends a
      backgrounded PWA's timers entirely, so a counter that adds one per
      interval drifts the moment you lock the phone between sets. Storing
      "rest ends at 14:32:10" and computing the remainder from the clock
      is correct whenever you come back to it.

   2. The dock lives OUTSIDE the view. Every tool re-renders by replacing
      its whole innerHTML, which would destroy a timer that lived inside
      it and restart the animation on every logged set. A single fixed
      element that nothing else touches survives all of that.

   What it cannot do, honestly: a web app has no way to buzz a locked
   phone. iOS gives Safari no vibration API, and Web Audio respects the
   silent switch (which is right — it is your phone). So the alert is
   visual and loud on screen, and the screen is kept awake while a
   session is open so you can see it.
   ============================================================ */

import { icon } from './icons.js';

/* ---------------- pure helpers (unit-tested) ---------------- */

/** '90s' -> 90, '2 min' -> 120, '0s' -> 0, junk -> 0. */
export function parseRest(s){
  const m = String(s ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return /^m/i.test(m[2] || '') ? Math.round(n * 60) : Math.round(n);
}

export function fmtClock(totalSec){
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`;
}

export const elapsedSec = (startedAt, now = Date.now()) =>
  startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

export const restRemaining = (rest, now = Date.now()) =>
  rest ? Math.ceil((rest.end - now) / 1000) : 0;

/* ---------------- state ---------------- */

const KEY = 'alexhq:rest';
let rest = null;            // { end, total, fired }
let opts = { auto:true, awake:true, beep:true };
let getSession = () => null;
let onOpenSettings = () => {};
let planMinutes = 0;
let dock = null, iv = null, lastMode = '';
let audio = null, wake = null;

try{
  const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  if (saved && saved.end > Date.now() - 30000) rest = saved;   // survives a reload mid-workout
}catch{}

const persist = () => { try{ rest ? sessionStorage.setItem(KEY, JSON.stringify(rest)) : sessionStorage.removeItem(KEY); }catch{} };

/* ---------------- public API ---------------- */

/** Forge calls this after every render with what the timer needs to know. */
export function configure({ session, options, minutes, openSettings }){
  getSession = () => session || null;
  if (options) opts = { ...opts, ...options };
  planMinutes = minutes || 0;
  if (openSettings) onOpenSettings = openSettings;
  sync();
}

export const restOptions = () => ({ ...opts });

/** Start (or restart) a rest countdown. Call from a tap so audio can unlock. */
export function startRest(seconds){
  if (!seconds || seconds <= 0) return;
  unlockAudio();
  rest = { end: Date.now() + seconds * 1000, total: seconds, fired: false };
  persist();
  lastMode = '';            // force the dock to redraw into "running"
  sync();
}

export function adjustRest(delta){
  if (!rest) return;
  rest.end += delta * 1000;
  rest.total = Math.max(1, rest.total + delta);
  rest.fired = false;
  if (restRemaining(rest) <= 0) return clearRest();
  persist(); lastMode = ''; sync();
}

export function clearRest(){ rest = null; persist(); lastMode = ''; sync(); }

/** Called when the session ends or is abandoned. */
export function stop(){ rest = null; persist(); hide(); }

/* ---------------- dock ---------------- */

function ensureDock(){
  if (dock) return dock;
  dock = document.createElement('div');
  dock.id = 'tmdock';
  dock.hidden = true;
  document.body.appendChild(dock);
  dock.addEventListener('click', e => {
    const el = e.target.closest('[data-tm]');
    if (!el) return;
    const a = el.dataset.tm;
    if (a === 'rest')  startRest(+el.dataset.s || 90);
    if (a === 'add')   adjustRest(+el.dataset.s);
    if (a === 'skip')  clearRest();
    if (a === 'clock') onOpenSettings();
  });
  return dock;
}

/** The forge view carries a marker saying whether a session is live. When
    another tool replaces the view the marker disappears and the dock
    hides itself — no cross-module hook needed. */
function sessionLive(){
  const m = document.getElementById('forge-root');
  return !!(m && m.dataset.active === '1' && getSession());
}

function sync(){
  if (!sessionLive()){ hide(); return; }
  ensureDock();
  dock.hidden = false;
  document.body.classList.add('has-dock');
  keepAwake(true);
  if (!iv) iv = setInterval(tick, 250);
  paint();
  tick();
}

function hide(){
  if (dock) dock.hidden = true;
  document.body.classList.remove('has-dock');
  if (iv){ clearInterval(iv); iv = null; }
  keepAwake(false);
  lastMode = '';
}

/* Redraw the structure only when the *mode* changes; the tick then just
   updates text and a CSS variable, so taps are never eaten by a rebuild. */
function paint(){
  const s = getSession();
  const rem = restRemaining(rest);
  const mode = !rest ? 'idle' : rem <= 0 ? 'done' : 'run';
  if (mode === lastMode) return;
  lastMode = mode;

  const left = `
    <button class="tm-clock" data-tm="clock" aria-label="Timer settings">
      <span class="tm-label">Session</span>
      <b id="tm-elapsed">0:00</b>
      ${planMinutes ? `<span class="tm-sub">of ~${planMinutes} min</span>` : ''}
    </button>`;

  let right;
  if (mode === 'idle'){
    right = `<button class="tm-go" data-tm="rest" data-s="90">${icon('repeat',16)} Start rest · 90s</button>`;
  } else if (mode === 'run'){
    right = `
      <div class="tm-rest">
        <span class="tm-label">Rest</span>
        <b id="tm-rest">0:00</b>
      </div>
      <div class="tm-btns">
        <button data-tm="add" data-s="-15" aria-label="15 seconds less">−15</button>
        <button data-tm="add" data-s="15" aria-label="15 seconds more">+15</button>
        <button data-tm="skip" aria-label="Skip rest">Skip</button>
      </div>`;
  } else {
    right = `<button class="tm-go done" data-tm="skip">Go — next set</button>`;
  }
  dock.dataset.mode = mode;
  dock.innerHTML = `<div class="tm-in">${left}<div class="tm-right">${right}</div></div>`;
}

function tick(){
  if (!sessionLive()){ hide(); return; }
  const s = getSession();
  const now = Date.now();

  const el = document.getElementById('tm-elapsed');
  if (el) el.textContent = fmtClock(elapsedSec(s?.startedAt, now));

  if (rest){
    const rem = restRemaining(rest, now);
    if (rem <= 0){
      if (!rest.fired){
        rest.fired = true; persist();
        // Only make noise if it ended just now. Coming back to the app
        // two minutes late and beeping about it is worse than silence.
        if (now - rest.end < 4000) alertDone();
      }
      paint();
    } else {
      paint();
      const r = document.getElementById('tm-rest');
      if (r) r.textContent = fmtClock(rem);
      dock.style.setProperty('--p', `${Math.min(100, (1 - rem / rest.total) * 100)}%`);
    }
  }
}

/* ---------------- alerts ---------------- */

function unlockAudio(){
  if (!opts.beep) return;
  try{
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  }catch{}
}

function alertDone(){
  try{ navigator.vibrate?.([220, 90, 220]); }catch{}      // ignored on iOS, works on Android
  if (!opts.beep || !audio) return;
  try{
    [0, 0.22].forEach(off => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audio.currentTime + off);
      g.gain.exponentialRampToValueAtTime(0.28, audio.currentTime + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + off + 0.16);
      o.connect(g); g.connect(audio.destination);
      o.start(audio.currentTime + off); o.stop(audio.currentTime + off + 0.18);
    });
  }catch{}
}

async function keepAwake(on){
  try{
    if (on && opts.awake && !wake && navigator.wakeLock){
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if ((!on || !opts.awake) && wake){
      await wake.release(); wake = null;
    }
  }catch{ wake = null; }
}

/* The OS drops the wake lock whenever the page is hidden, so take it
   back when the user returns — and re-sync so a rest that finished while
   the phone was locked shows as finished rather than frozen. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (sessionLive()){ keepAwake(true); tick(); }
});
