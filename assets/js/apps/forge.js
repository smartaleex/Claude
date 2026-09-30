/* ============================================================
   Forge — The Swimmer Build.

   Renders Alex's own program: 4 days, 3 supersets each, with the
   superset rationales, per-exercise coaching notes, rest values and
   optional extra-time blocks carried over from the original artifact.
   ============================================================ */

import { Slice, today, dayKey, keyToDate, daysBetween, uid, fmtDayShort } from '../core/store.js';
import { ask, aiStatus } from '../core/ai.js';
import {
  esc, num, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic,
} from '../core/ui.js';
import { icon } from '../core/icons.js';
import { swapsFor, GEAR_STYLE, convertWeight, loadIndex } from '../data/swaps.js';
import { compress, addPhoto, listPhotos, deletePhoto, updatePhoto, blobToImage, urlFor, releaseUrls } from '../core/photos.js';
import * as timer from '../core/timer.js';
import * as coach from '../core/coach.js';
import {
  PHASES, WARMUPS, PROGRESSION, TAG_STYLE, PHYSIQUE,
  weeklyVolume, sessionMinutes, totalExercises,
} from '../data/workouts.js';

const store = new Slice('forge', {
  blockIndex: 1,          // Phase 2 was current in the original artifact
  blockStart: today(),
  sessions: {},           // id -> { day, dayKey, sets:{ exKey:[{w}] }, done }
  lastByEx: {},           // exercise name -> { w, est? }  (est = converted from another machine, not lifted yet)
  swaps: {},              // 'dayKey|program exercise' -> the alternative you chose; applies everywhere until reverted
  activeId: null,
  timer: { auto:true, awake:true, beep:true },   // rest timer behaviour
  focus: {},              // muscle -> extra weekly sets, applied from a goal benchmark
  focusMeta: null,        // { t } when it was applied
  photoAI: false,         // has agreed to photos being sent to Gemini
  readings: { progress:null, benchmark:null },   // latest AI reads, so a view does not re-spend quota
});

/* A set is just a tick; weight is optional metadata on top. In the gym
   you want one tap, not a form. Reps live in the program, not the log. */
const setWeight = s => (s && typeof s === 'object') ? s.w : null;
const fmtSet = s => {
  const w = setWeight(s);
  return (w === null || w === undefined || w === '') ? '✓' : `${w}kg`;
};

let tab = 'plan';
let root = null;
let BONUS = {};            // 'dayKey|exercise' -> extra sets from the focus boosts

const phase = () => PHASES[store.get().blockIndex % PHASES.length];
const weekInBlock = () => Math.floor(daysBetween(store.get().blockStart, today()) / 7) + 1;
const dayOf = k => phase().days.find(d => d.key === k);

/* Phases run 6-8 weeks. Roll at 8 and loop back round to Phase 1. */
function checkBlockRollover(){
  if (weekInBlock() > 8){
    store.update(s => {
      s.blockIndex = (s.blockIndex + 1) % PHASES.length;
      s.blockStart = today();
    });
    return true;
  }
  return false;
}

/** Next up = the day least recently trained. */
function nextDay(){
  const done = Object.values(store.get().sessions).filter(s => s.done);
  let best = phase().days[0], bestTime = Infinity;
  for (const d of phase().days){
    const last = done.filter(s => s.day === d.key).map(s => s.dayKey).sort().at(-1);
    const t = last ? keyToDate(last).getTime() : 0;
    if (t < bestTime){ bestTime = t; best = d; }
  }
  return best;
}

const doneCount = () => Object.values(store.get().sessions).filter(s => s.done).length;
const doneToday = k => Object.values(store.get().sessions)
  .some(s => s.done && s.day === k && s.dayKey === today());

function thisWeekCount(){
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mk = dayKey(monday);
  return Object.values(store.get().sessions).filter(s => s.done && s.dayKey >= mk).length;
}

/* ---------------- summary (HQ tile) ---------------- */
const SHORT = { d1:'Back/Bi', d2:'Chest/Tri', d3:'Legs', d4:'Delts/Arms' };

export async function summary(){
  await store.load();
  checkBlockRollover();
  const p = phase(), d = nextDay();
  return {
    headline: doneToday(d.key) ? 'Done for today ✓' : d.title,
    detail: `Phase ${p.phase} · ${p.name} · week ${Math.min(weekInBlock(),8)} of 8`,
    badge: `${thisWeekCount()}/4`,
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

/* ---------------- mount ---------------- */
export async function mount(el){
  root = el;
  await store.load();
  checkBlockRollover();
  render();
}

function paintView(){
  const active = store.get().activeId ? store.get().sessions[store.get().activeId] : null;
  const p = phase();
  BONUS = coach.bonusMap(p, store.get().focus);
  // A session opened before the timer existed has no start time; the
  // best available answer is "now", which the user can restart anyway.
  if (active && !active.startedAt) store.update(() => { active.startedAt = Date.now(); });
  root.innerHTML = `
  <span id="forge-root" data-active="${active ? 1 : 0}" hidden></span>
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">The Swimmer Build</div>
        <h1 class="page-h1">${tab==='plan' ? 'The plan' : tab==='goal' ? 'The goal' : tab==='photos' ? 'Progress' : 'History'}</h1>
        <div class="page-sub">Phase ${p.phase} · ${esc(p.name)} · week ${Math.min(weekInBlock(),8)} of 8</div>
      </div>
      <button class="chip" data-act="settings">${icon('settings',18)}</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:16px 0">
    ${[['plan','Plan'],['goal','Goal'],['photos','Photos'],['log','History']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${ active && tab==='plan' ? sessionHTML(active)
   : tab==='plan' ? planHTML()
   : tab==='goal' ? goalHTML()
   : tab==='photos' ? photosHTML()
   : historyHTML() }`;

  bind();
  timer.configure({
    session: active,
    options: store.get().timer,
    minutes: active ? sessionMinutes(dayOf(active.day) || p.days[0]) : 0,
    openSettings: openTimerSheet,
  });
}

/* Re-rendering swaps the whole view via innerHTML. For a moment the page
   has no height, so the browser clamps scrollY to 0 and you get thrown to
   the top — which is what happened every time a set or a number was
   logged. Capture the offset, repaint, put it back. */
function render(){
  const y = window.scrollY;
  paintView();
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
}

/* The exercise as it should appear right now: your chosen alternative if
   you picked one, else the program's own. The original name is kept in
   `orig` because the program's structure (focus boosts, swap keys) is
   defined by it. */
const swapKey = (dk, name) => `${dk}|${name}`;
const resolve = (ex, dk) => {
  const alt = store.get().swaps?.[swapKey(dk, ex.name)];
  return alt ? { ...ex, name: alt, orig: ex.name } : { ...ex, orig: ex.name };
};

/* ---------------- plan ---------------- */
function planHTML(){
  const p = phase();
  const next = nextDay();
  const wk = thisWeekCount();

  return `
  <div class="hero in">
    <div class="eyebrow" style="color:rgba(255,255,255,.75)">Up next</div>
    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:28px;letter-spacing:-.03em;margin-top:6px">${esc(next.title)}</div>
    <div class="hero-cap">${esc(next.subtitle)} · ~${sessionMinutes(next)} min</div>
    <div class="bar"><i style="width:${wk/4*100}%"></i></div>
    <div class="hero-cap" style="margin-top:8px">${wk} of 4 sessions done this week</div>
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
      const last = Object.values(store.get().sessions)
        .filter(s => s.done && s.day === d.key).map(s => s.dayKey).sort().at(-1);
      const isDone = doneToday(d.key);
      return `<div class="rowcard" style="${isDone?'opacity:.72':''};border-left:3px solid ${d.color}">
        <button data-act="${isDone?'undo':'tick'}" data-d="${d.key}" aria-label="Mark done"
          style="width:30px;height:30px;border-radius:99px;flex:none;display:grid;place-items:center;
                 font-size:14px;font-weight:800;
                 background:${isDone?'var(--good)':'var(--bg-sunk)'};color:${isDone?'#fff':'var(--faint)'}">${isDone?'✓':''}</button>
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

/* ---------------- live session ---------------- */
function sessionHTML(sess){
  const d = dayOf(sess.day) || phase().days[0];
  const wu = WARMUPS[d.warmup];
  const totalSets = d.supersets.reduce((n,ss) =>
    n + ss.exercises.reduce((m,ex) => m + (parseInt(ex.sets,10)||1) + coach.bonusFor(BONUS, d.key, ex.name), 0), 0);
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
        <div class="tiny muted" style="margin-top:6px">${doneSets} of ${totalSets} sets logged</div>
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
      <div style="padding:13px 16px;background:${d.color}0C;border-bottom:1px solid var(--line-soft)">
        <div class="tiny" style="line-height:1.55;color:var(--ink-2)">
          <b style="color:${d.color}">Why this pairing: </b>${esc(ss.rationale)}
        </div>
      </div>
      ${ss.exercises.map((ex,j) =>
        exerciseHTML(ex, `${i}-${j}`, sess, d, j < ss.exercises.length-1)).join('')}
    </div>`).join('')}

  ${d.extra ? `
    <div class="sec">${esc(d.extra.label)} · optional</div>
    <div class="card in" style="border:1.5px dashed ${d.color}55;background:transparent">
      ${d.extra.exercises.map((ex,i) => `
        <div class="spread" style="align-items:flex-start;padding:9px 0;${i>0?`border-top:1px solid ${d.color}22`:''}">
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
  const bonus = coach.bonusFor(BONUS, d.key, ex.orig);
  const target = (parseInt(ex.sets, 10) || 1) + bonus;
  const prev = store.get().lastByEx[ex.name];
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
          ${logged.length}/${target} sets · ${esc(ex.reps)} reps ·
          ${straightInto ? `<span style="color:${d.color};font-weight:700">→ straight into next</span>` : `${esc(ex.rest)} rest`}
          ${prev?.w != null ? ` · ${prev.est ? 'try ' : 'last '}${prev.w}kg${prev.est ? ' (est.)' : ''}` : ''}
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

    ${logged.length ? `<div class="chips" style="margin-top:10px">
        ${logged.map((s,i) => `<button class="chip on" style="font-size:12.5px;padding:7px 13px"
            data-act="editset" data-k="${key}" data-i="${i}" data-n="${esc(ex.name)}">${fmtSet(s)}</button>`).join('')}
      </div>
      <div class="tiny muted" style="margin-top:6px">Tap a set to add weight or remove it.</div>` : ''}
  </div>`;
}

/* ---------------- goal ---------------- */
function goalHTML(){
  // Bodyweight lives in Fuel — one source of truth, read it from there.
  let weights = {};
  try{ weights = JSON.parse(localStorage.getItem('alexhq:fuel') || '{}').weights || {}; }catch{}
  const keys = Object.keys(weights).sort();
  const cur = keys.length ? weights[keys.at(-1)] : PHYSIQUE.start;
  const prog = Math.max(0, Math.min(100, (cur - PHYSIQUE.start) / (PHYSIQUE.goal - PHYSIQUE.start) * 100));

  let rate = null;
  if (keys.length >= 2){
    const wks = Math.max(1, (keyToDate(keys.at(-1)) - keyToDate(keys[0])) / 6048e5);
    rate = (weights[keys.at(-1)] - weights[keys[0]]) / wks;
  }

  return `
  <div class="hero in">
    <div class="eyebrow" style="color:rgba(255,255,255,.75)">Swimmer build</div>
    <div class="spread" style="align-items:flex-end;margin-top:6px">
      <div><div class="hero-num" style="font-size:44px">${round(cur,1)}<span style="font-size:22px">kg</span></div>
        <div class="hero-cap">from ${PHYSIQUE.start} → ${PHYSIQUE.goal}kg</div></div>
      <div class="hero-side" style="font-size:28px">${Math.round(prog)}%</div>
    </div>
    <div class="bar"><i style="width:${prog}%"></i></div>
  </div>

  <div class="card in in-2" style="margin-top:14px">
    <div class="card-title">What actually closes the gap</div>
    <p class="card-note" style="margin-top:8px">${esc(PHYSIQUE.note)}</p>
    <div class="hr"></div>
    ${[
      ['Side & rear delts','Shoulder width is the whole illusion. Phase 3 doubles their frequency for exactly this reason.'],
      ['Lat width','Wide grips and straight-arm work. Width makes the waist look smaller without losing a kilo.'],
      ['Upper chest','Incline only. A high chest reads swimmer; a low one reads gym.'],
      ['Posture','Face pulls, chest-supported rows, wall slides. Rounded shoulders hide everything you build.'],
    ].map(([t,x]) => `<div style="padding:10px 0">
      <b style="font-size:14.5px">${t}</b>
      <div class="tiny muted" style="margin-top:2px;line-height:1.55">${x}</div></div>`).join('')}
  </div>

  ${rate !== null ? `
  <div class="card in in-3" style="margin-top:14px">
    <div class="card-title">Rate of gain</div>
    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:30px;margin:8px 0 4px;
                color:${rate < PHYSIQUE.rateLo ? 'var(--warn)' : rate <= PHYSIQUE.rateHi ? 'var(--good)' : 'var(--bad)'}">
      ${rate>=0?'+':''}${round(rate,2)} kg/week
    </div>
    <div class="card-note">${
      rate < PHYSIQUE.rateLo ? 'Too slow to be building much. Add 150-200 kcal a day in Fuel.'
      : rate <= PHYSIQUE.rateHi ? 'Ideal. This is the range where the gain is mostly muscle.'
      : 'Faster than you want. Pull back about 200 kcal — the extra is going on as fat.'
    }</div>
  </div>` : `
  <div class="card in in-3" style="margin-top:14px">
    <div class="card-note">Log your bodyweight in Fuel → Trends a couple of times and this will show whether you're gaining at the right speed.</div>
  </div>`}

  ${whyHTML()}

  ${focusHTML()}

  ${volumeHTML()}

  <button class="btn btn-plain block in" style="margin-top:14px" data-act="advice">${icon('spark',17)} Ask about form or a swap</button>`;
}

/* The reasoning, written down. "Trust the plan" is worth nothing when
   you are tired and the mirror is arguing with you; being able to read
   why each choice was made is what makes it survive a bad month. */
function whyHTML(){
  return `
  <div class="card in" style="margin-top:14px">
    <div class="card-title">Why this works</div>
    <div class="card-note" style="margin-top:5px">
      The swimmer look is a ratio, not a weight. Everything below serves one number.
    </div>

    <div class="card tight sunk" style="margin-top:13px">
      <div class="tiny muted" style="line-height:1.6">
        <b>Shoulder-to-waist.</b> A "V-taper" is just wide shoulders over a narrow waist,
        and it is read as a <i>ratio</i> by the eye — around 1.6 is where a physique starts
        looking athletic rather than simply lean. You can move that ratio two ways: widen
        the top, or narrow the bottom. Narrowing has a floor, because your waist is mostly
        skeleton. Widening does not.
      </div>
    </div>

    <div class="stack" style="gap:11px;margin-top:13px">
      ${[
        ['Side delts are the highest-leverage muscle you own',
         'They sit at the widest point of your frame, so a centimetre there changes the outline more than a centimetre anywhere else. They are also small, recover fast, and tolerate being trained three times a week. This is why the program hammers them and why lateral raises appear on more days than chest does.'],
        ['Lats change the outline, not just the back',
         'Width comes from the lats flaring out below the armpit. It reads from the front, which is the angle you actually see yourself from. Vertical pulling and straight-arm work drive it; rows build thickness, which is a different thing.'],
        ['Upper chest, not chest',
         'A full upper chest fills the line under the collarbone and continues the shoulder shelf across. A big lower chest does the opposite — it drops the line and reads heavy. So every press in this program is inclined.'],
        ['Traps are deliberately kept light',
         'Heavy shrugs build the slope between neck and shoulder, which visually narrows the shoulder line and works directly against the taper. The program keeps them at maintenance on purpose.'],
        ['Arms are not a vanity block here',
         'They are the part of you closest to the viewer in almost every photo, and they are currently your weakest link relative to the goal. Triceps are roughly two thirds of arm size, which is why they get more volume than biceps.'],
        ['The waist is a kitchen problem',
         'No amount of core work narrows a midsection — that is body fat and skeletal width. Training the core adds thickness, which is why it is kept to a few sets. What you eat decides that number.'],
      ].map(([t,x]) => `
        <div>
          <b style="font-size:14.5px;line-height:1.4;display:block">${t}</b>
          <div class="tiny muted" style="margin-top:4px;line-height:1.6">${x}</div>
        </div>`).join('')}
    </div>

    <div class="card tight" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
      <div class="tiny" style="line-height:1.6">
        <b>The honest timeline.</b> Shoulder and arm width at your training age moves in
        months, not weeks — expect a visible difference at around twelve weeks and a
        clear one at six months, provided you are eating enough to build with. That last
        clause is the one that decides it.
      </div>
    </div>
  </div>`;
}

/* Weekly sets per muscle for the current phase — the honesty check that
   the program targets the goal rather than just looking busy. */
function volumeHTML(){
  const p = phase();
  const ap = coach.appliedTotals(p, store.get().focus);
  const vol = weeklyVolume(p).map(([m, n]) => [m, n + (ap[m] || 0)]).sort((a, b) => b[1] - a[1]);
  const max = vol[0]?.[1] || 1;
  const PRIORITY = ['Side delts','Rear delts & traps','Lats','Upper back'];

  const delts = vol.filter(v => v[0].includes('delts')).reduce((n,v) => n+v[1], 0);
  const back  = vol.filter(v => ['Lats','Upper back'].includes(v[0])).reduce((n,v) => n+v[1], 0);
  const chest = vol.find(v => v[0] === 'Chest')?.[1] || 0;
  const side  = vol.find(v => v[0] === 'Side delts')?.[1] || 0;

  return `
  <div class="card in" style="margin-top:14px">
    <div class="card-title">Weekly volume · Phase ${p.phase}</div>
    <div class="card-note" style="margin:4px 0 14px">
      Sets per muscle across the four days. For a V-taper, delts and back want to sit above chest.
    </div>
    ${vol.map(([m,n]) => {
      const pri = PRIORITY.includes(m);
      return `<div style="margin-bottom:9px">
        <div class="spread" style="margin-bottom:4px">
          <span style="font-size:13.5px;${pri?'font-weight:700':'color:var(--muted)'}">${esc(m)}</span>
          <span class="tiny mono" style="${pri?'font-weight:700;color:var(--accent-1)':'color:var(--muted)'}">${n}</span>
        </div>
        <div class="meter-track" style="background:var(--bg-sunk);height:7px">
          <div class="meter-fill" style="width:${n/max*100}%;height:7px;background:${pri?'var(--accent-1)':'var(--line)'}"></div>
        </div>
      </div>`;
    }).join('')}
    <div class="hr"></div>
    <div class="grid3" style="gap:8px">
      <div><div class="tiny muted">Delts</div><b class="mono" style="font-size:16px;color:var(--accent-1)">${delts}</b></div>
      <div><div class="tiny muted">Back</div><b class="mono" style="font-size:16px;color:var(--accent-1)">${back}</b></div>
      <div><div class="tiny muted">Chest</div><b class="mono" style="font-size:16px">${chest}</b></div>
    </div>
    <div class="tiny muted" style="margin-top:10px;line-height:1.55">
      ${side < 6
        ? `Side delts are on ${side} sets a week here — low for a width goal. Phase 3 lifts that to 11 by training them twice a week.`
        : `Side delts on ${side} sets a week, chest down to ${chest}. That's the ratio that builds the V.`}
    </div>
  </div>`;
}

/* ---------------- progress photos ----------------
   The scale is a bad instrument for this goal. On a lean bulk it moves
   for water, food and salt, and it says nothing at all about shoulder
   width — which is the entire point. Photos in the same pose a month
   apart show the change the scale cannot.

   Stored in IndexedDB via core/photos.js, never in localStorage: a few
   base64 images would exhaust the quota and break every other app.

   Photos only leave the device when a "Send to Gemini" button is tapped,
   and only after an explicit one-time agreement. Everything else here —
   the slider comparison, date editing, the weight and volume context —
   works with no network and no key. */
let photoCache = null;     // physique photos, oldest first
let goalCache = null;      // goal reference photos
let cmpA = null, cmpB = null;   // chosen "before"/"after" ids (null = first / latest)
let askText = '';
let busy = null;           // 'progress' | 'benchmark' | null
const MAX_GOAL = 3;

const fuelData = () => { try{ return JSON.parse(localStorage.getItem('alexhq:fuel') || '{}'); }catch{ return {}; } };

function loadPhotos(){
  Promise.all([listPhotos('physique'), listPhotos('goal')])
    .then(([a, b]) => { photoCache = a; goalCache = b; render(); });
}

/** The two photos currently chosen. Defaults to first and latest. */
function pair(){
  const s = photoCache || [];
  if (!s.length) return [null, null];
  const byId = id => s.find(x => x.id === id);
  return [byId(cmpA) || s[0], byId(cmpB) || s[s.length - 1]];
}

const dateOf = sh => fmtDayShort(dayKey(sh.t));

function photosHTML(){
  if (photoCache === null){
    loadPhotos();
    return `<div class="card in"><div class="card-note">Loading…</div></div>`;
  }
  const shots = photoCache;
  const [a, b] = pair();
  const two = shots.length >= 2 && a && b && a.id !== b.id;
  const ai = aiStatus();
  const rd = store.get().readings || {};

  return `
  <div class="card in">
    <div class="card-title">Same pose, same light</div>
    <p class="card-note" style="margin-top:7px;line-height:1.6">
      Relaxed front, arms at your sides, same spot and same time of day — morning, before food, is
      the most consistent. Consistency matters more than the photo being flattering; the point is
      that two shots a month apart are actually comparable.
    </p>
    <div class="row" style="margin-top:14px;gap:9px">
      <button class="btn btn-primary grow" data-act="shoot">${icon('camera',18)} Take one</button>
      <button class="btn btn-plain" data-act="pick">From library</button>
    </div>
  </div>

  ${!shots.length ? empty(icon('camera',34), 'No photos yet.<br>The first one is the baseline — it only gets useful from the second onward.') : `

    ${shots.length >= 2 ? compareHTML(shots, a, b) : ''}

    <div class="sec">Ask about your progress</div>
    <div class="card in">
      <p class="card-note" style="line-height:1.6">
        An AI reading of ${two ? 'the two photos above' : 'your photo'} — what has visibly changed, what
        has not, and what to do next. It is one opinion from phone photos: lighting, pose and pump move
        what a photo shows more than a month of training does.
      </p>
      <textarea class="textarea" id="ask-q" style="margin-top:12px;min-height:64px"
        placeholder="Optional — e.g. are my shoulders getting wider?">${esc(askText)}</textarea>
      ${ai.tier === 3 ? `
        <div class="tiny" style="margin-top:10px;color:var(--warn);line-height:1.55">
          Needs a free Gemini key. Add one from the settings icon on the HQ tab.</div>` : `
        <button class="btn btn-primary block" style="margin-top:12px" data-act="readprogress" ${busy?'disabled':''}>
          ${busy === 'progress' ? '<span class="spin"></span> Reading…' : `${icon('spark',17)} Send ${two ? '2 photos' : '1 photo'} to Gemini`}
        </button>
        <div class="tiny muted" style="margin-top:9px;line-height:1.55">
          Sends only the photo${two ? 's' : ''} shown${store.get().photoAI ? '' : ' — and asks first'}.
          ${store.get().photoAI ? `<button class="tiny" style="color:var(--accent-1);font-weight:700" data-act="photoaioff">Turn photo analysis off</button>` : ''}
        </div>`}
    </div>
    ${rd.progress ? progressResultHTML(rd.progress) : ''}

    <div class="sec">All ${shots.length}</div>
    <div class="grid3" style="gap:9px">
      ${[...shots].reverse().map(sh => `
        <button data-act="viewphoto" data-id="${sh.id}" style="position:relative;border-radius:var(--r-sm);
                overflow:hidden;box-shadow:var(--clay-sm);aspect-ratio:3/4">
          <img src="${urlFor(sh)}" style="width:100%;height:100%;object-fit:cover;display:block">
          <span style="position:absolute;left:0;right:0;bottom:0;padding:5px;font-size:10px;font-weight:700;
                color:#fff;background:linear-gradient(to top,rgba(0,0,0,.6),transparent)">
            ${esc(dateOf(sh))}</span>
        </button>`).join('')}
    </div>
    <div class="tiny muted center" style="margin-top:10px;line-height:1.55">
      Tap a photo to change its date or delete it.
    </div>`}

  ${goalHTML2(ai, shots)}

  <div class="tiny muted center" style="margin-top:18px;line-height:1.55">
    Photos are stored on this device. They only leave it when you tap a “Send to Gemini” button.
    They are not part of the Settings backup — that file is meant to stay small enough to email yourself.
  </div>`;
}

/* A before/after slider. Works with no network and no key, and is the
   honest offline answer to "how am I doing": your own eyes, same pose. */
function compareHTML(shots, a, b){
  const opt = (sel) => shots.map(sh =>
    `<option value="${sh.id}" ${sh.id === sel.id ? 'selected' : ''}>${esc(dateOf(sh))}</option>`).join('');
  const gap = Math.abs(daysBetween(dayKey(a.t), dayKey(b.t)));
  return `
    <div class="sec">Then and now</div>
    <div class="card in" style="padding:0;overflow:hidden">
      <div class="cmp" id="cmp" style="--pos:50%">
        <img class="cmp-after"  src="${urlFor(b)}" alt="After">
        <img class="cmp-before" src="${urlFor(a)}" alt="Before">
        <span class="cmp-tag l">${esc(dateOf(a))}</span>
        <span class="cmp-tag r">${esc(dateOf(b))}</span>
        <span class="cmp-line"></span>
      </div>
      <div style="padding:14px 16px 4px">
        <input type="range" min="0" max="100" value="50" class="cmp-range" aria-label="Slide between before and after"
               oninput="document.getElementById('cmp').style.setProperty('--pos', this.value + '%')">
      </div>
      <div class="grid2" style="gap:9px;padding:6px 16px 6px">
        <div><label class="label" style="font-size:10px">Before</label>
          <select class="input" data-change="cmpa" style="padding:10px">${opt(a)}</select></div>
        <div><label class="label" style="font-size:10px">After</label>
          <select class="input" data-change="cmpb" style="padding:10px">${opt(b)}</select></div>
      </div>
      <div class="tiny muted center" style="padding:6px 12px 14px">
        ${gap} day${gap === 1 ? '' : 's'} apart
      </div>
    </div>`;
}

/* ---- AI result cards ---- */
const DIR = { up:['Up','good'], same:['Same','neutral'], down:['Down','warn'], unclear:['Unclear','neutral'] };

function progressResultHTML(r){
  const d = r.data;
  return `
  <div class="card in" style="margin-top:12px">
    <div class="tiny muted" style="letter-spacing:.12em;text-transform:uppercase;font-weight:800">
      Reading · ${esc(fmtDayShort(dayKey(r.t)))} · ${r.n} photo${r.n>1?'s':''}
    </div>
    ${d.headline ? `<div style="font-family:'Sora',sans-serif;font-weight:700;font-size:17px;line-height:1.4;margin-top:8px">${esc(d.headline)}</div>` : ''}
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

/* ---- goal reference + benchmark ---- */
function goalHTML2(ai, shots){
  const goals = goalCache || [];
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
            style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:99px;
                   background:rgba(13,14,20,.78);color:#fff;font-size:11px;line-height:1">✕</button>
        </div>`).join('')}
    </div>` : ''}
    ${goals.length < MAX_GOAL ? `<button class="btn btn-plain block" style="margin-top:12px" data-act="pickgoal">
        ${icon('plus',16)} Add a goal photo${goals.length ? '' : ''}</button>` : `
      <div class="tiny muted" style="margin-top:10px">That is the limit — ${MAX_GOAL}. Remove one to swap it.</div>`}
    ${canRun ? (ai.tier === 3
      ? `<div class="tiny" style="margin-top:12px;color:var(--warn);line-height:1.55">Benchmarking needs a free Gemini key.</div>`
      : `<button class="btn btn-primary block" style="margin-top:12px" data-act="benchmark" ${busy?'disabled':''}>
          ${busy === 'benchmark' ? '<span class="spin"></span> Comparing…' : `${icon('spark',17)} Benchmark · send ${1 + Math.min(goals.length, 2)} photos to Gemini`}
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
    <div class="tiny muted" style="letter-spacing:.12em;text-transform:uppercase;font-weight:800">
      Benchmark · ${esc(fmtDayShort(dayKey(r.t)))}
    </div>
    ${d.summary ? `<div style="font-family:'Sora',sans-serif;font-weight:700;font-size:16.5px;line-height:1.45;margin-top:8px">${esc(d.summary)}</div>` : ''}

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

/* ---- consent + AI calls ---- */
function askConsent(then){
  openSheet(`
    <h2>Send photos to Gemini?</h2>
    <p class="sub">To read your photos, the app sends the ones you have selected to Google's Gemini service, using your own key.</p>
    <div class="card tight sunk" style="margin:14px 0">
      <div class="tiny" style="line-height:1.7">
        <b>They leave this device</b> for that request. Otherwise they stay here.<br><br>
        <b>On the free tier</b>, Google's terms allow submitted content to be used to improve their products,
        including review by people. Do not send anything you would be uncomfortable with that.<br><br>
        You will see how many photos go each time, and can switch this off again from the Photos tab.
        The before/after slider works without any of this.
      </div>
    </div>
    <button class="btn btn-primary block" data-act="yes">I understand — send</button>
    <button class="btn btn-ghost block" data-act="no">Not now</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    yes: () => { store.update(s => { s.photoAI = true; }); closeSheet(); then(); },
    no: closeSheet,
  });
}

function aiContext(fromKey, toKey){
  const f = fuelData(), p = phase();
  return coach.buildContext({
    weights: f.weights, fuelDays: f.days, targetKcal: f.targets?.kcal,
    sessions: Object.values(store.get().sessions),
    fromKey, toKey, phaseName: `Phase ${p.phase} · ${p.name}`, week: Math.min(weekInBlock(), 8),
  });
}

const aiError = e => {
  const m = String(e?.message || '');
  if (/429|quota|rate/i.test(m)) return 'Gemini says you are out of free requests for now. Try again later.';
  if (/No AI available/i.test(m)) return 'No AI available — add a Gemini key first.';
  return m.length > 140 ? m.slice(0, 140) + '…' : (m || 'Could not get a reading.');
};

async function readProgress(){
  if (busy) return;
  const [a, b] = pair();
  if (!b) return;
  askText = (document.getElementById('ask-q')?.value || '').trim();
  if (!store.get().photoAI) return askConsent(readProgress);

  busy = 'progress'; render();
  try{
    const picks = a && a.id !== b.id ? [a, b] : [b];
    const images = await Promise.all(picks.map(p => blobToImage(p.blob)));
    const labels = picks.length === 2
      ? [`Photo 1: BEFORE, taken ${dateOf(picks[0])}`, `Photo 2: AFTER, taken ${dateOf(picks[1])}`]
      : [`Photo 1: his current physique, taken ${dateOf(picks[0])}`];
    const context = aiContext(dayKey(picks[0].t), dayKey(picks.at(-1).t));
    const res = await ask({
      prompt: coach.progressPrompt({ context, question: askText, labels }),
      images, maxTokens: 1400,
    });
    const data = coach.sanitiseProgress(res.data);
    if (!data.usable) throw new Error('The reply came back in a shape I could not read. Try again.');
    store.update(s => {
      s.readings = { ...(s.readings || {}), progress: { t: Date.now(), q: askText, n: picks.length, data } };
    });
  }catch(e){ toast(aiError(e)); }
  finally{ busy = null; render(); }
}

async function runBenchmark(){
  if (busy) return;
  const [, b] = pair();
  const goals = goalCache || [];
  if (!b || !goals.length) return;
  if (!store.get().photoAI) return askConsent(runBenchmark);

  busy = 'benchmark'; render();
  try{
    const refs = goals.slice(-2);
    const images = await Promise.all([b, ...refs].map(p => blobToImage(p.blob)));
    const labels = [`Photo 1: him NOW, taken ${dateOf(b)}`,
                    ...refs.map((_, i) => `Photo ${i + 2}: GOAL reference ${i + 1}`)];
    const volume = weeklyVolume(phase()).map(([m, n]) => `${m}: ${n}`).join(', ');
    const res = await ask({
      prompt: coach.benchmarkPrompt({ context: aiContext(dayKey(b.t), dayKey(b.t)), volume, labels }),
      images, maxTokens: 1600,
    });
    const data = coach.sanitiseBenchmark(res.data);
    if (!data.usable) throw new Error('The reply came back in a shape I could not read. Try again.');
    store.update(s => {
      s.readings = { ...(s.readings || {}), benchmark: { t: Date.now(), n: images.length, data } };
    });
  }catch(e){ toast(aiError(e)); }
  finally{ busy = null; render(); }
}

function applyFocus(){
  const bm = (store.get().readings || {}).benchmark;
  if (!bm) return;
  // Re-clamp on apply rather than trusting what was stored.
  const { accepted } = coach.clampAdjustments(bm.data.adjustments);
  const focus = Object.fromEntries(accepted.map(a => [a.muscle, a.extraSets]));
  store.update(s => { s.focus = focus; s.focusMeta = { t: Date.now() }; });
  haptic(20);
  toast('Applied — see the Goal tab');
  render();
}

/* ---- capture / edit ---- */
async function capturePhoto(which, album = 'physique'){
  const inp = document.getElementById(which === 'cam' ? 'file-cam' : 'file-lib');
  inp.value = '';
  inp.onchange = async () => {
    let files = [...inp.files];
    if (!files.length) return;
    if (album === 'goal'){
      const room = MAX_GOAL - (goalCache || []).length;
      files = files.slice(0, Math.max(0, room));
    }
    try{
      let dated = 0;
      for (const f of files){
        const blob = await compress(f);
        const meta = {};
        /* A library photo carries the date it was taken; a camera shot is
           "now". Trust the file's date only when it is clearly not now —
           some browsers report the moment of picking, which would stamp
           an old photo as today. It is editable either way. */
        if (album === 'physique' && f.lastModified && f.lastModified <= Date.now() && Date.now() - f.lastModified > 120000){
          meta.t = f.lastModified; dated++;
        }
        await addPhoto(album, blob, meta);
      }
      photoCache = null; goalCache = null;
      toast(dated ? 'Added — dated from the file, tap a photo to correct it'
          : files.length > 1 ? `${files.length} added` : 'Added');
      render();
    }catch(e){ toast(e.message || 'Could not save that photo'); }
  };
  inp.click();
}

function viewPhoto(id){
  const sh = photoCache?.find(x => x.id === id);
  if (!sh) return;
  openSheet(`
    <h2>${esc(dateOf(sh))}</h2>
    <p class="sub">Tap and hold the image to save or share it.</p>
    <img src="${urlFor(sh)}" style="width:100%;border-radius:var(--r-md);display:block;box-shadow:var(--clay)">

    <label class="label" style="margin-top:16px">Date taken</label>
    <div class="row" style="gap:9px">
      <input class="input grow" type="date" id="ph-date" value="${dayKey(sh.t)}" max="${today()}">
      <button class="btn btn-soft" data-act="savedate">Save</button>
    </div>
    <div class="tiny muted" style="margin-top:6px;line-height:1.5">
      Used for the order, the before/after picker and how many days apart two photos are.</div>

    <button class="btn btn-ghost block" style="margin-top:14px;color:var(--bad)" data-act="rm">Delete this photo</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    savedate: async () => {
      const v = sheetVal('ph-date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > today()){ toast('Pick a date up to today'); return; }
      const [y, m, d] = v.split('-').map(Number);
      // Noon local: a midnight timestamp lands on the previous day in any
      // timezone west of where it was set.
      await updatePhoto(id, { t: new Date(y, m - 1, d, 12).getTime() });
      photoCache = null;
      closeSheet(); toast('Date updated'); render();
    },
    rm: async () => {
      await deletePhoto(id);
      if (cmpA === id) cmpA = null;
      if (cmpB === id) cmpB = null;
      photoCache = null;
      closeSheet(); toast('Deleted'); render();
    },
    close: closeSheet,
  });
}

async function removeGoal(id){
  await deletePhoto(id);
  goalCache = null;
  render();
}

/* ---- timer settings ---- */
function openTimerSheet(){
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

/* ---- focus boosts (Goal tab) ---- */
function focusHTML(){
  const focus = store.get().focus || {};
  const muscles = Object.keys(focus);
  if (!muscles.length) return '';
  const p = phase();
  const fits = coach.appliedTotals(p, focus);
  const total = muscles.reduce((n, m) => n + (fits[m] || 0), 0);
  const since = store.get().focusMeta?.t;
  const weeks = since ? Math.floor((Date.now() - since) / 604800000) : 0;
  return `
  <div class="card in" style="margin-top:14px">
    <div class="spread" style="align-items:baseline">
      <div class="card-title">Focus boosts</div>
      <span class="mono" style="font-weight:800;color:var(--accent-1)">+${total} sets/wk</span>
    </div>
    <div class="card-note" style="margin-top:4px;line-height:1.55">
      Extra sets added on top of the plan from your goal benchmark — about ${total * 2} extra minutes a week.
      ${since ? `Applied ${weeks ? `${weeks} week${weeks>1?'s':''} ago` : 'this week'}; worth re-benchmarking after about eight.` : ''}
    </div>
    <div class="stack" style="gap:0;margin-top:10px">
      ${muscles.map(m => `
        <div class="spread" style="padding:10px 0;border-top:1px solid var(--line-soft)">
          <div><b style="font-size:14px">${esc(m)}</b>
            <div class="tiny muted">${fits[m] === focus[m] ? `+${focus[m]} a week` : `+${fits[m] || 0} fits in this phase (asked +${focus[m]})`}</div></div>
          <button class="btn btn-ghost btn-sm" style="color:var(--bad)" data-act="rmfocus" data-m="${esc(m)}">Remove</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-plain block btn-sm" style="margin-top:8px" data-act="clearfocus">Clear all boosts</button>
  </div>`;
}

/* ---------------- history ---------------- */
function historyHTML(){
  const sess = Object.values(store.get().sessions).filter(s => s.done)
    .sort((a,b) => b.dayKey.localeCompare(a.dayKey));
  if (!sess.length) return empty(icon('training',34), 'No sessions logged yet.<br>Finish one and it will show up here.');

  const allDays = PHASES.flatMap(p => p.days);
  return `
  <div class="grid2 in" style="margin-bottom:14px">
    ${stat(num(doneCount()), 'Sessions all time')}
    ${stat(num(thisWeekCount()) + '<small>/4</small>', 'This week')}
  </div>
  <div class="stack" style="gap:9px">
    ${sess.slice(0,40).map(s => {
      const d = allDays.find(x => x.key === s.day);
      const nSets = Object.values(s.sets || {}).reduce((n,a) => n + a.length, 0);
      const weighted = Object.values(s.sets || {}).flat().filter(x => setWeight(x) != null);
      const vol = weighted.reduce((n,x) => n + setWeight(x), 0);
      const detail = s.quick || !nSets
        ? 'Ticked off'
        : `${nSets} set${nSets>1?'s':''}${weighted.length ? ` · ${num(vol)}kg total` : ''}`;
      const took = s.mins ? ` · ${s.mins} min` : '';
      return `<div class="rowcard" style="border-left:3px solid ${d?.color || 'var(--line)'}">
        <div class="grow"><b>${esc(d?.title || s.day)}</b>
          <span class="sub">${esc(fmtDayShort(s.dayKey))} · ${detail}${took}</span></div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ---------------- session actions ---------------- */
function newSession(k){
  const id = uid();
  store.update(s => {
    s.sessions[id] = { id, day:k, dayKey:today(), sets:{}, done:false, startedAt: Date.now() };
    s.activeId = id;
  });
  tab = 'plan';
  return id;
}

function startSession(k){ newSession(k); haptic(); render(); }

/* One tap logs the set, carrying last session's weight if known. */
/* Alternates for whatever is busy. Grouped by what you need rather than
   by how good they are, because the question in the moment is always
   "what is actually free right now". */
function openSwap(exName, orig, dk){
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
    const kg = convertWeight(exName, name, cur);
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
    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Close</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
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

function addSet(key, exName){
  const prev = store.get().lastByEx[exName];
  store.update(s => {
    const sess = s.sessions[s.activeId];
    if (!sess.sets[key]) sess.sets[key] = [];
    sess.sets[key].push({ w: prev?.w ?? null });
  });
  haptic();
  render();

  /* Start the exercise's own rest. A rest of 0s means "straight into the
     next movement" (a superset), so nothing should be counting down — and
     any countdown still running from before is stale. */
  if (store.get().timer.auto){
    const sess = store.get().sessions[store.get().activeId];
    const [si, ei] = key.split('-').map(Number);
    const ex = dayOf(sess?.day)?.supersets[si]?.exercises[ei];
    const secs = timer.parseRest(ex?.rest);
    if (secs > 0) timer.startRest(secs); else timer.clearRest();
  }
}

function editSet(key, i, exName){
  const cur = store.get().sessions[store.get().activeId]?.sets[key]?.[i];
  openSheet(`
    <h2>${esc(exName)}</h2>
    <p class="sub">Set ${i+1}. Weight is optional — leave it blank if you'd rather just tick it off.</p>
    <label class="label">Weight (kg)</label>
    <input class="input" type="number" inputmode="decimal" step="0.5" id="s-w"
           value="${setWeight(cur) ?? ''}" placeholder="Optional"
           style="font-size:22px;font-weight:700;text-align:center;padding:16px">
    <button class="btn btn-primary block" style="margin-top:14px" data-act="save">Save</button>
    <button class="btn btn-danger block" style="margin-top:8px" data-act="rm">Remove this set</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  setTimeout(() => document.getElementById('s-w')?.focus(), 120);

  bindActions(document.querySelector('.sheet'), {
    save: () => {
      const raw = sheetVal('s-w').trim();
      const w = raw === '' ? null : parseFloat(raw);
      store.update(s => {
        s.sessions[s.activeId].sets[key][i] = { w: Number.isFinite(w) ? w : null };
        if (Number.isFinite(w)) s.lastByEx[exName] = { w };
      });
      closeSheet(); render();
    },
    rm: () => {
      store.update(s => { s.sessions[s.activeId].sets[key].splice(i,1); });
      closeSheet(); haptic(); render();
    },
    close: closeSheet,
  });
}

/* Finishing never requires logged sets — plenty of sessions happen
   without touching the phone, and refusing those makes history lie. */
function finishSession(){
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

function quickComplete(k){
  const name = dayOf(k)?.title || 'Session';
  store.update(s => {
    const id = uid();
    s.sessions[id] = { id, day:k, dayKey:today(), sets:{}, done:true, quick:true };
  });
  haptic(20);
  toast(`${name} ✓`);
  render();
}

function undoToday(k){
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

/* ---------------- AI advice ---------------- */
async function askAdvice(){
  openSheet(`
    <h2>Ask about training</h2>
    <p class="sub">Form checks, swaps for a machine you don't have, or working around a niggle.</p>
    <textarea class="textarea" id="q" placeholder="e.g. My shoulder clicks on incline press — what should I swap it for?"></textarea>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="go" id="ask-btn">Ask</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
    <div id="ans" style="margin-top:14px"></div>
  `);

  bindActions(document.querySelector('.sheet'), {
    go: async () => {
      const q = sheetVal('q').trim();
      if (!q){ toast('Type a question'); return; }
      const btn = document.getElementById('ask-btn');
      btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Thinking…`;
      const p = phase();
      try{
        const res = await ask({
          prompt: `You are a strength coach. Your client: 185cm, ~75kg, already lean with visible abs, chasing a swimmer physique (wide delts, wide lats, high upper chest). Lean bulking, 4 days a week, 3 supersets a session, ~40 minutes, fasted in the morning, at Anytime Fitness Jannali.

He is on Phase ${p.phase} (${p.name}): ${p.focus}

Critical constraints you must respect:
- Weak/unstable shoulder AND generalised hypermobility. Passive structures won't protect his joints: avoid deep-stretch overhead loading, behind-the-neck work, deep barbell benching and deep dips. Prefer neutral grips, controlled ROM, dumbbells, cables and machines.
- Distal triceps/elbow pain when pressing. He warms up with high-rep light pushdowns. Avoid hard lockouts and overhead triceps positions.
- Knees cave inward under load.
He cares about how he looks, not what he lifts.

His question: "${q}"

Respond with ONLY this JSON:
{"answer":"2-4 short paragraphs, plain language, specific and practical","swaps":[{"instead":"exercise name","use":"replacement","why":"one line"}]}`,
          offline: () => ({
            answer: 'AI is off right now, so here are the standing rules: if a movement hurts the shoulder, move to a neutral grip and cut the range before you cut the weight. If the elbow is the problem, add a second round of light pushdowns before pressing and stop short of lockout. Anything that loads a deep stretch overhead is the wrong exercise for your joints, no matter how good it is for everyone else.',
            swaps: [
              { instead:'Barbell overhead press', use:'Machine shoulder press', why:'Fixed path, no stabilising demand on an unstable shoulder.' },
              { instead:'Deep barbell bench',     use:'Incline machine press', why:'Stops the shoulder reaching the end range that bothers it.' },
              { instead:'Overhead triceps extension', use:'Cross-body cable pushdown', why:'Long head without the overhead position that flares the elbow.' },
            ],
          }),
        });
        const a = res.data;
        document.getElementById('ans').innerHTML = `
          <div class="card tight sunk">
            <div style="font-size:14.5px;line-height:1.65;white-space:pre-wrap">${esc(a.answer)}</div>
            ${(a.swaps||[]).length ? `<div class="hr"></div>${a.swaps.map(s => `
              <div style="padding:8px 0">
                <div class="tiny" style="color:var(--accent-1);font-weight:700">${esc(s.instead)} → ${esc(s.use)}</div>
                <div class="tiny muted" style="margin-top:2px">${esc(s.why)}</div>
              </div>`).join('')}` : ''}
          </div>`;
      }catch(e){ toast(e.message || 'Could not reach AI'); }
      finally{ btn.disabled = false; btn.textContent = 'Ask'; }
    },
    close: closeSheet,
  });
}

/* ---------------- settings ---------------- */
function openSettings(){
  const s = store.get();
  openSheet(`
    <h2>Phases</h2>
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
    close: closeSheet,
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    start: d => startSession(d.d),
    abandon: () => { store.update(s => { s.activeId = null; }); timer.stop(); render(); },
    togglewu: () => { const e = document.getElementById('wu-body'); if (e) e.hidden = !e.hidden; },
    addset: d => addSet(d.k, d.n),
    swap: d => openSwap(d.n, d.o, d.dk),
    editset: d => editSet(d.k, +d.i, d.n),
    tick: d => quickComplete(d.d),
    undo: d => undoToday(d.d),
    finish: finishSession,
    advice: askAdvice,
    settings: openSettings,
    shoot: () => capturePhoto('cam'),
    pick: () => capturePhoto('lib'),
    pickgoal: () => capturePhoto('lib', 'goal'),
    rmgoal: d => removeGoal(d.id),
    cmpa: (d, el) => { cmpA = el.value; render(); },
    cmpb: (d, el) => { cmpB = el.value; render(); },
    readprogress: readProgress,
    benchmark: runBenchmark,
    applyfocus: applyFocus,
    photoaioff: () => { store.update(s => { s.photoAI = false; }); toast('Photo analysis off'); render(); },
    rmfocus: d => { store.update(s => { const f = { ...s.focus }; delete f[d.m]; s.focus = f; }); haptic(); render(); },
    clearfocus: () => { store.update(s => { s.focus = {}; s.focusMeta = null; }); haptic(); render(); },
    viewphoto: d => viewPhoto(d.id),
  });
}
