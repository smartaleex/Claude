/* ============================================================
   Training: the swap sheet. Same-pattern alternatives, your own kit, converted weights.
   ============================================================ */

import { esc, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from '../../core/ui.js';
import { swapsFor, GEAR_STYLE, GEARS, convertWeight, estimateForGear } from '../../data/swaps.js';
import { render, store, swapKey } from './state.js';

/* Alternates for whatever is busy. Grouped by what you need rather than
   by how good they are, because the question in the moment is always
   "what is actually free right now". */
export function openSwap(exName, orig, dk){
  const g = swapsFor(orig);
  if (!g){ toast('No alternates for that one'); return; }
  const key = swapKey(dk, orig);
  const chosen = store.get().swaps?.[key];
  const last = store.get().lastByEx;
  const cur = last[exName]?.w;             // what you lift on the exercise showing now

  /* Options exclude only the original; when you are already on an
     alternative, the alternatives (and a way back) are all on offer. */
  const opts = g.options.filter(o => o.name !== exName);
  const est = name => {
    if (last[name]?.w != null) return { kg: last[name].w, own: true };
    const kg = convertWeight(exName, name, cur, store.get().custom);
    return kg == null ? null : { kg, own: false };
  };

  openSheet(`
    <div class="tiny muted">${chosen ? `Now: ${esc(exName)}` : esc(orig)}</div>
    <h2 style="margin:4px 0 2px">${esc(g.label)}</h2>
    <p class="sub" style="margin-bottom:4px">${esc(g.why)}</p>
    <div class="card tight sunk" style="margin:14px 0">
      <div class="tiny muted" style="line-height:1.6">
        Tap one to swap it in — it replaces the exercise on the Plan and in your
        session, and stays until you go back. Weights are converted from what you
        lift now (${cur != null ? `${cur}kg` : 'nothing logged yet'}); treat them as a
        starting point and correct after your first set.
      </div>
    </div>
    ${chosen ? `<button class="card tight" data-act="pickswap" data-o="" style="width:100%;text-align:left;margin-bottom:9px;border:1.5px solid var(--accent-1)">
        <b style="font-size:14.5px">Back to ${esc(orig)}</b>
        <div class="tiny muted" style="margin-top:4px">${(() => { const e = est(orig); return e ? `${e.own ? 'Your last' : 'About'} ${e.kg}kg${e.own ? '' : ' (est.)'}` : 'The program\'s own exercise'; })()}</div>
      </button>` : ''}
    <div class="stack" style="gap:9px">
      ${opts.map((o, i) => {
        const gs = GEAR_STYLE[o.gear], e = est(o.name);
        return `<button class="card tight" data-act="pickswap" data-o="${esc(o.name)}" style="width:100%;text-align:left">
          <div class="spread" style="align-items:flex-start;gap:10px">
            <b style="font-size:14.5px">${esc(o.name)}</b>
            <span class="badge" style="background:${gs.bg};color:${gs.fg}">${esc(gs.label)}</span>
          </div>
          <div class="tiny muted" style="margin-top:6px;line-height:1.55">${esc(o.note)}</div>
          <div class="tiny" style="margin-top:7px;font-weight:700;color:var(--accent-1)">
            ${e ? `${e.own ? 'Your last: ' : 'Start around '}${e.kg}kg${e.own ? '' : ' (est.)'}`
                : cur != null ? 'No weight carries over — start light' : ''}
          </div>
        </button>`;
      }).join('')}
    </div>

    <div class="sec" style="margin-top:20px">Using something else?</div>
    <div class="card tight sunk">
      <div class="tiny muted" style="line-height:1.6">
        Machine taken and you have something different in mind? Say what kind of kit it is and
        what you would call it. The starting weight is worked out from how that kit usually
        compares for ${esc(g.label.toLowerCase())}. Dumbbell weights are per hand.
      </div>
      <div class="chips" style="margin-top:12px" id="cu-gear">
        ${GEARS.map(k => `<button class="chip" data-act="cgear" data-g="${k}" style="font-size:12.5px;padding:8px 13px">${GEAR_STYLE[k].label}</button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="namecu" id="cu-namebtn">Give it a name (optional)</button>
      <input class="input" id="cu-name" placeholder="e.g. Smith machine press" maxlength="48" style="margin-top:10px" hidden>
      <button class="btn btn-primary block" style="margin-top:10px" data-act="pickcustom">Use this instead</button>
    </div>
    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Close</button>
  `);

  let cGear = null;
  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    namecu: () => { const f = document.getElementById('cu-name'); f.hidden = false; document.getElementById('cu-namebtn').hidden = true; f.focus(); },
    cgear: (d, el) => {
      cGear = d.g;
      document.querySelectorAll('#cu-gear .chip').forEach(c => c.classList.toggle('on', c === el));
      haptic(4);
    },
    pickcustom: () => {
      if (!cGear){ toast('Pick what kind of kit it is first'); return; }
      const typed = sheetVal('cu-name').trim().replace(/\s+/g, ' ');
      const name = typed || `${GEAR_STYLE[cGear].label} ${g.label.toLowerCase()}`;
      const e = estimateForGear(exName, cGear, cur, store.get().custom);
      store.update(st => {
        st.custom = { ...(st.custom || {}), [name]: { gear: cGear, idx: e.idx } };
        st.swaps = { ...(st.swaps || {}), [key]: name };
        if (e.kg != null && st.lastByEx[name]?.w == null) st.lastByEx[name] = { w: e.kg, est: true };
      });
      haptic(); closeSheet();
      toast(e.kg != null ? `Using ${name}, start around ${e.kg}kg` : `Using ${name}`);
      render();
    },
    pickswap: d => {
      const alt = d.o;                                   // '' = back to the original
      const target = alt || orig;
      const e = alt ? est(alt) : est(orig);
      store.update(st => {
        st.swaps = { ...(st.swaps || {}) };
        if (alt) st.swaps[key] = alt; else delete st.swaps[key];
        // Seed a starting weight only if there is none for it yet, and mark it
        // an estimate so it is never mistaken for something you actually lifted.
        if (e && !e.own && st.lastByEx[target]?.w == null) st.lastByEx[target] = { w: e.kg, est: true };
      });
      haptic(); closeSheet();
      toast(alt ? `Swapped to ${alt}` : `Back to ${orig}`);
      render();
    },
  });
}

export const actions = { swap: d => openSwap(d.n, d.o, d.dk) };
