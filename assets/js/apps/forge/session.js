/* ============================================================
   Training: a live session. The session screen and each exercise card in
   it, starting / finishing / exiting a session, ticking a day off, and the
   timer settings sheet.
   ============================================================ */

import { today, uid } from '../../core/store.js';
import { esc, toast, openSheet, closeSheet, bindActions, haptic } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { gearOf, kgToStack, stackConfigFor } from '../../data/swaps.js';
import { WARMUPS, TAG_STYLE } from '../../data/workouts.js';
import * as timer from '../../core/timer.js';
import * as coach from '../../core/coach.js';
import { openingFor } from './logging.js';
import { ui, dayOf, fmtSet, phase, ramp, render, repsFor, resolve, store, targetSets } from './state.js';

export function sessionHTML(sess){
  const d = dayOf(sess.day) || phase().days[0];
  const wu = WARMUPS[d.warmup];
  const totalSets = d.supersets.reduce((n,ss) =>
    n + ss.exercises.reduce((m,ex) => m + targetSets(ex, d.key), 0), 0);
  const doneSets = Object.values(sess.sets).reduce((n,arr) => n + arr.length, 0);

  return `
  <div class="card in" style="background:${d.tint};border-color:${d.line}">
    <div class="spread">
      <div class="grow">
        <div class="spread" style="align-items:baseline">
          <div class="card-title" style="color:${d.color}">${esc(d.title)}</div>
          <span class="tiny" style="color:${d.color};font-weight:800">${d.label}</span>
        </div>
        <div class="card-note" style="margin-top:3px">${esc(d.subtitle)}</div>
        <div class="tiny muted" style="margin-top:6px">${doneSets} of ${totalSets} sets logged${ramp().active ? ` · comeback week ${ramp().week}, lighter reps and weights` : ''}</div>
      </div>
      <button class="btn btn-sm btn-plain" data-act="abandon">Exit</button>
    </div>
    <div class="bar" style="background:rgba(0,0,0,.08);margin-top:14px">
      <i style="width:${totalSets ? doneSets/totalSets*100 : 0}%;background:${d.color}"></i>
    </div>
  </div>

  ${wu ? `<div class="card in in-2" style="margin-top:14px">
    <div class="spread" data-act="togglewu">
      <div class="grow">
        <div class="card-title">${icon('spark',17)} ${esc(wu.name)}</div>
        <div class="card-note" style="margin-top:3px">${esc(wu.why)}</div>
      </div>
      <span class="caret">▾</span>
    </div>
    <div id="wu-body" hidden style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft)">
      ${wu.items.map(i => `<div style="padding:8px 0">
        <b style="font-size:14.5px">${esc(i.n)}</b>
        <div class="tiny muted" style="margin-top:2px">${esc(i.d)}</div></div>`).join('')}
    </div>
  </div>` : ''}

  ${d.supersets.map((ss,i) => `
    <div class="sec">${esc(ss.label)}</div>
    <div class="card in" style="padding:0;overflow:hidden">
      <div style="padding:13px 16px;background:color-mix(in srgb, ${d.color} 6%, transparent);border-bottom:1px solid var(--line-soft)">
        <div class="tiny" style="line-height:1.55;color:var(--ink-2)">
          <b style="color:${d.color}">Why this pairing: </b>${esc(ss.rationale)}
        </div>
      </div>
      ${ss.exercises.map((ex,j) =>
        exerciseHTML(ex, `${i}-${j}`, sess, d, j < ss.exercises.length-1)).join('')}
    </div>`).join('')}

  ${d.extra ? `
    <div class="sec">${esc(d.extra.label)} · optional</div>
    <div class="card in" style="border:1.5px dashed color-mix(in srgb, ${d.color} 40%, transparent);background:transparent">
      ${d.extra.exercises.map((ex,i) => `
        <div class="spread" style="align-items:flex-start;padding:9px 0;${i>0?`border-top:1px solid color-mix(in srgb, ${d.color} 16%, transparent)`:''}">
          <div class="grow">
            <b style="font-size:14px">${esc(ex.name)}</b>
            <div class="tiny muted" style="margin-top:2px;line-height:1.5">${esc(ex.note)}</div>
          </div>
          <span class="tiny mono nowrap" style="color:${d.color};font-weight:700">${esc(ex.sets)} × ${esc(ex.reps)}</span>
        </div>`).join('')}
    </div>` : ''}

  <button class="btn btn-primary block" style="margin:20px 0 8px" data-act="finish">Finish session ✓</button>`;
}

function exerciseHTML(ex0, key, sess, d, hasNext){
  const ex = resolve(ex0, d.key);
  const swapped = ex.name !== ex.orig;
  const logged = sess.sets[key] || [];
  const rp = ramp();
  const rv = repsFor(ex);
  const bonus = rp.active ? 0 : coach.bonusFor(ui.bonus, d.key, ex.orig);
  const target = targetSets(ex, d.key, ex.orig);
  const prev = store.get().lastByEx[ex.name];
  const open = openingFor(ex.name, key);                 // what the next set will start at, and why
  const remaining = Math.max(0, target - logged.length);
  const doneAll = logged.length >= target;
  const ts = TAG_STYLE[ex.tag] || TAG_STYLE.Isolation;
  const straightInto = ex.rest === '0s';

  return `
  <div style="padding:15px 16px;${hasNext ? 'border-bottom:1px solid var(--line-soft)' : ''}">
    <div class="spread" style="align-items:flex-start;gap:10px">
      <div class="grow">
        <span class="badge" style="background:${ts.bg};color:${ts.fg}">${esc(ex.tag)}</span>
        ${bonus ? `<span class="badge accent" style="margin-left:6px" title="Added from your goal benchmark">+${bonus} focus</span>` : ''}
        <div style="font-weight:700;font-size:15px;margin-top:6px;${doneAll?'opacity:.55':''}">${esc(ex.name)}</div>
        ${swapped ? `<div class="tiny" style="margin-top:2px;color:var(--accent-1);font-weight:700">Swapped from ${esc(ex.orig)}</div>` : ''}
        <div class="tiny muted mono" style="margin-top:3px">
          ${logged.length}/${target} sets · ${esc(rv.text)}${/each/i.test(rv.text) ? '' : ' reps'}${rv.changed ? ` (usually ${esc(ex.reps)})` : ''} ·
          ${straightInto ? `<span style="color:${d.color};font-weight:700">→ straight into next</span>` : `${esc(ex.rest)} rest`}
          ${open.why === 'session' ? ` · next set ${open.w}kg${stackNote(ex.name, open.w)}`
            : open.why === 'ease' ? ` · ease in at ~${open.w}kg${stackNote(ex.name, open.w)} (last ${prev.w}kg)`
            : open.why === 'est' ? ` · try ${open.w}kg${stackNote(ex.name, open.w)} (est.)`
            : open.why === 'last' ? ` · last ${open.w}kg${stackNote(ex.name, open.w)}` : ''}
        </div>
      </div>
      <div style="display:flex;gap:7px;flex:none;align-items:center">
        <!-- Machines get taken. One tap to a same-pattern alternate beats
             standing around waiting or skipping the movement entirely. -->
        <button class="btn btn-plain btn-sm" data-act="swap" data-n="${esc(ex.name)}" data-o="${esc(ex.orig)}" data-dk="${d.key}"
                aria-label="Swap ${esc(ex.name)}" style="padding:10px 12px">${icon('repeat',15)}</button>
        <button class="btn ${doneAll?'btn-plain':'btn-soft'} btn-sm nowrap" data-act="addset" data-k="${key}" data-n="${esc(ex.name)}">
          ${doneAll ? '+ Extra' : '+ Set'}
        </button>
      </div>
    </div>

    ${ex.notes ? `<div class="tiny" style="margin-top:9px;color:var(--ink-2);background:var(--surface-2);
        padding:9px 11px;border-radius:11px;line-height:1.55">${esc(ex.notes)}</div>` : ''}

    ${remaining > 1 || (remaining === 1 && !logged.length) ? `<button class="btn btn-ghost btn-sm" style="margin-top:10px"
        data-act="fillsets" data-k="${key}" data-n="${esc(ex.name)}" data-c="${remaining}">
        Log all ${remaining} as planned${open.w !== null ? ` at ${open.w}kg` : ''}</button>` : ''}

    ${logged.length ? `<div class="chips" style="margin-top:10px">
        ${logged.map((s,i) => `<button class="chip on" style="font-size:12.5px;padding:7px 13px"
            data-act="editset" data-k="${key}" data-i="${i}" data-n="${esc(ex.name)}">${fmtSet(s)}</button>`).join('')}
      </div>
      <div class="tiny muted" style="margin-top:6px">Tap a set to add weight or remove it.</div>` : ''}
  </div>`;
}

/* On a cable or machine whose stack is labelled differently from the weight
   at your hand, show what the stack should read. Empty otherwise. */
function stackNote(name, kg){
  const g = gearOf(name, store.get().custom), c = stackConfigFor(g, store.get().stack);
  if (!c) return '';
  return ` (stack ${kgToStack(kg, c)}${c.unit === 'lb' ? 'lb' : ''})`;
}

/* One tap for the common case: you did the sets the plan said, at the
   weight you usually use. Fills every remaining set. */

export function newSession(k){
  const id = uid();
  store.update(s => {
    s.sessions[id] = { id, day:k, dayKey:today(), sets:{}, done:false, startedAt: Date.now() };
    s.activeId = id;
  });
  ui.tab = 'plan';
  return id;
}

export function startSession(k){ newSession(k); haptic(); render(); }

/* Finishing never requires logged sets — plenty of sessions happen
   without touching the phone, and refusing those makes history lie. */
export function finishSession(){
  store.update(st => {
    const sess = st.sessions[st.activeId];
    if (sess){
      sess.done = true;
      sess.endedAt = Date.now();
      /* Only keep a duration that is plausibly a workout. Forget to finish
         until the next morning and "14 hours" is noise, not data. */
      const mins = sess.startedAt ? Math.round((sess.endedAt - sess.startedAt) / 60000) : 0;
      if (mins >= 5 && mins <= 240) sess.mins = mins;
    }
    st.activeId = null;
  });
  timer.stop();
  haptic(20);
  toast('Session done ✓');
  render();
}

export function quickComplete(k){
  const name = dayOf(k)?.title || 'Session';
  store.update(s => {
    const id = uid();
    s.sessions[id] = { id, day:k, dayKey:today(), sets:{}, done:true, quick:true };
  });
  haptic(20);
  toast(`${name} ✓`);
  render();
}

export function undoToday(k){
  store.update(s => {
    const match = Object.values(s.sessions)
      .filter(x => x.done && x.day === k && x.dayKey === today())
      .sort((a,b) => (a.id > b.id ? -1 : 1))[0];
    if (match) delete s.sessions[match.id];
  });
  haptic();
  toast('Undone');
  render();
}

export function openTimerSheet(){
  const t = store.get().timer;
  const sess = store.get().activeId ? store.get().sessions[store.get().activeId] : null;
  const row = (k, title, body) => `
    <div class="spread" style="align-items:flex-start;gap:12px;padding:12px 0;border-top:1px solid var(--line-soft)">
      <div class="grow"><b style="font-size:14.5px">${title}</b>
        <div class="tiny muted" style="margin-top:3px;line-height:1.5">${body}</div></div>
      <button class="chip ${t[k]?'on':''}" data-act="tm-${k}" style="flex:none">${t[k] ? 'On' : 'Off'}</button>
    </div>`;
  openSheet(`
    <h2>Timer</h2>
    <p class="sub">${sess?.startedAt ? `Session started ${new Date(sess.startedAt).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}).toLowerCase()}.` : 'No session running.'}</p>
    <div style="margin-top:8px">
      ${row('auto',  'Auto rest timer', 'Starts counting down when you log a set, using the rest written for that exercise. Supersets go straight into the next movement, so they do not start one.')}
      ${row('awake', 'Keep the screen on', 'Stops the phone locking mid-workout so the timer stays visible.')}
      ${row('beep',  'Beep when rest ends', 'Respects your silent switch — if your phone is on silent you will only see it. iPhones cannot vibrate a web app.')}
    </div>
    ${sess ? `<button class="btn btn-plain block" style="margin-top:14px" data-act="tm-restart">Restart the clock from now</button>
      <div class="tiny muted" style="margin-top:6px;line-height:1.5">
        Use this if you started the session on the couch and only just got to the gym.</div>` : ''}
    <button class="btn btn-ghost block" style="margin-top:8px" data-act="close">Done</button>
  `);
  const flip = k => () => {
    store.update(s => { s.timer = { ...s.timer, [k]: !s.timer[k] }; });
    haptic(6); openTimerSheet(); render();
  };
  bindActions(document.querySelector('.sheet'), {
    'tm-auto': flip('auto'), 'tm-awake': flip('awake'), 'tm-beep': flip('beep'),
    'tm-restart': () => {
      store.update(s => { const x = s.sessions[s.activeId]; if (x) x.startedAt = Date.now(); });
      timer.clearRest(); closeSheet(); toast('Clock restarted'); render();
    },
    close: closeSheet,
  });
}

export const actions = {
  start: d => startSession(d.d),
  abandon: () => { store.update(s => { s.activeId = null; }); timer.stop(); render(); },
  togglewu: () => { const e = document.getElementById('wu-body'); if (e) e.hidden = !e.hidden; },
  tick: d => quickComplete(d.d),
  undo: d => undoToday(d.d),
  finish: finishSession,
};
