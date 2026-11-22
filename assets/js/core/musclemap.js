/* ============================================================
   musclemap.js — a body, front and back, shaded by how many sets each
   muscle gets: for one session, or across the week.

   Counts use the same muscle names as everything else in Training
   (muscleOf in data/workouts.js), from the exercise actually being done,
   so a swap reshades the map straight away. Pure: counting and an SVG
   string; the colours come from .mm-* in app.css.
   ============================================================ */

import { muscleOf } from '../data/workouts.js';
import { FRONT, BACK, OUTLINE, VIEWBOX } from './anatomy.js';

/* Which painted regions each muscle group lights up. */
const REGIONS = {
  'Chest': ['chest'], 'Side delts': ['sidedelt'], 'Front delts': ['frontdelt'], 'Biceps': ['biceps'], 'Core': ['abs', 'obliques'],
  'Quads': ['quads'], 'Lats': ['lats'], 'Upper back': ['midback'], 'Rear delts & traps': ['reardelt', 'traps'], 'Traps': ['traps'],
  'Triceps': ['triceps'], 'Glutes': ['glutes'], 'Hamstrings': ['hamstrings'], 'Calves': ['calves'],
};
/* Regions the program counts; the rest (forearms, neck, shins...) are drawn but never shaded. */
const COUNTED = new Set(Object.values(REGIONS).flat());

/** Sets per muscle group for a list of days. nameOf gives the exercise as it is done (after swaps),
    setsOf the sets it gets. */
export function countSets(days, nameOf = ex => ex.name, setsOf = ex => parseInt(ex.sets, 10) || 0){
  const out = {};
  for (const d of days) for (const ss of d.supersets) for (const ex of ss.exercises){
    const m = muscleOf(nameOf(ex, d));
    if (m !== 'Other') out[m] = (out[m] || 0) + setsOf(ex, d);
  }
  return out;
}

/** Shade 0 (untouched) to 4 (heavy), against a scale: about 10 sets is a full session for a muscle, 20 a full week. */
export const shade = (v, scale) => !v ? 0 : v / scale < 0.25 ? 1 : v / scale < 0.5 ? 2 : v / scale < 0.8 ? 3 : 4;

function regionSets(counts){
  const r = {};
  for (const [m, n] of Object.entries(counts)) for (const k of REGIONS[m] || []) r[k] = (r[k] || 0) + n;
  return r;
}

/* The deltoid is one shape per view: shade it by the busier head that view shows. */
const MERGED = { 'delts-front': ['frontdelt', 'sidedelt'], 'delts-back': ['reardelt', 'sidedelt'] };

/** One side of the body as an SVG string. side: 'front' | 'back'. Shapes from core/anatomy.js. */
export function bodySVG(side, counts, scale){
  const r = regionSets(counts);
  const cls = k => k === 'skin' ? 'mm-skin'
    : MERGED[k] ? `mm-${Math.max(...MERGED[k].map(m => shade(r[m] || 0, scale)))}`
    : COUNTED.has(k) ? `mm-${shade(r[k] || 0, scale)}` : 'mm-x';
  const shapes = (side === 'front' ? FRONT : BACK).map(([k, d]) => `<path class="${cls(k)}" d="${d}"/>`).join('');
  return `<svg class="mm" viewBox="${VIEWBOX[side]}" role="img" aria-label="${side === 'front' ? 'Front' : 'Back'} of the body, shaded by sets">` +
    `<path class="mm-base" d="${OUTLINE[side]}"/>${shapes}</svg>`;
}
