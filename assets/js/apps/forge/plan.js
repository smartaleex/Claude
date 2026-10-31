/* ============================================================
   Training: the Plan tab (up next, pick a session, how to progress) and
   its two banners (comeback ramp, legs advice).
   ============================================================ */

import { today } from '../../core/store.js';
import { esc, toast, haptic } from '../../core/ui.js';
import { PROGRESSION, LEGS_HONESTLY, sessionMinutes, totalExercises } from '../../data/workouts.js';
import * as cb from '../../core/comeback.js';
import { doneToday, nextDay, phase, ramp, render, store, thisWeekCount, weekGoal } from './state.js';

export function planHTML(){
  const p = phase();
  const next = nextDay();
  const wk = thisWeekCount();
  const goal = weekGoal(), rp = ramp();

  return `
  ${comebackBannerHTML(rp)}
  <div class="hero in">
    <div class="eyebrow">Up next</div>
    <div class="disp" style="font-size:28px;margin-top:6px">${esc(next.title)}</div>
    <div class="hero-cap">${esc(next.subtitle)} · ~${sessionMinutes(next)} min</div>
    <div class="bar"><i style="width:${Math.min(100, wk/goal*100)}%"></i></div>
    <div class="hero-cap" style="margin-top:8px">${wk} of ${goal} sessions done this week${wk >= cb.weekMinimum && wk < goal ? ' · a good week already' : ''}</div>
  </div>

  <button class="btn btn-primary block in in-2" style="margin-top:14px" data-act="start" data-d="${next.key}">
    Start ${esc(next.title)} →
  </button>

  <div class="card in in-2" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
    <div class="spread" style="align-items:baseline">
      <div class="card-title">Phase ${p.phase} · ${esc(p.name)}</div>
      <span class="tiny muted">${esc(p.weeks)}</span>
    </div>
    <div class="card-note" style="margin-top:6px;line-height:1.6">${esc(p.note)}</div>
  </div>

  <div class="sec">Pick today's session</div>
  <div class="stack" style="gap:9px">
    ${p.days.map(d => {
      const isDone = doneToday(d.key);
      return `<div class="rowcard" style="${isDone?'opacity:.72':''};border-left:3px solid ${d.color}">
        <button data-act="${isDone?'undo':'tick'}" data-d="${d.key}" aria-label="Mark done"
          style="width:30px;height:30px;border-radius:var(--r-av);flex:none;display:grid;place-items:center;
                 font-size:14px;font-weight:800;
                 background:${isDone?'var(--good)':'var(--bg-sunk)'};color:${isDone?'var(--bg)':'var(--faint)'}">${isDone?'✓':''}</button>
        <button class="grow" data-act="start" data-d="${d.key}" style="text-align:left">
          <div class="spread" style="align-items:baseline">
            <b style="${isDone?'text-decoration:line-through':''}">${esc(d.title)}</b>
            <span class="tiny" style="color:${d.color};font-weight:700">${d.label}</span>
          </div>
          <span class="sub">${esc(d.subtitle)}</span>
          <span class="sub" style="font-size:12px">${d.supersets.length} supersets · ${totalExercises(d)} exercises · ~${sessionMinutes(d)} min</span>
        </button>
        <span class="caret">›</span>
      </div>`;
    }).join('')}
  </div>
  <div class="tiny muted" style="margin:8px 2px 0">
    Tap the circle to tick a session off, or the name to open it and log sets.
  </div>

  ${store.get().legs !== 'original' ? legsHonestlyHTML() : ''}

  <div class="sec">How to progress</div>
  <div class="card in">
    ${PROGRESSION.map((x,i) => `
      <div style="padding:10px 0;${i<PROGRESSION.length-1?'border-bottom:1px solid var(--line-soft)':''}">
        <b style="font-size:14.5px">${esc(x.label)}</b>
        <div class="tiny muted" style="margin-top:3px;line-height:1.55">${esc(x.text)}</div>
      </div>`).join('')}
  </div>

  <div class="tiny muted center" style="margin:22px 0 8px">
    Not medical advice · consult a physio for shoulder-specific guidance
  </div>`;
}

function comebackBannerHTML(rp){
  const c = store.get().comeback, gap = cb.gapDays(store.get().sessions, today());
  if (rp.active){
    return `
  <div class="card in" style="margin-bottom:14px;background:var(--accent-tint);border-color:transparent">
    <div class="spread" style="align-items:baseline">
      <div class="card-title">Comeback · week ${rp.week} of ${rp.weeks}</div>
      <span class="tiny muted">${rp.daysLeft} day${rp.daysLeft === 1 ? '' : 's'} left</span>
    </div>
    <div class="card-note" style="margin-top:7px;line-height:1.6">
      Every set stays as written. Reps ${rp.reps === 'bottom' ? 'start at the bottom of each range' : rp.reps === 'mid' ? 'sit in the middle of each range' : 'are back to the full range'} and weights open about ${Math.round((1 - rp.weights) * 100)}% under last time. ${esc(rp.rpe)}
      Aim for ${cb.weekTarget(rp)} sessions; ${cb.weekMinimum} still counts. Easing in is how you get back to full strength without a setback.
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="rampoff">I do not need this, run the full program</button>
  </div>`;
  }
  if (gap != null && gap >= cb.GAP_DAYS && c?.off){
    return `<button class="card tight in" style="width:100%;text-align:left;margin-bottom:14px" data-act="rampon">
      <b style="font-size:14.5px">${gap} days since your last session</b>
      <div class="tiny muted" style="margin-top:4px;line-height:1.55">Tap to start a three-week comeback ramp.</div></button>`;
  }
  return '';
}

function legsHonestlyHTML(){
  return `
  <div class="sec">${esc(LEGS_HONESTLY.title)}</div>
  <div class="card in">
    ${LEGS_HONESTLY.lines.map((l, i) => `<p class="card-note" style="margin:${i ? '10px' : '0'} 0 0;line-height:1.6">${esc(l)}</p>`).join('')}
    <div class="hr"></div>
    <div class="tiny muted" style="line-height:1.6"><b>When to stop and get it looked at.</b> ${esc(LEGS_HONESTLY.flags)}</div>
  </div>`;
}

export const actions = {
  rampoff: () => { store.update(s => { s.comeback = { ...(s.comeback || {}), off:true }; }); haptic(); render(); },
  rampon: () => { store.update(s => { s.comeback = { start: today(), weeks: 3, off:false }; }); haptic(); toast('Comeback ramp started'); render(); },
};
