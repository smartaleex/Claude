/* ============================================================
   Training: the coach, on the session screen.

   Type what is going on, or tap "Ask the coach" from an exercise or the
   swap sheet. It answers, and when something should change it lays out
   the change with the same verdict and reasons as "Change it in your own
   words". Nothing changes until you apply it; the newest batch can be
   undone. The prompt and offline answer are in core/coach-chat.js.
   ============================================================ */

import { ask } from '../../core/ai.js';
import { esc, toast, haptic } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { parseEdits, resolveOps, benchmark, describe, LEVEL_TEXT } from '../../core/training-edit.js';
import { coachPrompt, coachOps, offlineCoach, OFFLINE_REPLY } from '../../core/coach-chat.js';
import { countSets } from '../../core/musclemap.js';
import { formSVG } from '../../core/form.js';
import { applyBatch, undoLast, bodyContext, contextNow } from './edit-apply.js';
import { phase, render, resolve, store, targetSets, ui, dayOf } from './state.js';

const CHIPS = ['The machine is taken', 'This hurts', 'Short on time today', 'Is today balanced?', 'More side delts'];
const BADGE = { good: 'good', check: 'warn', no: 'bad' };

async function interpret(text, day){
  const days = phase().days, swaps = store.get().swaps || {}, focus = ui.coach.focus;
  const week = countSets(days, (ex, d) => resolve(ex, d.key).name, (ex, d) => targetSets(ex, d.key, ex.name));
  const res = await ask({
    prompt: coachPrompt({ text, day, days, swaps, body: bodyContext(), phase: phase(), ramp: contextNow().ramp, focus, week }),
    maxTokens: 1400,
    offline: () => {
      const o = offlineCoach({ text, focus });
      if (o) return o;
      const p = parseEdits(text, days, swaps);
      return { reply: OFFLINE_REPLY, ops: Array.isArray(p) ? p : p.ops };
    },
  });
  const raw = coachOps(res.data?.ops).map(o => ({ ...o, day: o.day || day.key }));
  const { ops, notes } = resolveOps(raw, days, swaps);
  const ctx = contextNow();
  return {
    reply: String(res.data?.reply || res.data?.say || 'Done.'),
    source: res.source,
    aiError: res.error || null,          // AI is on but did not answer: say so and offer a retry
    notes,
    props: coachOps(ops).map(op => { const bm = benchmark(op, ctx); return { op, bm, on: bm.level !== 'no' }; }),
    applied: false,
  };
}

/** Open the coach on one exercise, from its form sheet or the swap sheet. */
export function askAbout(focus){
  ui.coach.focus = focus;
  ui.coach.result = null;
  if (!ui.coach.text.trim()) ui.coach.text = `${focus.name}: `;
  render();
  requestAnimationFrame(() => {
    const card = document.getElementById('coach'), q = document.getElementById('co-q');
    card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (q){ q.focus({ preventScroll: true }); q.setSelectionRange(q.value.length, q.value.length); }
  });
}

function resultHTML(r, day){
  const days = phase().days;
  const on = r.props.filter(p => p.on);
  return `
    <div class="coach-reply">${esc(r.reply)}</div>
    ${r.aiError ? `<div class="card tight sunk" style="margin-top:10px"><div class="tiny" style="line-height:1.55">The AI did not answer (${esc(r.aiError.replace(/^\w+: /, ''))}), so this is the rule-based answer.</div>
        <button class="btn btn-sm btn-plain" style="margin-top:8px" data-act="coachask">Try the AI again</button></div>`
      : `<div class="tiny muted" style="margin-top:6px">${r.source === 'Offline' ? 'Read with simple rules (AI is off).' : `From ${esc(r.source)}.`}</div>`}
    ${r.props.map((p, i) => `
      <div class="card tight coach-prop ${p.on ? '' : 'sunk'}">
        ${p.op.type === 'swap' && formSVG(p.op.to) ? `<span class="fm-thumb">${formSVG(p.op.to, { size: 40 })}</span>` : ''}
        <div class="grow" style="min-width:0">
          <div class="spread" style="align-items:flex-start;gap:8px">
            <b style="font-size:14px;line-height:1.4">${esc(describe(p.op, days))}</b>
            <span class="badge ${BADGE[p.bm.level]}" style="flex:none">${LEVEL_TEXT[p.bm.level]}</span>
          </div>
          ${p.op.why ? `<div class="tiny" style="margin-top:6px;line-height:1.55">${esc(p.op.why)}</div>` : ''}
          ${p.bm.reasons.slice(0, 2).map(t => `<div class="tiny muted" style="margin-top:5px;line-height:1.55">${esc(t)}</div>`).join('')}
          ${r.applied ? '' : `<button class="chip ${p.on ? 'on' : ''}" data-act="coachtog" data-i="${i}" style="margin-top:9px;font-size:12px;padding:7px 12px">${p.on ? 'Applying this' : 'Skipped'}</button>`}
        </div>
      </div>`).join('')}
    ${r.notes.length ? `<div class="tiny muted" style="margin-top:8px;line-height:1.55">${r.notes.map(esc).join('<br>')}</div>` : ''}
    ${r.applied ? `<div class="spread" style="margin-top:12px"><span class="tiny" style="color:var(--good);font-weight:700">Applied to ${esc(day.title)}.</span>
        <button class="btn btn-sm btn-plain" data-act="coachundo">Undo</button></div>`
      : on.length ? `<button class="btn btn-primary block" style="margin-top:12px" data-act="coachapply">Apply ${on.length} change${on.length === 1 ? '' : 's'}</button>` : ''}`;
}

/** The coach card for today's session. */
export function coachHTML(day){
  const c = ui.coach;
  return `
  <div class="sec" id="coach">Coach</div>
  <div class="card in coach">
    <div class="card-note">Ask anything, or say what is wrong: pain, a machine that is taken, short on time. It answers and, if an exercise should change, sets the swap up for you to apply. The 4 / 3 / 3 sets stay as they are.</div>
    ${c.focus ? `<div class="chips" style="margin-top:10px"><button class="chip on" data-act="coachunfocus" style="font-size:12px;padding:7px 12px">About: ${esc(c.focus.name)} ✕</button></div>` : ''}
    <textarea class="textarea" id="co-q" style="margin-top:10px;min-height:72px" placeholder="e.g. My knees hurt after the RDLs, what should I do instead?">${esc(c.text)}</textarea>
    <div class="chips" style="margin-top:8px">${CHIPS.map((t, i) => `<button class="chip" data-act="coachchip" data-i="${i}" style="font-size:12px;padding:7px 11px">${esc(t)}</button>`).join('')}</div>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="coachask" ${c.busy ? 'disabled' : ''}>${c.busy ? '<span class="spin"></span> Thinking…' : `${icon('spark', 17)} Ask the coach`}</button>
    ${c.result ? resultHTML(c.result, day) : ''}
  </div>`;
}

/* Keep what is typed across redraws (the session screen redraws on every logged set). */
export function bindCoach(root){
  if (root.__coachBound) return;
  root.__coachBound = true;
  root.addEventListener('input', e => { if (e.target.id === 'co-q') ui.coach.text = e.target.value; });
}

const activeDay = () => dayOf(store.get().sessions[store.get().activeId]?.day) || phase().days[0];

export const actions = {
  coachchip: d => { const t = CHIPS[+d.i]; ui.coach.text = ui.coach.focus ? `${ui.coach.focus.name}: ${t.toLowerCase()}` : t; haptic(4); render(); },
  coachunfocus: () => { ui.coach.focus = null; render(); },
  coachask: async () => {
    const text = (document.getElementById('co-q')?.value || ui.coach.text).trim();
    if (!text){ toast('Say what is going on'); return; }
    ui.coach.text = text; ui.coach.busy = true; render();
    try{ ui.coach.result = await interpret(text, activeDay()); }
    catch(e){ toast(e.message || 'Could not reach the coach'); }
    finally{ ui.coach.busy = false; render(); }
  },
  coachtog: d => { const p = ui.coach.result?.props[+d.i]; if (p){ p.on = !p.on; haptic(4); render(); } },
  coachapply: () => {
    const r = ui.coach.result, ops = r?.props.filter(p => p.on).map(p => p.op) || [];
    if (!ops.length) return;
    applyBatch(`Coach: ${ui.coach.text}`, ops);
    r.applied = true;
    haptic(); toast(`${ops.length} change${ops.length === 1 ? '' : 's'} made`);
    render();
  },
  coachundo: () => { if (undoLast()){ ui.coach.result.applied = false; haptic(); toast('Undone'); render(); } },
};
