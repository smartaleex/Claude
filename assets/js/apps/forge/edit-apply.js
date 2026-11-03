/* ============================================================
   Training: making a change in plain words real, and taking it back.
   The context a change is checked against, applying a batch of changes,
   undoing the newest batch. The words and the rules are in
   core/training-edit.js; the sheet is in edit.js.
   ============================================================ */

import { uid } from '../../core/store.js';
import { SWAPS, estimateForGear, convertWeight, defaultStack } from '../../data/swaps.js';
import { gearFor } from '../../core/training-edit.js';
import { fuelData, phase, ramp, store, swapKey } from './state.js';

/* What the body is doing: the latest weight, and how much has really been eaten lately. */
export function bodyContext(){
  const f = fuelData();
  const ws = Object.entries(f.weights || {}).sort(([a], [b]) => a.localeCompare(b));
  const totals = Object.entries(f.days || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)
    .map(([, items]) => (items || []).reduce((n, i) => n + (+i.kcal || 0), 0)).filter(n => n > 0);
  return {
    kg: ws.length ? ws.at(-1)[1] : null,
    kcalAvg: totals.length >= 3 ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    kcalTarget: f.targets?.kcal || null,
  };
}

/* Everything benchmark() needs to know, as it is right now. */
export const contextNow = () => ({ days: phase().days, phase: phase(), ramp: ramp(), body: bodyContext() });

const isKnownOption = name => Object.values(SWAPS).some(g => g.options.some(o => o.name === name));

/** Apply changes. Swaps and stack settings go through the same saved maps the swap sheet uses (so
    weights convert and "back to original" still works); the rest are kept as a list laid over the
    program. Returns the saved batch. */
export function applyBatch(text, ops){
  const id = uid(), ph = phase().phase;
  const undo = { swaps: {}, custom: {}, stack: {} };
  store.update(s => {
    s.swaps = { ...(s.swaps || {}) };
    s.custom = { ...(s.custom || {}) };
    s.stack = { ...(s.stack || structuredClone(defaultStack)) };
    for (const o of ops){
      if (o.type === 'swap'){
        const key = swapKey(o.day, o.orig);
        undo.swaps[key] = s.swaps[key] ?? null;
        const cur = s.lastByEx[o.exercise]?.w;               // what is lifted on the exercise showing now
        let kg = null;
        if (isKnownOption(o.to)) kg = convertWeight(o.exercise, o.to, cur, s.custom);
        else {
          const gear = gearFor(o);
          const e = estimateForGear(o.exercise, gear, cur, s.custom);
          undo.custom[o.to] = s.custom[o.to] ?? null;
          s.custom[o.to] = { gear, idx: e.idx };
          kg = e.kg;
        }
        s.swaps[key] = o.to;
        if (kg != null && s.lastByEx[o.to]?.w == null) s.lastByEx[o.to] = { w: kg, est: true };   // an estimate, never mistaken for a lift
      } else if (o.type === 'stack'){
        undo.stack[o.gear] = s.stack[o.gear] ? { ...s.stack[o.gear] } : null;
        s.stack[o.gear] = { ...(s.stack[o.gear] || { unit: 'kg', ratio: 1 }), ...(o.unit && { unit: o.unit }), ...(o.ratio && { ratio: o.ratio }) };
      }
    }
    s.edits = [...(s.edits || []), { id, t: Date.now(), text, ops: ops.map(o => ({ ...o, phase: ph })), undo }];
  });
  return id;
}

/** Take back the newest batch: swaps and stack settings go back to what they were, the rest simply stops applying. */
export function undoLast(){
  const last = (store.get().edits || []).at(-1);
  if (!last) return null;
  store.update(s => {
    s.swaps = { ...(s.swaps || {}) };
    s.custom = { ...(s.custom || {}) };
    s.stack = { ...(s.stack || {}) };
    for (const [k, v] of Object.entries(last.undo?.swaps || {})) { if (v == null) delete s.swaps[k]; else s.swaps[k] = v; }
    for (const [name, v] of Object.entries(last.undo?.custom || {})) {
      if (v == null && !Object.values(s.swaps).includes(name)) delete s.custom[name]; else if (v != null) s.custom[name] = v;
    }
    for (const [g, v] of Object.entries(last.undo?.stack || {})) s.stack[g] = v ?? structuredClone(defaultStack)[g];
    s.edits = (s.edits || []).filter(e => e.id !== last.id);
  });
  return last;
}
