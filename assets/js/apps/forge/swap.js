/* ============================================================
   Training: the swap sheet. "Machine busy, or using something else."

   One search box over the whole library. Before you type it already shows
   the swaps that make sense (same movement first, then the same muscle);
   as you type the list narrows live, best match on top. Tap one to see its
   form, what it does to today's balance and a starting weight, then use it.
   Your own kit and "back to the original" are below.
   ============================================================ */

import { esc, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from '../../core/ui.js';
import { swapsFor, GEAR_STYLE, GEARS, convertWeight, estimateForGear, gearIndex, patternOf } from '../../data/swaps.js';
import { muscleOf } from '../../data/workouts.js';
import { libraryList, rankLibrary, factsFor } from '../../core/library.js';
import { swapEffect } from '../../core/balance.js';
import { benchmark, LEVEL_TEXT } from '../../core/training-edit.js';
import { formSVG, animateForm } from '../../core/form.js';
import { contextNow } from './edit-apply.js';
import { askAbout } from './coach-panel.js';
import { dayOf, render, resolve, store, swapKey } from './state.js';

const BADGE = { good: 'good', check: 'warn', no: 'bad' };

export function openSwap(exName, orig, dk){
  const g = swapsFor(orig);                 // alternates of the same movement; null for a one-off, which the library still covers
  const key = swapKey(dk, orig);
  const chosen = store.get().swaps?.[key];
  const last = store.get().lastByEx;
  const cur = last[exName]?.w;              // what you lift on the exercise showing now
  const day = dayOf(dk);
  const lib = libraryList(store.get().custom).filter(x => x.name !== exName);
  const notes = Object.fromEntries((g?.options || []).map(o => [o.name, o.note]));

  /* A weight to start from: what you last lifted on it, or a conversion when it is the same movement. */
  const startFor = name => {
    if (last[name]?.w != null) return { kg: last[name].w, own: true };
    if (patternOf(exName) !== patternOf(name)) return null;     // a different movement has no reliable weight
    const kg = convertWeight(exName, name, cur, store.get().custom);
    return kg == null ? null : { kg, own: false };
  };
  const startText = name => {
    const st = startFor(name);
    return st ? `${st.own ? 'Your last' : 'Start around'} ${st.kg}kg${st.own ? '' : ' (est.)'}` : cur != null ? 'No weight carries over — start light' : '';
  };

  openSheet(`
    <div class="tiny muted">${chosen ? `Now: ${esc(exName)}` : 'Swap'}</div>
    <h2 style="margin:4px 0 2px">${esc(chosen ? orig : exName)}</h2>
    <p class="sub" style="margin-bottom:12px">${esc(g ? g.why : 'Pick anything from the library. It does not have to be the same movement.')}</p>

    <label class="swap-search" for="lib-q">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
      <input class="input" id="lib-q" type="search" placeholder="Type an exercise, muscle or kit" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
    </label>
    <div id="lib-res" role="listbox" aria-label="Exercises"></div>
    <div id="lib-detail"></div>

    <button class="card tight" data-act="coachabout" style="width:100%;text-align:left;margin-top:12px">
      <b style="font-size:14.5px">Hurts, or nothing here fits?</b>
      <div class="tiny muted" style="margin-top:4px;line-height:1.5">Tell the coach what is going on. It suggests a swap that suits your shoulder, elbow and knees and keeps the week balanced.</div>
    </button>

    ${chosen ? `<button class="card tight" data-act="pickswap" data-o="" style="width:100%;text-align:left;margin-top:9px;border:1.5px solid var(--accent-1)">
        <b style="font-size:14.5px">Back to ${esc(orig)}</b>
        <div class="tiny muted" style="margin-top:4px">${last[orig]?.w != null ? `Your last ${last[orig].w}kg` : 'The program\'s own exercise'}</div>
      </button>` : ''}

    <div class="sec" style="margin-top:20px">Using something else?</div>
    <div class="card tight sunk">
      <div class="tiny muted" style="line-height:1.6">
        Say what kind of kit it is and what you would call it. The starting weight is worked out from how that kit usually
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

  const $ = id => document.getElementById(id);
  let picked = null, hi = 0, shown = [];

  /* ---- the live list ---- */
  const paintList = () => {
    const r = rankLibrary(lib, $('lib-q').value, { muscle: muscleOf(orig), pattern: patternOf(orig), options: (g?.options || []).map(o => o.name) });
    shown = r.items; if (hi >= shown.length) hi = 0;
    const head = r.suggested ? `Suggested · ${esc(muscleOf(orig))}` : r.total ? `${r.total} match${r.total === 1 ? '' : 'es'}${r.total > r.items.length ? ` · top ${r.items.length}, keep typing to narrow` : ''}` : '';
    $('lib-res').innerHTML = `${head ? `<div class="tiny muted swap-head">${head}</div>` : ''}
      <div class="swap-list">${shown.map((it, i) => {
        const gs = GEAR_STYLE[it.gear];
        return `<button class="swap-row${it.name === picked ? ' on' : ''}${i === hi && !r.suggested && $('lib-q').value ? ' hi' : ''}" role="option" data-act="libpick" data-n="${esc(it.name)}">
          <span class="fm-thumb">${formSVG(it.name, { size: 40 })}</span>
          <span class="grow" style="min-width:0"><b>${esc(it.name)}</b>
            <span class="tiny muted">${esc(it.muscle)}${gs ? ` · ${esc(gs.label)}` : ''}${notes[it.name] && startText(it.name) ? ` · ${esc(startText(it.name))}` : ''}</span></span>
          <span class="caret">›</span></button>`;
      }).join('') || `<div class="tiny muted" style="padding:14px">Nothing matches “${esc($('lib-q').value)}”. Try fewer words, or ask the coach below.</div>`}</div>`;
  };

  /* ---- one exercise, opened ---- */
  const paintDetail = name => {
    const f = factsFor(name, store.get().custom), gs = GEAR_STYLE[f.gear];
    const eff = day ? swapEffect(day, orig, name, ex => resolve(ex, dk).name) : null;
    const bm = benchmark({ type: 'swap', day: dk, orig, exercise: exName, to: name }, contextNow());
    const joints = bm.reasons.filter(r => !/^(This trains|A different movement|Same job)/.test(r));
    const note = notes[name] || f.note;
    $('lib-detail').innerHTML = `
      <div class="card tight swap-detail">
        <div class="form-hero">${formSVG(name, { size: 120, cls: 'fm-lg' })}
          <div class="grow" style="min-width:0">
            <div class="spread" style="align-items:flex-start;gap:8px"><b style="font-size:15px;line-height:1.35">${esc(name)}</b>
              ${gs ? `<span class="badge" style="background:${gs.bg};color:${gs.fg};flex:none">${esc(gs.label)}</span>` : ''}</div>
            <div class="tiny muted" style="margin-top:4px">${esc(f.muscle)} · ${esc(f.patternLabel)}</div>
            <div class="tiny" style="margin-top:7px;font-weight:700;color:var(--accent-1)">${esc(startText(name))}</div>
          </div>
        </div>
        ${note ? `<div class="tiny muted" style="margin-top:8px;line-height:1.55">${esc(note)}</div>` : ''}
        <div class="hr"></div>
        <div style="font-weight:700;font-size:13.5px">What this changes</div>
        ${eff ? `<div class="tiny" style="margin-top:5px;line-height:1.55">${esc(eff.text)}</div>
          ${eff.deltas.map(d => `<div class="spread" style="padding:3px 0"><span style="font-size:13px">${esc(d.muscle)} today</span><span class="mono" style="font-size:12.5px">${d.before} &rarr; ${d.after} sets</span></div>`).join('')}`
          : '<div class="tiny muted" style="margin-top:5px">The balance shows once you finish the session.</div>'}
        ${joints.length || bm.level !== 'good' ? `<div style="margin-top:9px"><span class="badge ${BADGE[bm.level]}">${LEVEL_TEXT[bm.level]}</span></div>` : ''}
        ${joints.map(r => `<div class="tiny muted" style="margin-top:6px;line-height:1.55">${esc(r)}</div>`).join('')}
        <button class="btn btn-primary block" style="margin-top:12px" data-act="uselib">Use this instead</button>
      </div>`;
    animateForm($('lib-detail').querySelector('svg.fm'));
    $('lib-detail').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  paintList();
  $('lib-q').addEventListener('input', () => { hi = 0; paintList(); });
  $('lib-q').addEventListener('keydown', e => {
    if (!shown.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ hi = (hi + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length; paintList(); e.preventDefault(); }
    if (e.key === 'Enter'){ picked = shown[hi].name; e.target.blur(); paintList(); paintDetail(picked); e.preventDefault(); }
  });

  const use = name => {
    const f = factsFor(name, store.get().custom), st = startFor(name);
    store.update(s => {
      s.swaps = { ...(s.swaps || {}) };
      if (name === orig) delete s.swaps[key]; else s.swaps[key] = name;
      // an exercise the swap maps do not know yet (one of the programme's own wordings) is registered with its kit
      if (!f.known && !s.custom?.[name]){
        const gear = f.gear || 'machine';
        s.custom = { ...(s.custom || {}), [name]: { gear, idx: f.idx ?? gearIndex(patternOf(name), gear) ?? null } };
      }
      // an estimate is marked as one so it is never mistaken for something actually lifted
      if (st && !st.own && s.lastByEx[name]?.w == null) s.lastByEx[name] = { w: st.kg, est: true };
    });
    haptic(); closeSheet();
    toast(name === orig ? `Back to ${orig}` : `Swapped to ${name}`);
    render();
  };

  let cGear = null;
  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    libpick: d => { picked = d.n; paintList(); paintDetail(picked); haptic(4); },
    uselib: () => { if (picked) use(picked); else toast('Pick an exercise first'); },
    pickswap: () => use(orig),
    coachabout: () => { closeSheet(); askAbout({ dk, name: exName, orig }); },
    namecu: () => { const f = $('cu-name'); f.hidden = false; $('cu-namebtn').hidden = true; f.focus(); },
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
  });
}

export const actions = { swap: d => openSwap(d.n, d.o, d.dk) };
