/* ============================================================
   Training: how AI readings and the goal reference are drawn (progress read, benchmark result, goal photos). Views only.
   ============================================================ */

import { dayKey, fmtDayShort } from '../../core/store.js';
import { esc } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { urlFor } from '../../core/photos.js';
import * as coach from '../../core/coach.js';
import { ui, MAX_GOAL, phase, store } from './state.js';

const DIR = { up:['Up','good'], same:['Same','neutral'], down:['Down','warn'], unclear:['Unclear','neutral'] };

export function progressResultHTML(r){
  const d = r.data;
  return `
  <div class="card in" style="margin-top:12px">
    <div class="tiny muted lbl" >
      Reading · ${esc(fmtDayShort(dayKey(r.t)))} · ${r.n} photo${r.n>1?'s':''}
    </div>
    ${d.headline ? `<div class="disp" style="font-size:17px;line-height:1.4;margin-top:8px">${esc(d.headline)}</div>` : ''}
    ${r.q && d.answer ? `<div class="card tight sunk" style="margin-top:12px">
        <div class="tiny muted">You asked: ${esc(r.q)}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:6px">${esc(d.answer)}</div></div>` : ''}
    ${d.comparability ? `<div class="tiny muted" style="margin-top:12px;line-height:1.6"><b>How comparable:</b> ${esc(d.comparability)}</div>` : ''}
    ${d.changes.length ? `<div class="stack" style="gap:9px;margin-top:14px">
      ${d.changes.map(c => { const [lab, tone] = DIR[c.direction] || DIR.unclear; return `
        <div style="padding-top:9px;border-top:1px solid var(--line-soft)">
          <div class="spread"><b style="font-size:14.5px">${esc(c.area)}</b><span class="badge ${tone}">${lab}</span></div>
          <div class="tiny muted" style="margin-top:4px;line-height:1.55">${esc(c.note)}</div>
        </div>`; }).join('')}</div>` : ''}
    ${d.next.length ? `<div class="card tight" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
      <div class="tiny" style="line-height:1.6"><b>Next:</b> ${d.next.map(esc).join(' ')}</div></div>` : ''}
    <div class="tiny muted" style="margin-top:12px;line-height:1.55">
      An AI reading of phone photos, not a measurement. It cannot see how tired, pumped or cold you were.
    </div>
  </div>`;
}

export function goalHTML2(ai, shots){
  const goals = ui.goals || [];
  const bm = (store.get().readings || {}).benchmark;
  const canRun = goals.length && shots.length;

  return `
  <div class="sec">Goal reference</div>
  <div class="card in">
    <div class="card-title">Where you are heading</div>
    <p class="card-note" style="margin-top:7px;line-height:1.6">
      Add a photo of the physique you are aiming at, and get a read on the gap and which parts of your
      program to lean on. It is a <b>direction, not a verdict</b> — measure your progress against your own
      baseline, not against someone else's body.
    </p>
    ${goals.length ? `<div class="row" style="margin-top:12px;gap:9px;flex-wrap:wrap">
      ${goals.map(g => `
        <div style="position:relative;width:74px;height:98px;border-radius:var(--r-sm);overflow:hidden;box-shadow:var(--clay-sm)">
          <img src="${urlFor(g)}" style="width:100%;height:100%;object-fit:cover;display:block">
          <button data-act="rmgoal" data-id="${g.id}" aria-label="Remove reference"
            style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:var(--r-av);
                   background:rgba(13,14,20,.78);color:#fff;font-size:11px;line-height:1">✕</button>
        </div>`).join('')}
    </div>` : ''}
    ${goals.length < MAX_GOAL ? `<button class="btn btn-plain block" style="margin-top:12px" data-act="pickgoal">
        ${icon('plus',16)} Add a goal photo${goals.length ? '' : ''}</button>` : `
      <div class="tiny muted" style="margin-top:10px">That is the limit — ${MAX_GOAL}. Remove one to swap it.</div>`}
    ${canRun ? (ai.tier === 3
      ? `<div class="tiny" style="margin-top:12px;color:var(--warn);line-height:1.55">Benchmarking needs a free Gemini key.</div>`
      : `<button class="btn btn-primary block" style="margin-top:12px" data-act="benchmark" ${ui.busy?'disabled':''}>
          ${ui.busy === 'benchmark' ? '<span class="spin"></span> Comparing…' : `${icon('spark',17)} Benchmark · send ${1 + Math.min(goals.length, 2)} photos to Gemini`}
        </button>`) : `<div class="tiny muted" style="margin-top:12px;line-height:1.55">
          ${!shots.length ? 'Take a progress photo first — it compares against your latest.' : 'Add a goal photo to run a benchmark.'}</div>`}
  </div>
  ${bm ? benchmarkResultHTML(bm) : ''}`;
}

function benchmarkResultHTML(r){
  const d = r.data;
  const GAP = { close:['Close','good'], moderate:['Some way','neutral'], large:['Furthest','warn'] };
  const focus = store.get().focus || {};
  const proposed = Object.fromEntries(d.adjustments.map(a => [a.muscle, a.extraSets]));
  const fits = coach.appliedTotals(phase(), proposed);
  const already = d.adjustments.length && d.adjustments.every(a => focus[a.muscle] === a.extraSets)
                  && Object.keys(focus).length === d.adjustments.length;

  return `
  <div class="card in" style="margin-top:12px">
    <div class="tiny muted lbl" >
      Benchmark · ${esc(fmtDayShort(dayKey(r.t)))}
    </div>
    ${d.summary ? `<div class="disp" style="font-size:16.5px;line-height:1.45;margin-top:8px">${esc(d.summary)}</div>` : ''}

    ${d.areas.length ? `<div class="stack" style="gap:9px;margin-top:14px">
      ${d.areas.map(a => { const [lab, tone] = GAP[a.gap] || GAP.moderate; return `
        <div style="padding-top:9px;border-top:1px solid var(--line-soft)">
          <div class="spread"><b style="font-size:14.5px">${esc(a.muscle)}</b><span class="badge ${tone}">${lab}</span></div>
          <div class="tiny muted" style="margin-top:4px;line-height:1.55">${esc(a.note)}</div>
        </div>`; }).join('')}</div>` : ''}

    ${d.frame ? `<div class="card tight sunk" style="margin-top:14px">
      <div class="tiny muted" style="line-height:1.6"><b>What training can and cannot change:</b> ${esc(d.frame)}</div></div>` : ''}
    ${d.realism ? `<div class="tiny muted" style="margin-top:10px;line-height:1.6"><b>How realistic:</b> ${esc(d.realism)}</div>` : ''}

    ${d.adjustments.length ? `
    <div class="card tight" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
      <div class="card-title" style="font-size:14.5px">Suggested program changes</div>
      <div class="tiny muted" style="margin-top:4px;line-height:1.55">
        Extra sets per week, spread across the matching exercises. About two minutes each.</div>
      <div class="stack" style="gap:8px;margin-top:11px">
        ${d.adjustments.map(a => `<div>
          <div class="spread"><b style="font-size:14px">${esc(a.muscle)}</b>
            <span class="mono" style="font-weight:800;color:var(--accent-1)">+${a.extraSets}/wk</span></div>
          ${a.why ? `<div class="tiny muted" style="margin-top:2px;line-height:1.5">${esc(a.why)}</div>` : ''}
          ${(fits[a.muscle] || 0) < a.extraSets ? `<div class="tiny" style="margin-top:2px;color:var(--warn)">
            ${fits[a.muscle] ? `Only +${fits[a.muscle]} fits` : 'No matching exercise'} in ${esc(phase().name)}.</div>` : ''}
        </div>`).join('')}
      </div>
      ${d.refused.length ? `<div class="tiny muted" style="margin-top:12px;line-height:1.55">
        ${d.refused.map(x => `Not adding ${esc(x.muscle.toLowerCase())} — ${esc(x.reason)}.`).join(' ')}</div>` : ''}
      <button class="btn ${already ? 'btn-plain' : 'btn-primary'} block" style="margin-top:14px" data-act="applyfocus" ${already?'disabled':''}>
        ${already ? 'Applied to your program' : 'Apply to my program'}</button>
    </div>` : `<div class="tiny muted" style="margin-top:12px;line-height:1.55">
        No program changes suggested — the current plan already covers this.
        ${d.refused.length ? d.refused.map(x => `Not adding ${esc(x.muscle.toLowerCase())} — ${esc(x.reason)}.`).join(' ') : ''}</div>`}

    <div class="tiny muted" style="margin-top:12px;line-height:1.55">
      An AI comparison of two photos. Nothing changes in your program unless you tap Apply, and even then
      it is capped per muscle and per week to protect your shoulder and elbow.
    </div>
  </div>`;
}
