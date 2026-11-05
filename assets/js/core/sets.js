/* ============================================================
   sets.js — what weight a new set should open with. Pure.

   The rule, in order:
     1. The last set you logged for THIS exercise in THIS session that has a
        weight. A new set copies the one before it. Nothing else is allowed
        to second-guess that (an earlier version eased every new set during
        a comeback week, so set 2 came up lighter than set 1).
     2. Otherwise what you lifted last time, eased down during a comeback week.
        An estimate (carried over from another machine) is shown as it is.
     3. Otherwise nothing.
   ============================================================ */

import { openingWeight } from './comeback.js';

const num = v => (v === null || v === undefined || v === '') ? null : (Number.isFinite(+v) ? +v : null);

/**
 * logged: this session's sets for the exercise, [{ w }]
 * prev:   store.lastByEx[name], { w, est? } or undefined
 * ramp:   comeback state ({ active, weights }) or falsy
 * returns { w, why }, why being 'session' | 'ease' | 'est' | 'last' | null
 */
export function openingFor({ logged = [], prev, ramp } = {}){
  for (let i = logged.length - 1; i >= 0; i--){
    const w = num(logged[i]?.w);
    if (w !== null) return { w, why:'session' };
  }
  const p = num(prev?.w);
  if (p === null) return { w:null, why:null };
  if (prev.est) return { w:p, why:'est' };
  if (ramp?.active) return { w: openingWeight(p, ramp.weights), why:'ease' };
  return { w:p, why:'last' };
}
