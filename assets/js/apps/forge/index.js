/* ============================================================
   Training (the Swimmer Build). Entry point: the HQ tile summary, mount, drawing a screen, and wiring each module's actions.
   Each other file in this folder owns one screen or job and exports its own `actions`; see docs/ARCHITECTURE.md.
   ============================================================ */

import { esc, holdScroll, bindActions } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { sessionMinutes } from '../../data/workouts.js';
import * as timer from '../../core/timer.js';
import * as coach from '../../core/coach.js';
import {
  ui, store, render, setRenderer, SHORT, phase, ramp, dayOf, nextDay, doneToday,
  thisWeekCount, weekGoal, weekInBlock, checkBlockRollover, checkComeback,
} from './state.js';
import { planHTML, actions as planActions } from './plan.js';
import { sessionHTML, newSession, openTimerSheet, actions as sessionActions } from './session.js';
import { actions as loggingActions } from './logging.js';
import { actions as swapActions } from './swap.js';
import { goalHTML, actions as goalActions } from './goal.js';
import { photosHTML, actions as photoActions } from './photos.js';
import { actions as physiqueActions } from './physique-ai.js';
import { historyHTML } from './history.js';
import { actions as adviceActions } from './advice.js';
import { actions as settingsActions } from './settings.js';

export async function summary(){
  await store.load();
  checkBlockRollover();
  checkComeback();
  const p = phase(), d = nextDay();
  return {
    headline: doneToday(d.key) ? 'Done for today ✓' : d.title,
    detail: ramp().active ? `Comeback week ${ramp().week} of ${ramp().weeks} · ${p.name}` : `Phase ${p.phase} · ${p.name} · week ${Math.min(weekInBlock(),8)} of 8`,
    badge: `${thisWeekCount()}/${weekGoal()}`,
    chips: p.days.map(day => ({
      label: SHORT[day.key] || day.title,
      act: 'forge-day',
      data: { d: day.key },
      on: doneToday(day.key),
    })),
  };
}

/** From the HQ tile — creates only; mount() does the rendering. */
export async function startFromHome(k){
  await store.load();
  newSession(k);
}

export async function mount(el){
  ui.root = el;
  await store.load();
  checkBlockRollover();
  checkComeback();
  render();
}

function paintView(){
  const active = store.get().activeId ? store.get().sessions[store.get().activeId] : null;
  const p = phase();
  ui.bonus = coach.bonusMap(p, store.get().focus);
  // A session opened before the timer existed has no start time; the
  // best available answer is "now", which the user can restart anyway.
  if (active && !active.startedAt) store.update(() => { active.startedAt = Date.now(); });
  ui.root.innerHTML = `
  <span id="forge-root" data-active="${active ? 1 : 0}" hidden></span>
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">The Swimmer Build</div>
        <h1 class="page-h1">${ui.tab==='plan' ? 'The plan' : ui.tab==='goal' ? 'The goal' : ui.tab==='photos' ? 'Progress' : 'History'}</h1>
        <div class="page-sub">Phase ${p.phase} · ${esc(p.name)} · week ${Math.min(weekInBlock(),8)} of 8</div>
      </div>
      <button class="chip" data-act="settings">${icon('settings',18)}</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:16px 0">
    ${[['plan','Plan'],['goal','Goal'],['photos','Photos'],['log','History']].map(([v,l]) =>
      `<button class="${ui.tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${ active && ui.tab==='plan' ? sessionHTML(active)
   : ui.tab==='plan' ? planHTML()
   : ui.tab==='goal' ? goalHTML()
   : ui.tab==='photos' ? photosHTML()
   : historyHTML() }`;

  bind();
  timer.configure({
    session: active,
    options: store.get().timer,
    minutes: active ? sessionMinutes(dayOf(active.day) || p.days[0]) : 0,
    openSettings: openTimerSheet,
  });
}

/* Drawing a screen replaces the view's HTML. holdScroll keeps the page the
   same height for a frame, so the scroll position survives (see core/ui.js).
   If drawing throws, show the snag card instead of leaving a frozen page. */
function renderNow(){
  try{ holdScroll(paintView); }
  catch (e){ console.error(e); snag(e); }
}
setRenderer(renderNow);

/* If a screen cannot be drawn, say so and offer a way out, rather than
   leaving a frozen page with nothing to tap. Nothing logged is touched. */
function snag(e){
  if (!ui.root) return;
  ui.root.innerHTML = `
  <div class="card in" style="margin-top:40px">
    <div class="card-title">That screen hit a snag</div>
    <p class="card-note" style="margin:8px 0 0;line-height:1.6">Everything you have logged is saved. Try again, and if it keeps happening, leave the session and reopen it.</p>
    <div class="tiny muted mono" style="margin-top:10px;word-break:break-word">${esc(String(e?.message || e))}</div>
    <button class="btn btn-primary block" style="margin-top:14px" data-act="retry">Try again</button>
    <button class="btn btn-plain block" style="margin-top:8px" data-act="leave">Leave this session</button>
    <button class="btn btn-ghost block" data-act="reload">Reload the app</button>
  </div>`;
  bindActions(ui.root, {
    retry: () => render(),
    leave: () => { store.update(s => { s.activeId = null; }); timer.stop(); render(); },
    reload: () => location.reload(),
  });
}

/* Every screen file owns the taps on its own buttons (its exported `actions`).
   To find what a button does, search the data-act name in this folder. */
function bind(){
  bindActions(ui.root, {
    tab: d => { ui.tab = d.v; render(); },
    ...planActions, ...sessionActions, ...loggingActions, ...swapActions, ...goalActions,
    ...photoActions, ...physiqueActions, ...adviceActions, ...settingsActions,
  });
}
