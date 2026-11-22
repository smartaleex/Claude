/* ============================================================
   Training: the settings sheet (leg day, comeback ramp, cable and machine labels, phases).
   ============================================================ */

import { today } from '../../core/store.js';
import { esc, toast, openSheet, closeSheet, sheetRoot, bindActions, haptic } from '../../core/ui.js';
import { PHASES } from '../../data/workouts.js';
import { defaultStack } from '../../data/swaps.js';
import { ramp, render, store } from './state.js';

/* Changing a setting redraws the sheet; keep the scroll position or it
   jumps back to the top every tap. */
export function reopen(){
  const y = sheetRoot()?.scrollTop || 0;
  openSettings();
  const el = sheetRoot(); if (el) el.scrollTop = y;
}

export function openSettings(){
  const s = store.get();
  const st = { ...defaultStack, ...(s.stack || {}) };
  const seg = (act, items, cur, extra = '') => `<div class="seg" style="margin:6px 0 0">
    ${items.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-act="${act}" data-v="${v}" ${extra}>${l}</button>`).join('')}</div>`;
  const rp = ramp();

  openSheet(`
    <h2>Training settings</h2>

    <div class="sec" style="margin-top:14px">Leg day</div>
    <p class="sub" style="margin-bottom:0">Back-friendly swaps out the loaded hinge for hip thrusts, adds a hip and back warm-up and runs about 30 minutes. Original is the program as first written.</p>
    ${seg('setlegs', [['kind', 'Back-friendly'], ['original', 'Original']], s.legs !== 'original' ? 'kind' : 'original')}

    <div class="sec" style="margin-top:20px">Comeback ramp</div>
    <p class="sub" style="margin-bottom:0">${rp.active ? `Running: week ${rp.week} of ${rp.weeks}.` : 'Starts by itself after ten days away: three weeks of lighter volume and weights.'}</p>
    ${rp.active
      ? `<button class="btn btn-plain block" style="margin-top:8px" data-act="rampoff">Stop the ramp</button>`
      : `<button class="btn btn-plain block" style="margin-top:8px" data-act="rampon">Start a ramp now</button>`}

    <div class="sec" style="margin-top:20px">Cable and machine labels</div>
    <div class="card tight sunk" style="margin:6px 0 10px">
      <div class="tiny muted" style="line-height:1.6">
        The number on a stack is not always the weight at your hand. Many cable stations run the cable
        through a moving pulley (2:1), so a stack reading of 40 puts about 20 in your hand. Some stacks are
        labelled in pounds. This app cannot see your gym, so set it once and every set converts for you.
        Not sure? Ask staff, look for a 2:1 sticker, or try a light set: if 20 on the stack feels like a
        10kg dumbbell, it is 2:1.
      </div>
    </div>
    ${['cable', 'machine'].map(g => `
      <div style="margin-top:10px"><b style="font-size:14px">${g === 'cable' ? 'Cables' : 'Machines'}</b>
        <div class="tiny muted" style="margin-top:3px">Stack to hand ratio</div>
        ${seg('setstack', [['1', '1 : 1'], ['2', '2 : 1']], st[g].ratio, `data-g="${g}" data-f="ratio"`)}
        <div class="tiny muted" style="margin-top:8px">Stack is labelled in</div>
        ${seg('setstack', [['kg', 'kg'], ['lb', 'lb']], st[g].unit, `data-g="${g}" data-f="unit"`)}
      </div>`).join('')}

    <div class="sec" style="margin-top:22px">Phases</div>
    <p class="sub">6–8 weeks each, then it advances on its own and loops back to Phase 1. Switch manually any time.</p>
    <div class="stack" style="gap:8px">
      ${PHASES.map((p,i) => `
        <button class="card tight ${i===s.blockIndex?"":"sunk"}" data-act="setblock" data-i="${i}"
                style="text-align:left;${i===s.blockIndex?"background:var(--accent-tint)":""}">
          <div class="spread"><b>Phase ${p.phase} · ${esc(p.name)}</b>
            ${i===s.blockIndex?'<span class="badge accent">Current</span>':`<span class="tiny muted">${esc(p.weeks)}</span>`}</div>
          <div class="tiny muted" style="margin-top:4px">${esc(p.focus)}</div>
        </button>`).join('')}
    </div>
    <button class="btn btn-plain block" style="margin-top:16px" data-act="restart">Restart the phase clock</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    setblock: d => {
      store.update(st => { st.blockIndex = +d.i; st.blockStart = today(); });
      closeSheet(); toast('Phase switched'); render();
    },
    restart: () => {
      store.update(st => { st.blockStart = today(); });
      closeSheet(); toast('Clock restarted'); render();
    },
    setlegs: d => {
      store.update(x => { x.legs = d.v; });
      haptic(); toast(d.v === 'kind' ? 'Back-friendly legs on' : 'Original leg day'); render(); reopen();
    },
    setstack: d => {
      store.update(x => {
        x.stack = { ...defaultStack, ...(x.stack || {}) };
        x.stack[d.g] = { ...x.stack[d.g], [d.f]: d.f === 'ratio' ? +d.v : d.v };
      });
      haptic(6); render(); reopen();
    },
    rampon: () => { store.update(x => { x.comeback = { start: today(), weeks: 3, off:false }; }); haptic(); toast('Comeback ramp started'); render(); reopen(); },
    rampoff: () => { store.update(x => { x.comeback = { ...(x.comeback || {}), off:true }; }); haptic(); render(); reopen(); },
    close: closeSheet,
  });
}

export const actions = { settings: openSettings };
