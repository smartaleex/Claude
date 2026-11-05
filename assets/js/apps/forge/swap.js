/* ============================================================
   Training: the swap sheet. Same-pattern alternatives, your own kit, converted weights.
   ============================================================ */

import { esc, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from '../../core/ui.js';
import { swapsFor, GEAR_STYLE, GEARS, convertWeight, estimateForGear, gearIndex, patternOf } from '../../data/swaps.js';
import { libraryList, libraryGroups, searchLibrary, factsFor } from '../../core/library.js';
import { swapEffect } from '../../core/balance.js';
import { benchmark, LEVEL_TEXT } from '../../core/training-edit.js';
import { contextNow } from './edit-apply.js';
import { dayOf, render, resolve, store, swapKey } from './state.js';

/* Alternates for whatever is busy. Grouped by what you need rather than
   by how good they are, because the question in the moment is always
   "what is actually free right now". */
export function openSwap(exName, orig, dk){
  const g = swapsFor(orig);          // alternates of the same movement; null for a one-off, which the library still covers
  const key = swapKey(dk, orig);
  const chosen = store.get().swaps?.[key];
  const last = store.get().lastByEx;
  const cur = last[exName]?.w;             // what you lift on the exercise showing now

  /* Options exclude only the original; when you are already on an
     alternative, the alternatives (and a way back) are all on offer. */
  const opts = g ? g.options.filter(o => o.name !== exName) : [];
  const est = name => {
    if (last[name]?.w != null) return { kg: last[name].w, own: true };
    const kg = convertWeight(exName, name, cur, store.get().custom);
    return kg == null ? null : { kg, own: false };
  };

  openSheet(`
    <div class="tiny muted">${chosen ? `Now: ${esc(exName)}` : esc(orig)}</div>
    <h2 style="margin:4px 0 2px">${esc(g ? g.label : 'Swap this exercise')}</h2>
    <p class="sub" style="margin-bottom:4px">${esc(g ? g.why : 'Pick anything from the library below.')}</p>
    <div class="card tight sunk" style="margin:14px 0">
      <div class="tiny muted" style="line-height:1.6">
        Pick one to swap it in — it replaces the exercise on the Plan and in your
        session, and stays until you go back. Weights are converted from what you
        lift now (${cur != null ? `${cur}kg` : 'nothing logged yet'}); treat them as a
        starting point and correct after your first set.
      </div>
    </div>

    <div class="sec" style="margin-top:6px">Pick any exercise from the library</div>
    <div class="card tight sunk">
      <div class="tiny muted" style="line-height:1.6">
        It does not have to be the same movement. If the assisted pull-up machine is taken and the iso-lateral row is
        free, pick it here and see what it does to the balance of your session before you commit.
      </div>
      <input class="input" id="lib-q" placeholder="Filter: iso lateral, cable, lats…" autocomplete="off" style="margin-top:10px">
      <select class="select" id="lib-pick" data-change="libpick" style="margin-top:10px"></select>
      <div id="lib-detail"></div>
    </div>
    ${g ? '<div class="sec" style="margin-top:20px">Quick alternates for this movement</div>' : ''}
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
        compares for ${esc(g ? g.label.toLowerCase() : 'this movement')}. Dumbbell weights are per hand.
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

  /* ---- the library dropdown ---- */
  const lib = libraryList(store.get().custom).filter(x => x.name !== exName);
  const day = dayOf(dk);
  const $ = id => document.getElementById(id);
  const fillSelect = () => {
    const found = searchLibrary(lib, $('lib-q').value);
    $('lib-pick').innerHTML = `<option value="">Choose an exercise… (${found.length})</option>` +
      libraryGroups(found).map(grp => `<optgroup label="${esc(grp.muscle)}">${grp.items.map(it =>
        `<option value="${esc(it.name)}">${esc(it.name)}${it.gear ? ' · ' + esc(GEAR_STYLE[it.gear]?.label || it.gear) : ''}</option>`).join('')}</optgroup>`).join('');
    $('lib-detail').innerHTML = '';
  };
  fillSelect();
  $('lib-q').addEventListener('input', fillSelect);

  /* A weight to start from: what you last lifted on it, or a conversion when it is the same movement. */
  const libStart = name => {
    if (last[name]?.w != null) return { kg: last[name].w, own: true };
    if (patternOf(exName) !== patternOf(name)) return null;       // a different movement has no reliable weight
    const kg = convertWeight(exName, name, cur, store.get().custom);
    return kg == null ? null : { kg, own: false };
  };

  const libDetail = name => {
    const f = factsFor(name, store.get().custom);
    const gs = GEAR_STYLE[f.gear];
    const eff = day ? swapEffect(day, orig, name, ex => resolve(ex, dk).name) : null;
    const bm = benchmark({ type: 'swap', day: dk, orig, exercise: exName, to: name }, contextNow());
    const joints = bm.reasons.filter(r => !/^(This trains|A different movement|Same job)/.test(r));
    const st = libStart(name);
    return `
      <div class="card tight" style="margin-top:12px">
        <div class="spread" style="align-items:flex-start;gap:10px">
          <b style="font-size:14.5px;line-height:1.4">${esc(name)}</b>
          ${gs ? `<span class="badge" style="background:${gs.bg};color:${gs.fg};flex:none">${esc(gs.label)}</span>` : ''}
        </div>
        <div class="tiny muted" style="margin-top:4px">${esc(f.muscle)} · ${esc(f.patternLabel)}</div>
        ${f.note ? `<div class="tiny muted" style="margin-top:6px;line-height:1.55">${esc(f.note)}</div>` : ''}
        <div class="tiny" style="margin-top:7px;font-weight:700;color:var(--accent-1)">
          ${st ? `${st.own ? 'Your last: ' : 'Start around '}${st.kg}kg${st.own ? '' : ' (est.)'}` : cur != null ? 'No weight carries over — start light' : ''}
        </div>
        <div class="hr"></div>
        <div style="font-weight:700;font-size:13.5px">What this changes</div>
        ${eff ? `<div class="tiny" style="margin-top:5px;line-height:1.55">${esc(eff.text)}</div>
          ${eff.deltas.length ? `<div style="margin-top:7px">${eff.deltas.map(d => `<div class="spread" style="padding:3px 0">
            <span style="font-size:13px">${esc(d.muscle)} today</span><span class="mono" style="font-size:12.5px">${d.before} &rarr; ${d.after} sets</span></div>`).join('')}</div>` : ''}`
          : '<div class="tiny muted" style="margin-top:5px">The balance shows once you finish the session.</div>'}
        ${joints.length || bm.level !== 'good' ? `<div style="margin-top:9px"><span class="badge ${{ good: 'good', check: 'warn', no: 'bad' }[bm.level]}">${LEVEL_TEXT[bm.level]}</span></div>` : ''}
        ${joints.map(r => `<div class="tiny muted" style="margin-top:6px;line-height:1.55">${esc(r)}</div>`).join('')}
      </div>
      <button class="btn btn-primary block" style="margin-top:12px" data-act="uselib">Use this instead</button>`;
  };

  let cGear = null;
  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    libpick: (d, el) => { $('lib-detail').innerHTML = el.value ? libDetail(el.value) : ''; },
    uselib: () => {
      const name = $('lib-pick').value;
      if (!name){ toast('Pick an exercise first'); return; }
      const f = factsFor(name, store.get().custom);
      const st = libStart(name);
      store.update(s => {
        s.swaps = { ...(s.swaps || {}) };
        if (name === orig) delete s.swaps[key]; else s.swaps[key] = name;
        // an exercise the swap maps do not know yet (one of the programme's own wordings) is registered with its kit
        if (!f.known && !s.custom?.[name]){
          const gear = f.gear || 'machine';
          s.custom = { ...(s.custom || {}), [name]: { gear, idx: f.idx ?? gearIndex(patternOf(name), gear) ?? null } };
        }
        if (st && !st.own && s.lastByEx[name]?.w == null) s.lastByEx[name] = { w: st.kg, est: true };
      });
      haptic(); closeSheet();
      toast(name === orig ? `Back to ${orig}` : `Swapped to ${name}`);
      render();
    },
    namecu: () => { const f = document.getElementById('cu-name'); f.hidden = false; document.getElementById('cu-namebtn').hidden = true; f.focus(); },
    cgear: (d, el) => {
      cGear = d.g;
      document.querySelectorAll('#cu-gear .chip').forEach(c => c.classList.toggle('on', c === el));
      haptic(4);
    },
    pickcustom: () => {
      if (!cGear){ toast('Pick what kind of kit it is first'); return; }
      const typed = sheetVal('cu-name').trim().replace(/\s+/g, ' ');
      const name = typed || `${GEAR_STYLE[cGear].label} ${g ? g.label.toLowerCase() : 'exercise'}`;
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
