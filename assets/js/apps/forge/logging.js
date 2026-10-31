/* ============================================================
   Training: logging sets. One tap per set, 'log all as planned', and the weight pad. The weight a new set opens with comes from
   core/sets.js, so the rule is testable.
   ============================================================ */

import { esc, round, openSheet, closeSheet, bindActions, haptic } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { gearOf, stackToKg, kgToStack, stackConfigFor } from '../../data/swaps.js';
import * as timer from '../../core/timer.js';
import { openingFor as nextWeight } from '../../core/sets.js';
import { dayOf, ramp, render, setWeight, store } from './state.js';

/* The weight a new set for this exercise should open with (see core/sets.js). */
export function openingFor(exName, key){
  const sess = store.get().sessions[store.get().activeId];
  return nextWeight({ logged: sess?.sets[key] || [], prev: store.get().lastByEx[exName], ramp: ramp() });
}

export function fillSets(key, exName, count){
  const { w } = openingFor(exName, key);
  store.update(s => {
    const sess = s.sessions[s.activeId];
    if (!sess.sets[key]) sess.sets[key] = [];
    for (let i = 0; i < count; i++) sess.sets[key].push({ w });
    if (w !== null) s.lastByEx[exName] = { w };
  });
  haptic(14);
  render();
  // The last set just logged is the one a rest follows.
  if (store.get().timer.auto){
    const sess = store.get().sessions[store.get().activeId];
    const [si, ei] = key.split('-').map(Number);
    const ex = dayOf(sess?.day)?.supersets[si]?.exercises[ei];
    const secs = timer.parseRest(ex?.rest);
    if (secs > 0) timer.startRest(secs); else timer.clearRest();
  }
}

export function addSet(key, exName){
  const { w } = openingFor(exName, key);
  store.update(s => {
    const sess = s.sessions[s.activeId];
    if (!sess.sets[key]) sess.sets[key] = [];
    sess.sets[key].push({ w });
  });
  haptic();
  render();

  /* Start the exercise's own rest. A rest of 0s means "straight into the
     next movement" (a superset), so nothing should be counting down — and
     any countdown still running from before is stale. */
  if (store.get().timer.auto){
    const sess = store.get().sessions[store.get().activeId];
    const [si, ei] = key.split('-').map(Number);
    const ex = dayOf(sess?.day)?.supersets[si]?.exercises[ei];
    const secs = timer.parseRest(ex?.rest);
    if (secs > 0) timer.startRest(secs); else timer.clearRest();
  }
}

/* The weight sheet has its own number pad, like the Cryptic keyboard.

   Typing a weight with the phone's keyboard meant a sheet fighting a
   keyboard in the middle of a workout: the keyboard covers the screen, iOS
   pans the page, and on closing it can leave the tab bar and timer stranded
   halfway up the screen. A pad drawn in the sheet has none of that, because
   the real keyboard never opens. It is also faster: big keys, one hand. */
export function editSet(key, i, exName){
  const cur = store.get().sessions[store.get().activeId]?.sets[key]?.[i];
  const gear = gearOf(exName, store.get().custom);
  const sc = stackConfigFor(gear, store.get().stack);      // null unless this gym's stack differs from the real load
  const curKg = setWeight(cur);
  const shown = curKg == null ? '' : String(sc ? kgToStack(curKg, sc) : curKg);
  const step = sc ? (sc.unit === 'lb' ? 5 : 2.5) : 2.5;
  const sets = store.get().sessions[store.get().activeId]?.sets[key] || [];
  let buf = shown;
  let fresh = shown !== '';          // the first digit replaces what is there; a nudge or backspace edits it

  const KEYS = ['1','2','3','4','5','6','7','8','9','.','0','del'];
  openSheet(`
    <h2>${esc(exName)}</h2>
    <p class="sub">Set ${i+1}. Weight is optional, save it empty if you would rather just tick it off.</p>
    <div class="lbl" style="text-align:center">${sc ? `What the stack reads (${sc.unit})` : 'Weight (kg)'}</div>
    <div style="display:flex;gap:8px;align-items:stretch;margin-top:8px">
      <button class="btn btn-plain" style="flex:none;width:64px;font-size:22px" data-act="dec" aria-label="Less">−</button>
      <div class="pad-val" id="s-w" aria-live="polite"></div>
      <button class="btn btn-plain" style="flex:none;width:64px;font-size:22px" data-act="inc" aria-label="More">+</button>
    </div>
    <div class="tiny muted" id="s-hand" style="margin-top:8px;text-align:center;min-height:18px"></div>
    <div class="pad">
      ${KEYS.map(k => `<button data-act="pad" data-k="${k}" aria-label="${k === 'del' ? 'Delete' : k}">${k === 'del' ? icon('back', 22) : k}</button>`).join('')}
    </div>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="save">Save</button>
    <div class="${sets.length > 1 ? 'grid2' : ''}" style="margin-top:8px;gap:8px">
      ${sets.length > 1 ? `<button class="btn btn-plain btn-sm" data-act="saveall">Save for all ${sets.length}</button>` : ''}
      <button class="btn btn-danger btn-sm ${sets.length > 1 ? '' : 'block'}" data-act="rm">Remove this set</button>
    </div>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  /* What is typed is what you read off the stack; what is stored is the
     weight at your hand, so every comparison and conversion stays honest. */
  const toKg = raw => {
    const t = String(raw).trim();
    if (t === '' || t === '.') return null;
    const n = parseFloat(t);
    if (!Number.isFinite(n)) return null;
    return sc ? stackToKg(n, sc) : n;
  };
  const draw = () => {
    const el = document.getElementById('s-w'); if (!el) return;
    el.textContent = buf === '' ? '—' : buf;
    el.classList.toggle('empty', buf === '');
    const h = document.getElementById('s-hand');
    const kg = toKg(buf);
    if (h) h.textContent = sc && kg != null ? `That is ${round(kg, 2)} kg at your hand` : '';
  };
  draw();

  const press = k => {
    if (k === 'del'){ buf = fresh ? '' : buf.slice(0, -1); fresh = false; }
    else {
      if (fresh){ buf = ''; fresh = false; }
      if (k === '.' && buf.includes('.')) return;
      if (k === '.' && buf === '') buf = '0';
      if (buf.length >= 6) return;
      if (/\.\d{2}$/.test(buf)) return;            // two decimals is plenty
      buf += k;
    }
    draw(); haptic(4);
  };
  const nudge = dir => {
    const n = parseFloat(buf);
    const next = (Number.isFinite(n) ? n : 0) + dir * step;
    buf = String(Math.max(0, Math.round(next * 100) / 100));
    fresh = true; draw(); haptic(4);
  };

  const save = all => {
    const w = toKg(buf);
    store.update(s => {
      const arr = s.sessions[s.activeId].sets[key];
      if (all) arr.forEach((_, j) => { arr[j] = { w }; }); else arr[i] = { w };
      if (w != null) s.lastByEx[exName] = { w };
    });
    closeSheet(); render();
  };

  bindActions(document.querySelector('.sheet'), {
    pad: d => press(d.k),
    inc: () => nudge(1),
    dec: () => nudge(-1),
    save: () => save(false),
    saveall: () => save(true),
    rm: () => {
      store.update(s => { s.sessions[s.activeId].sets[key].splice(i,1); });
      closeSheet(); haptic(); render();
    },
    close: closeSheet,
  });
}

export const actions = {
  addset: d => addSet(d.k, d.n),
  fillsets: d => fillSets(d.k, d.n, +d.c),
  editset: d => editSet(d.k, +d.i, d.n),
};
