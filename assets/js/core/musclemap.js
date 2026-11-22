/* ============================================================
   musclemap.js — a body, front and back, shaded by how many sets each
   muscle gets: for one session, or across the week.

   Counts use the same muscle names as everything else in Training
   (muscleOf in data/workouts.js), from the exercise actually being done,
   so a swap reshades the map straight away. Pure: counting and an SVG
   string; the colours come from .mm-* in app.css.
   ============================================================ */

import { muscleOf } from '../data/workouts.js';

/* Which painted regions each muscle group lights up. */
const REGIONS = {
  'Chest': ['chest'], 'Side delts': ['sidedelt'], 'Front delts': ['frontdelt'], 'Biceps': ['biceps'], 'Core': ['abs', 'obliques'],
  'Quads': ['quads'], 'Lats': ['lats'], 'Upper back': ['midback'], 'Rear delts & traps': ['reardelt', 'traps'], 'Traps': ['traps'],
  'Triceps': ['triceps'], 'Glutes': ['glutes'], 'Hamstrings': ['hamstrings'], 'Calves': ['calves'],
};

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

/** One side of the body as an SVG string. side: 'front' | 'back'. */
export function bodySVG(side, counts, scale){
  const r = regionSets(counts);
  const c = k => `mm-${shade(r[k] || 0, scale)}`;
  const two = (k, cx, cy, rx, ry) => `<g class="${c(k)}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/><ellipse cx="${100 - cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></g>`;
  let s = `<svg class="mm" viewBox="0 0 100 200" role="img" aria-label="${side === 'front' ? 'Front' : 'Back'} of the body, shaded by sets"><g class="mm-base">` +
    `<circle cx="50" cy="15" r="11"/><rect x="45" y="25" width="10" height="8" rx="3"/><rect x="36" y="36" width="28" height="70" rx="12"/>` +
    `<rect x="38" y="100" width="24" height="22" rx="9"/><ellipse cx="22" cy="112" rx="4" ry="6"/><ellipse cx="78" cy="112" rx="4" ry="6"/>` +
    `<ellipse cx="22" cy="93" rx="4" ry="12"/><ellipse cx="78" cy="93" rx="4" ry="12"/><ellipse cx="42" cy="192" rx="6" ry="4"/><ellipse cx="58" cy="192" rx="6" ry="4"/></g>`;
  if (side === 'front'){
    s += two('sidedelt', 28, 44, 7, 8) + two('frontdelt', 34, 49, 5, 7);
    s += `<g class="${c('chest')}"><path d="M37 42 Q43 38 49 41 L49 62 Q42 66 37 61 Z"/><path d="M63 42 Q57 38 51 41 L51 62 Q58 66 63 61 Z"/></g>`;
    s += two('biceps', 25, 68, 5, 11);
    s += `<g class="${c('abs')}"><rect x="44" y="67" width="12" height="35" rx="4"/></g>`;
    s += two('obliques', 39.5, 82, 3.5, 13) + two('quads', 42, 135, 8, 24) + two('calves', 42, 172, 4.5, 13);
  } else {
    s += `<g class="${c('traps')}"><path d="M50 27 L62 39 L56 58 L50 62 L44 58 L38 39 Z"/></g>`;
    s += two('reardelt', 28, 45, 7, 8) + two('triceps', 25, 68, 5, 12);
    s += `<g class="${c('lats')}"><path d="M37 50 L44 56 L46 84 Q40 82 37 76 Q34 64 37 50 Z"/><path d="M63 50 L56 56 L54 84 Q60 82 63 76 Q66 64 63 50 Z"/></g>`;
    s += `<g class="${c('midback')}"><rect x="45" y="60" width="10" height="16" rx="3"/></g>`;
    s += two('glutes', 43, 111, 8, 9) + two('hamstrings', 42, 140, 7, 20) + two('calves', 42, 172, 5.5, 13);
  }
  return s + '</svg>';
}
