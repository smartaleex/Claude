/* ============================================================
   library.js — every exercise the app knows, in one list.

   The swap sheet used to offer only alternates of the same movement. But the
   gym decides what is free: when the assisted pull-up machine is taken, a
   machine iso-lateral row might be, and that is a different movement. So this
   is the whole library (the listed alternates, every exercise in the program,
   and the ones you typed in yourself), grouped by the muscle it trains, with
   a search that understands "iso lateral" and "db".

   Pure data and rules, no screens.
   ============================================================ */

import { SWAPS, GEAR_STYLE, patternOf, gearOf, loadIndex, plainName } from '../data/swaps.js';
import { PHASES, kindLegs, muscleOf } from '../data/workouts.js';

/* The order muscles are listed in: the ones that build the V-taper first. */
export const MUSCLE_ORDER = ['Lats', 'Upper back', 'Chest', 'Side delts', 'Rear delts & traps', 'Front delts', 'Traps',
  'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Other'];

const letters = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
export const patternLabel = p => SWAPS[p]?.label || 'Other movement';

/** The same words however you say them: "dumbbell" = "db", "iso lateral" = "iso-lateral". */
function words(s){
  return String(s).toLowerCase().replace(/\bdumb-?bells?\b/g, 'db').replace(/\bbarbells?\b/g, 'bb')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/** What the library knows about one exercise name. Works for any name, listed or not. */
export function factsFor(name, custom = {}){
  const inLib = Object.values(SWAPS).flatMap(g => g.options).find(o => o.name === name);
  const pattern = patternOf(name);
  return {
    name,
    muscle: muscleOf(name),
    pattern,
    patternLabel: patternLabel(pattern),
    gear: custom[name]?.gear || inLib?.gear || gearOf(name, custom) || null,
    note: inLib?.note || '',
    known: !!inLib,                       // listed in the library, so its load index is known
    idx: custom[name]?.idx ?? loadIndex(name, custom),
  };
}

/** Every exercise, once: the listed alternates, the program's own, and yours. */
export function libraryList(custom = {}){
  const seen = new Set(), out = [];
  const add = (name, source) => {
    const key = letters(plainName(name)) + letters(name);
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ ...factsFor(name, custom), source });
  };
  for (const g of Object.values(SWAPS)) for (const o of g.options) add(o.name, 'library');
  for (const ph of PHASES) for (const day of ph.days.concat(ph.days.map(kindLegs))) for (const ss of day.supersets) for (const ex of ss.exercises) add(ex.name, 'program');
  for (const name of Object.keys(custom)) add(name, 'yours');
  return out;
}

/** The list grouped by muscle, in a sensible order, for a dropdown. */
export function libraryGroups(list){
  const by = {};
  for (const it of list) (by[it.muscle] ||= []).push(it);
  return MUSCLE_ORDER.filter(m => by[m]).map(m => ({
    muscle: m,
    items: by[m].sort((a, b) => a.patternLabel.localeCompare(b.patternLabel) || a.name.localeCompare(b.name)),
  }));
}

/** Narrow the list to what was typed: every word typed has to be in the name, muscle or movement. */
export function searchLibrary(list, query){
  const q = words(query);
  if (!q.length) return list;
  return list.filter(it => {
    const hay = new Set([...words(it.name), ...words(it.muscle), ...words(it.patternLabel), ...words(GEAR_STYLE[it.gear]?.label || '')]);
    // whole words always; a prefix only from three letters, so "up" in "pull up" does not find "upper back"
    return q.every(w => hay.has(w) || (w.length >= 3 && [...hay].some(h => h.startsWith(w))));
  });
}
