/* ============================================================
   Training: the shared state. The saved store, the screen state that is not saved (current tab, photo caches, ...), and the small
   derived facts every other file asks (which phase is running, is the comeback ramp on, which day is up next). Imports nothing from the
   other Training files, so it can never be part of an import cycle.
   ============================================================ */

import { Slice, today, dayKey, keyToDate, daysBetween } from '../../core/store.js';
import { defaultStack } from '../../data/swaps.js';
import { PHASES, kindLegs } from '../../data/workouts.js';
import * as cb from '../../core/comeback.js';
import * as coach from '../../core/coach.js';

export const store = new Slice('forge', {
  blockIndex: 1,          // Phase 2 was current in the original artifact
  blockStart: today(),
  sessions: {},           // id -> { day, dayKey, sets:{ exKey:[{w}] }, done }
  lastByEx: {},           // exercise name -> { w, est? }  (est = converted from another machine, not lifted yet)
  swaps: {},              // 'dayKey|program exercise' -> the alternative you chose; applies everywhere until reverted
  custom: {},             // equivalents you typed in: name -> { gear, idx }
  legs: 'kind',           // 'kind' = the back-friendly leg day, 'original' = the program as first written
  comeback: null,         // { start, weeks, off } the return-to-training ramp
  stack: structuredClone(defaultStack),   // how this gym labels cable and machine stacks
  activeId: null,
  timer: { auto:true, awake:true, beep:true },   // rest timer behaviour
  focus: {},              // muscle -> extra weekly sets, applied from a goal benchmark
  focusMeta: null,        // { t } when it was applied
  photoAI: false,         // has agreed to photos being sent to Gemini
  readings: { progress:null, benchmark:null },   // latest AI reads, so a view does not re-spend quota
});

/* A set is just a tick; weight is optional metadata on top. In the gym
   you want one tap, not a form. Reps live in the program, not the log. */
export const setWeight = s => (s && typeof s === 'object') ? s.w : null;

export const fmtSet = s => {
  const w = setWeight(s);
  return (w === null || w === undefined || w === '') ? '✓' : `${w}kg`;
};

/* The phase as it is run right now: the program with the back-friendly leg
   day swapped in unless that is switched off. Cached, because it is read
   constantly and must return the same objects between renders. */
const phaseCache = new Map();

export const phase = () => {
  const i = store.get().blockIndex % PHASES.length, kind = store.get().legs !== 'original';
  const k = `${i}|${kind}`;
  if (!phaseCache.has(k)){
    const base = PHASES[i];
    phaseCache.set(k, kind ? { ...base, days: base.days.map(kindLegs) } : base);
  }
  return phaseCache.get(k);
};

/* ---------------- comeback ramp ----------------
   After ten days away the first sessions back run at reduced volume and
   lighter weights, building to normal over three weeks. See core/comeback.js. */
export const ramp = () => cb.rampState(store.get().comeback, today());

export function checkComeback(){
  if (cb.shouldStartRamp(store.get().comeback, store.get().sessions, today())){
    store.update(s => { s.comeback = { start: today(), weeks: 3, off: false, auto: true }; });
  }
}

/* Sets to do for an exercise today: always the program's number (4, 3, 3 and
   so on). The comeback ramp eases in through reps and weight, never by
   cutting sets. Focus boosts wait until the ramp is over. */
export function targetSets(ex, dk, orig){
  const base = parseInt(ex.sets, 10) || 1;
  return ramp().active ? base : base + coach.bonusFor(ui.bonus, dk, orig ?? ex.name);
}

/* The reps to show: the program's range, or the eased-in version during the ramp. */
export function repsFor(ex){
  const r = ramp();
  return r.active ? cb.reviseReps(ex.reps, r.reps) : { text: String(ex.reps), changed: false };
}

export const weekGoal = () => cb.weekTarget(ramp());

export const weekInBlock = () => Math.floor(daysBetween(store.get().blockStart, today()) / 7) + 1;

export const dayOf = k => phase().days.find(d => d.key === k);

/* Phases run 6-8 weeks. Roll at 8 and loop back round to Phase 1. */
export function checkBlockRollover(){
  if (weekInBlock() > 8){
    store.update(s => {
      s.blockIndex = (s.blockIndex + 1) % PHASES.length;
      s.blockStart = today();
    });
    return true;
  }
  return false;
}

/** Next up = the day least recently trained. */
export function nextDay(){
  const done = Object.values(store.get().sessions).filter(s => s.done);
  let best = phase().days[0], bestTime = Infinity;
  for (const d of phase().days){
    const last = done.filter(s => s.day === d.key).map(s => s.dayKey).sort().at(-1);
    const t = last ? keyToDate(last).getTime() : 0;
    if (t < bestTime){ bestTime = t; best = d; }
  }
  return best;
}

export const doneCount = () => Object.values(store.get().sessions).filter(s => s.done).length;

export const doneToday = k => Object.values(store.get().sessions)
  .some(s => s.done && s.day === k && s.dayKey === today());

export function thisWeekCount(){
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mk = dayKey(monday);
  return Object.values(store.get().sessions).filter(s => s.done && s.dayKey >= mk).length;
}

export const SHORT = { d1:'Back/Bi', d2:'Chest/Tri', d3:'Legs', d4:'Delts/Arms' };

/* The exercise as it should appear right now: your chosen alternative if
   you picked one, else the program's own. The original name is kept in
   `orig` because the program's structure (focus boosts, swap keys) is
   defined by it. */
export const swapKey = (dk, name) => `${dk}|${name}`;

export const resolve = (ex, dk) => {
  const alt = store.get().swaps?.[swapKey(dk, ex.name)];
  return alt ? { ...ex, name: alt, orig: ex.name } : { ...ex, orig: ex.name };
};

export const fuelData = () => { try{ return JSON.parse(localStorage.getItem('alexhq:fuel') || '{}'); }catch{ return {}; } };

export const MAX_GOAL = 3;

/* Screen state that is not saved: which tab is open, the element we draw into, the photo caches and
   the little bits of in-progress UI. Everything that IS saved lives in `store` above. */
export const ui = {
  tab: 'plan',
  root: null,
  bonus: {},              // 'dayKey|exercise' -> extra sets from the focus boosts (rebuilt on every draw)
  photos: null,           // physique photos, oldest first (null = not loaded yet)
  goals: null,            // goal reference photos
  cmpA: null, cmpB: null, // chosen before / after photo ids (null = first / latest)
  askText: '',            // the question typed above "Send to Gemini"
  busy: null,             // 'progress' | 'benchmark' | null: an AI call is in flight
};

/* Any screen file can ask for a redraw; index.js decides what that means. */
let renderer = () => {};
export const setRenderer = fn => { renderer = fn; };
export const render = () => renderer();
