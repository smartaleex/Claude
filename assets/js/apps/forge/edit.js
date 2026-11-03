/* ============================================================
   Training: "Change it in your own words".

   Type what you want ("swap incline press for the DB one, my shoulder
   clicks", "side delts to 5 sets on shoulders day", "cable stack reads in lb
   at 2:1"). The words are read (by Gemini if it is on, by simple rules if
   not), every change is checked against your shoulder, elbow, knees, back,
   the physique you are building, what you are eating and whether you are
   mid comeback, and you see the verdict and the reasons before anything
   changes. Tick the ones you want, apply, and the newest batch can be undone.
   ============================================================ */

import { ask } from '../../core/ai.js';
import { fmtDayShort, dayKey } from '../../core/store.js';
import { esc, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { parseEdits, resolveOps, benchmark, impact, describe, isStructural, editPrompt, LEVEL_TEXT } from '../../core/training-edit.js';
import { phase, render, store } from './state.js';
import { applyBatch, undoLast, bodyContext, contextNow } from './edit-apply.js';

const EXAMPLES = [
  'Swap incline press for the DB version, my shoulder clicks',
  'Side delts to 5 sets on shoulders day',
  'Drop the face pulls',
  'Cable stack reads in lb and is 2:1',
];
const BADGE = { good: 'good', check: 'warn', no: 'bad' };

/* Words in, checked changes out. */
async function interpret(text){
  const days = phase().days, swaps = store.get().swaps || {}, body = bodyContext();
  const res = await ask({
    prompt: editPrompt({ text, days, swaps, body, phase: phase(), ramp: contextNow().ramp }),
    maxTokens: 1100,
    offline: () => parseEdits(text, days, swaps),
  });
  const raw = Array.isArray(res.data) ? res.data : res.data?.ops;
  const { ops, notes } = resolveOps(raw, days, swaps);
  const ctx = contextNow();
  const active = !!store.get().activeId;
  const props = ops.map(op => {
    const bm = benchmark(op, ctx);
    const blocked = active && isStructural(op);
    return { op, bm, blocked, on: bm.level !== 'no' && !blocked };
  });
  const said = Array.isArray(res.data?.notes) ? res.data.notes : [];
  return { props, notes: [...said, ...notes].filter(Boolean).map(String), say: typeof res.data?.say === 'string' ? res.data.say : '', source: res.source, body: ctx.body, ctx };
}

function proposalsHTML(r){
  const days = phase().days;
  const on = r.props.filter(p => p.on).map(p => p.op);
  const week = on.length ? impact(days, on) : { volume: [], minutes: [] };
  const b = r.body;
  const bodyLine = [
    b.kg ? `${b.kg}kg now` : null,
    b.kcalAvg && b.kcalTarget ? `eating about ${Math.round(b.kcalAvg).toLocaleString('en-AU')} of ${Math.round(b.kcalTarget).toLocaleString('en-AU')} kcal` : null,
  ].filter(Boolean).join(' · ');

  return `
    <div class="tiny muted" style="margin:14px 0 8px">
      ${r.source === 'Offline' ? 'Read with simple rules (AI is off or unavailable).' : `Read by ${esc(r.source)}.`}
      ${r.say ? esc(r.say) : ''}
    </div>
    ${r.props.length ? `<div class="stack" style="gap:9px">${r.props.map((p, i) => `
      <div class="card tight ${p.on ? '' : 'sunk'}">
        <div class="spread" style="align-items:flex-start;gap:10px">
          <b style="font-size:14.5px;line-height:1.4">${esc(describe(p.op, days))}</b>
          <span class="badge ${BADGE[p.bm.level]}" style="flex:none">${LEVEL_TEXT[p.bm.level]}</span>
        </div>
        ${p.op.why ? `<div class="tiny" style="margin-top:7px;line-height:1.55">${esc(p.op.why)}</div>` : ''}
        ${p.bm.reasons.map(t => `<div class="tiny muted" style="margin-top:6px;line-height:1.55">${esc(t)}</div>`).join('')}
        ${p.blocked ? `<div class="tiny" style="margin-top:6px;color:var(--warn)">Finish or exit your open session first: adding or removing an exercise would shift where its sets are logged.</div>` : ''}
        ${p.blocked ? '' : `<button class="chip ${p.on ? 'on' : ''}" data-act="tog" data-i="${i}" style="margin-top:10px;font-size:12.5px;padding:8px 13px">${p.on ? 'Applying this' : p.bm.level === 'no' ? 'Not applying (tap to apply anyway)' : 'Skipped'}</button>`}
      </div>`).join('')}</div>` : ''}

    ${r.notes.length ? `<div class="card tight sunk" style="margin-top:10px">${r.notes.map(n => `<div class="tiny" style="line-height:1.55">${esc(n)}</div>`).join('')}</div>` : ''}

    ${on.length ? `
    <div class="card tight sunk" style="margin-top:12px">
      <div class="card-title" style="font-size:14px">What it does to your week</div>
      ${week.volume.length ? week.volume.slice(0, 5).map(v => `<div class="spread" style="padding:5px 0"><span style="font-size:13.5px">${esc(v.muscle)}</span><span class="mono" style="font-size:13px">${v.before} &rarr; ${v.after} sets</span></div>`).join('') : `<div class="tiny muted" style="margin-top:4px">No change to the weekly sets.</div>`}
      ${week.minutes.map(m => `<div class="spread" style="padding:5px 0"><span style="font-size:13.5px">${esc(m.title)}</span><span class="mono" style="font-size:13px">~${m.before} &rarr; ~${m.after} min</span></div>`).join('')}
      ${bodyLine ? `<div class="tiny muted" style="margin-top:8px">Checked against: ${esc(bodyLine)}, your joints, and the width you are building.</div>` : ''}
    </div>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="apply">Apply ${on.length} change${on.length === 1 ? '' : 's'}</button>` : ''}`;
}

function historyHTML() {
  const list = [...(store.get().edits || [])].reverse();
  if (!list.length) return '';
  return `
    <div class="sec" style="margin-top:20px">Changes you have made</div>
    <div class="stack" style="gap:8px">${list.map((e, i) => `
      <div class="rowcard" style="padding:11px 14px">
        <div class="grow">
          <b style="font-size:14px;line-height:1.4">${esc(e.text.length > 90 ? e.text.slice(0, 90) + '…' : e.text)}</b>
          <span class="sub">${esc(fmtDayShort(dayKey(new Date(e.t))))} · ${e.ops.length} change${e.ops.length === 1 ? '' : 's'}</span>
        </div>
        ${i === 0 ? `<button class="btn btn-sm btn-plain" data-act="undo">Undo</button>` : `<span class="tiny faint">undo newer first</span>`}
      </div>`).join('')}</div>`;
}

export function openEdit(){
  openSheet(`
    <h2>Change it in your own words</h2>
    <p class="sub">Swap an exercise, change sets, reps or rest, add or drop one, or say how your gym's stacks read. Each change is checked against your shoulder, elbow, knees, back and the physique you are building before anything happens.</p>
    <textarea class="textarea" id="ed-q" placeholder="e.g. Swap incline press for the DB version, my shoulder clicks"></textarea>
    <div class="chips" style="margin-top:8px">
      ${EXAMPLES.map((t, i) => `<button class="chip" data-act="ex" data-i="${i}" style="font-size:12px;padding:7px 11px">${esc(t)}</button>`).join('')}
    </div>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="check" id="ed-btn">${icon('spark', 17)} Check it</button>
    <div id="ed-out"></div>
    <div id="ed-hist">${historyHTML()}</div>
    <button class="btn btn-ghost block" style="margin-top:14px" data-act="close">Close</button>
    <div class="tiny muted center" style="margin-top:8px">Not medical advice. Sharp pain is a physio, not a different exercise.</div>
  `);

  let result = null, text = '';
  const out = () => document.getElementById('ed-out');
  const paint = () => { if (out() && result) out().innerHTML = proposalsHTML(result); };

  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    ex: d => { document.getElementById('ed-q').value = EXAMPLES[+d.i]; haptic(4); },
    check: async () => {
      text = sheetVal('ed-q').trim();
      if (!text){ toast('Say what you want to change'); return; }
      const btn = document.getElementById('ed-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Thinking…';
      try{ result = await interpret(text); paint(); }
      catch(e){ toast(e.message || 'Could not read that'); }
      finally{ btn.disabled = false; btn.innerHTML = `${icon('spark', 17)} Check it`; }
    },
    tog: d => { const p = result?.props[+d.i]; if (p){ p.on = !p.on; haptic(4); paint(); } },
    apply: () => {
      const ops = result.props.filter(p => p.on).map(p => p.op);
      if (!ops.length) return;
      applyBatch(text, ops);
      haptic(); closeSheet();
      toast(`${ops.length} change${ops.length === 1 ? '' : 's'} made. Undo is in the same place.`);
      render();
    },
    undo: () => {
      const last = undoLast();
      if (last){ haptic(); toast('Undone'); document.getElementById('ed-hist').innerHTML = historyHTML(); render(); }
    },
  });
}

export const actions = { editwords: openEdit };
