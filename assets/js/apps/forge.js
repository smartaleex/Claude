/* ============================================================
   Forge — The Swimmer Build.

   Renders Alex's own program: 4 days, 3 supersets each, with the
   superset rationales, per-exercise coaching notes, rest values and
   optional extra-time blocks carried over from the original artifact.
   ============================================================ */

import { Slice, today, dayKey, keyToDate, daysBetween, uid, fmtDayShort } from '../core/store.js';
import { ask } from '../core/ai.js';
import {
  esc, num, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic,
} from '../core/ui.js';
import {
  PHASES, WARMUPS, PROGRESSION, TAG_STYLE, PHYSIQUE,
  weeklyVolume, sessionMinutes, totalExercises,
} from '../data/workouts.js';

const store = new Slice('forge', {
  blockIndex: 1,          // Phase 2 was current in the original artifact
  blockStart: today(),
  sessions: {},           // id -> { day, dayKey, sets:{ exKey:[{w}] }, done }
  lastByEx: {},           // exercise name -> { w }
  activeId: null,
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
    badge: `${thisWeekCount()}/4 this week`,
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

function render(){
  const active = store.get().activeId ? store.get().sessions[store.get().activeId] : null;
  const p = phase();
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">The Swimmer Build</div>
        <h1 class="page-h1">${tab==='plan' ? 'The plan' : tab==='goal' ? 'The goal' : 'History'}</h1>
        <div class="page-sub">Phase ${p.phase} · ${esc(p.name)} · week ${Math.min(weekInBlock(),8)} of 8</div>
      </div>
      <button class="chip" data-act="settings">⚙</button>
    </div>
  </header>

  <div class="seg" style="margin:16px 0">
    ${[['plan','Plan'],['goal','Goal'],['log','History']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${ active && tab==='plan' ? sessionHTML(active)
   : tab==='plan' ? planHTML()
   : tab==='goal' ? goalHTML()
   : historyHTML() }`;

  bind();
}

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
    n + ss.exercises.reduce((m,ex) => m + (parseInt(ex.sets,10)||1), 0), 0);
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
        <div class="card-title">⚡ ${esc(wu.name)}</div>
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

function exerciseHTML(ex, key, sess, d, hasNext){
  const logged = sess.sets[key] || [];
  const target = parseInt(ex.sets, 10) || 1;
  const prev = store.get().lastByEx[ex.name];
  const doneAll = logged.length >= target;
  const ts = TAG_STYLE[ex.tag] || TAG_STYLE.Isolation;
  const straightInto = ex.rest === '0s';

  return `
  <div style="padding:15px 16px;${hasNext ? 'border-bottom:1px solid var(--line-soft)' : ''}">
    <div class="spread" style="align-items:flex-start;gap:10px">
      <div class="grow">
        <span class="badge" style="background:${ts.bg};color:${ts.fg}">${esc(ex.tag)}</span>
        <div style="font-weight:700;font-size:15px;margin-top:6px;${doneAll?'opacity:.55':''}">${esc(ex.name)}</div>
        <div class="tiny muted mono" style="margin-top:3px">
          ${logged.length}/${esc(ex.sets)} sets · ${esc(ex.reps)} reps ·
          ${straightInto ? `<span style="color:${d.color};font-weight:700">→ straight into next</span>` : `${esc(ex.rest)} rest`}
          ${prev?.w != null ? ` · last ${prev.w}kg` : ''}
        </div>
      </div>
      <button class="btn ${doneAll?'btn-plain':'btn-soft'} btn-sm nowrap" data-act="addset" data-k="${key}" data-n="${esc(ex.name)}">
        ${doneAll ? '+ Extra' : '+ Set'}
      </button>
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

  ${volumeHTML()}

  <button class="btn btn-plain block in" style="margin-top:14px" data-act="advice">✨ Ask about form or a swap</button>`;
}

/* Weekly sets per muscle for the current phase — the honesty check that
   the program targets the goal rather than just looking busy. */
function volumeHTML(){
  const p = phase();
  const vol = weeklyVolume(p);
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

/* ---------------- history ---------------- */
function historyHTML(){
  const sess = Object.values(store.get().sessions).filter(s => s.done)
    .sort((a,b) => b.dayKey.localeCompare(a.dayKey));
  if (!sess.length) return empty('🏋️', 'No sessions logged yet.<br>Finish one and it will show up here.');

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
      return `<div class="rowcard" style="border-left:3px solid ${d?.color || 'var(--line)'}">
        <div class="grow"><b>${esc(d?.title || s.day)}</b>
          <span class="sub">${esc(fmtDayShort(s.dayKey))} · ${detail}</span></div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ---------------- session actions ---------------- */
function newSession(k){
  const id = uid();
  store.update(s => {
    s.sessions[id] = { id, day:k, dayKey:today(), sets:{}, done:false };
    s.activeId = id;
  });
  tab = 'plan';
  return id;
}

function startSession(k){ newSession(k); haptic(); render(); }

/* One tap logs the set, carrying last session's weight if known. */
function addSet(key, exName){
  const prev = store.get().lastByEx[exName];
  store.update(s => {
    const sess = s.sessions[s.activeId];
    if (!sess.sets[key]) sess.sets[key] = [];
    sess.sets[key].push({ w: prev?.w ?? null });
  });
  haptic();
  render();
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
    if (sess) sess.done = true;
    st.activeId = null;
  });
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
          <div class="card tight" style="box-shadow:none;background:var(--surface-2)">
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
        <button class="card tight" data-act="setblock" data-i="${i}"
                style="text-align:left;box-shadow:none;background:${i===s.blockIndex?'var(--accent-tint)':'var(--surface-2)'}">
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
    abandon: () => { store.update(s => { s.activeId = null; }); render(); },
    togglewu: () => { const e = document.getElementById('wu-body'); if (e) e.hidden = !e.hidden; },
    addset: d => addSet(d.k, d.n),
    editset: d => editSet(d.k, +d.i, d.n),
    tick: d => quickComplete(d.d),
    undo: d => undoToday(d.d),
    finish: finishSession,
    advice: askAdvice,
    settings: openSettings,
  });
}
