/* ============================================================
   Day — the anchor.

   The rest of Alex HQ is a scoreboard. Scoreboards are motivating when
   you're winning and crushing when you're not, and right now there is a
   lot going on: a father with cancer, a job he wants out of, holding a
   family up, bipolar medication, sleep that has come off the rails.

   So this app is built to the opposite brief. It asks for less on hard
   days rather than more. It never shows a red number. It has no streak
   that can be "broken" — streaks turn one bad day into a reason to stop
   opening the app at all. What it does have:

     · Medication first, every day. Highest-stakes daily action, and it
       wasn't anywhere in the app.
     · Sleep. For bipolar specifically, sleep is both an early warning
       and a trigger, so it's worth a record you can show a doctor.
     · A handful of anchors — small, physical, achievable.
     · Somewhere to put the heavy stuff without it becoming a mood score.

   Heavy day mode collapses everything to meds, food and sleep. On a bad
   day the honest advice is "take your meds, eat something, sleep", and
   an app that instead shows five more things you haven't done is
   actively unhelpful.
   ============================================================ */

import { Slice, today, dayKey, shiftDay, lastNDays, daysBetween, uid, fmtDayShort } from '../core/store.js';
import { icon } from '../core/icons.js';
import {
  esc, num, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic,
} from '../core/ui.js';

/* Anchors are physical and small on purpose. "Meditate" is not here —
   he's told me he hates it, and an anchor you resent isn't an anchor. */
const DEFAULT_ANCHORS = [
  { id:'meds',   label:'Meds',            icon:'pill',  core:true,  note:'Non-negotiable. Everything else is optional.' },
  { id:'ate',    label:'Ate a real meal', icon:'food',  core:true,  note:'Not a coffee. An actual meal.' },
  { id:'outside',label:'Outside with her',icon:'dog',   core:false, note:'Ten minutes counts. She does not care how far.' },
  { id:'moved',  label:'Moved my body',   icon:'training', core:false, note:'Gym, walk, stretch. Any of it.' },
  { id:'forward',label:'One thing forward',icon:'spark', core:false, note:'One small move on the business. One.' },
];

/* Sixty-second resets that are not meditation. Physiological sigh and
   cold water are the two with the strongest evidence behind them and
   neither asks you to sit still and observe your thoughts. */
export const RESETS = [
  { id:'sigh',  name:'Double breath',  time:'60 sec',
    how:'Two sharp inhales through the nose — the second one tops up the lungs — then a long slow exhale through the mouth. Five rounds.',
    why:'The fastest way to physically drop your heart rate. Not a mood technique, a mechanical one.' },
  { id:'cold',  name:'Cold water',     time:'30 sec',
    how:'Cold water on your face and wrists, or hold your breath and dunk your face in a bowl for 20 seconds.',
    why:'Triggers the dive reflex, which slows the heart directly. Useful when you are wound too tight to think.' },
  { id:'walk',  name:'Walk, no phone', time:'10 min',
    how:'Out the door, phone stays home or in your pocket on silent. No podcast, no music.',
    why:'Different from a walk with input. The point is the absence, not the exercise.' },
  { id:'name',  name:'Name five things',time:'60 sec',
    how:'Five things you can see, four you can hear, three you can touch. Out loud if you are alone.',
    why:'Interrupts a spiral by forcing attention outward. Works because it is boring, not because it is profound.' },
  { id:'lift',  name:'Something heavy', time:'5 min',
    how:'Pick up something heavy and put it down, ten times. Kettlebell, a case of water, whatever is there.',
    why:'Hard physical effort changes your state faster than trying to think your way out of one.' },
];

/* Reflection prompts. Deliberately concrete and answerable in one line —
   "how are you feeling" is a question you can stare at for ten minutes.
   None of them assume the day went well, and none of them ask you to be
   grateful, which lands badly when things are genuinely hard. */
const PROMPTS = [
  'What took the most out of you today?',
  'What did you do today that you would not have managed a month ago?',
  'Something that was true today and will not be true in a year.',
  'Where did you push against your own limits today?',
  'What did you avoid, and what was underneath the avoiding?',
  'What do you want to remember about today in five years?',
  'Who did you think about today that you have not spoken to?',
  'What was the smallest good moment?',
  'What are you carrying that is not actually yours to carry?',
  'What would you tell a friend who had the day you just had?',
  'What did you learn about yourself this week?',
  'What is the next thing you are actually looking forward to?',
  'Where did you show up for someone today?',
  'What is worrying you that you have not put into words yet?',
  'What did your body tell you today that you talked yourself out of?',
  'If today repeated all week, what one thing would you change?',
  'What are you being harder on yourself about than the facts warrant?',
  'What made you laugh?',
];

const store = new Slice('day', {
  medDoses: 3,     // he takes them three times a day
  anchors: DEFAULT_ANCHORS,
  done: {},        // dayKey -> { anchorId: true }
  sleep: {},       // dayKey -> { hours, quality }   quality 1-4
  notes: {},       // dayKey -> string
  heavy: {},       // dayKey -> true  (heavy day mode)
  medTime: '',     // optional reminder time, e.g. "21:00"
});

let tab = 'today';
let root = null;

/* One prompt per day so it feels settled rather than slot-machine, seeded
   off the date so it is the same all day. `nudge` walks it on when tapped. */
let promptNudge = 0;
function currentPrompt(){
  const seed = Number(today().replaceAll('-', '')) || 0;
  return PROMPTS[(seed + promptNudge) % PROMPTS.length];
}

/* ---------------- helpers ---------------- */
const anchors    = () => store.get().anchors;
const doneOn     = d => store.get().done[d] || {};

/* Meds are a count, not a checkbox — three doses a day means a single
   tick either lies about two of them or makes the day look failed when
   two were taken. Everything else stays boolean. */
const medDoses   = () => Math.max(1, store.get().medDoses || 1);
const medsTaken  = d => {
  const v = doneOn(d).meds;
  return typeof v === 'number' ? v : (v ? medDoses() : 0);
};
const medsAllIn  = d => medsTaken(d) >= medDoses();
const isDone     = (d, id) => id === 'meds' ? medsAllIn(d) : !!doneOn(d)[id];

function bumpMeds(d, delta){
  store.update(s => {
    if (!s.done[d]) s.done[d] = {};
    const cur = medsTaken(d);
    const next = Math.min(medDoses(), Math.max(0, cur + delta));
    if (next === 0) delete s.done[d].meds; else s.done[d].meds = next;
  });
}
const isHeavy    = d => !!store.get().heavy[d];
const sleepOn    = d => store.get().sleep[d] || null;

/** On a heavy day only the core anchors are asked for. */
const visibleAnchors = d => isHeavy(d) ? anchors().filter(a => a.core) : anchors();

const doneCount = d => visibleAnchors(d).filter(a => isDone(d, a.id)).length;

/* Any dose counts as engaging with meds for the fortnight view — the
   question that view answers is "are you taking them", not "perfectly". */
const medsAnyOn = d => medsTaken(d) > 0;

/* Meds specifically — the one number worth being precise about. */
function medsRate(n = 14){
  const days = lastNDays(n);
  const full = days.filter(d => medsAllIn(d)).length;
  const any  = days.filter(d => medsAnyOn(d)).length;
  const doses = days.reduce((a,d) => a + medsTaken(d), 0);
  return { taken: full, any, of: days.length, doses, ofDoses: days.length * medDoses(),
           pct: Math.round(full / days.length * 100) };
}

function sleepAvg(n = 7){
  const vals = lastNDays(n).map(sleepOn).filter(s => s && s.hours > 0);
  if (!vals.length) return null;
  return {
    hours: Math.round(vals.reduce((a,s) => a + s.hours, 0) / vals.length * 10) / 10,
    nights: vals.length,
    // Spread matters more than the mean for bipolar — an erratic pattern
    // is the signal, not a single short night.
    spread: Math.round((Math.max(...vals.map(v=>v.hours)) - Math.min(...vals.map(v=>v.hours))) * 10) / 10,
  };
}

/* ---------------- summary (HQ) ---------------- */
export async function summary(){
  await store.load();
  const d = today();
  const vis = visibleAnchors(d);
  const n = doneCount(d);
  const meds = isDone(d, 'meds');
  return {
    headline: `${n} of ${vis.length} done`,
    detail: isHeavy(d)
      ? 'Heavy day — just the essentials'
      : medsAllIn(d) ? 'Meds all in' : `Meds ${medsTaken(d)}/${medDoses()}`,
    badge: medsAllIn(d) ? null : 'Meds',
    // Tickable from the home screen. The whole point of an anchor is
    // that logging it costs nothing — making him open an app first is
    // exactly the friction that stopped the nicotine logging.
    pips: vis.map(a => ({
      id: a.id,
      label: a.id === 'meds' ? `Meds ${medsTaken(d)}/${medDoses()}` : a.label,
      on: isDone(d, a.id),
      partial: a.id === 'meds' && medsTaken(d) > 0 && !medsAllIn(d),
    })),
  };
}

/** Called from the HQ hero so anchors can be ticked without navigating. */
export async function tickFromHome(id){
  await store.load();
  const d = today();
  if (id === 'meds'){
    bumpMeds(d, medsAllIn(d) ? -medDoses() : 1);   // step up, or reset if complete
  } else {
    store.update(s => {
      if (!s.done[d]) s.done[d] = {};
      if (s.done[d][id]) delete s.done[d][id]; else s.done[d][id] = true;
    });
  }
}

/* ---------------- mount ---------------- */
export async function mount(el){
  root = el;
  await store.load();
  render();
}

function render(){
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Day</div>
        <h1 class="page-h1">${tab==='today' ? 'Today' : tab==='reset' ? 'Reset' : 'Patterns'}</h1>
      </div>
      <button class="chip" data-act="settings" aria-label="Settings">${icon('settings',18)}</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:14px 0">
    ${[['today','Today'],['reset','Reset'],['trend','Patterns']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='today' ? todayHTML() : tab==='reset' ? resetHTML() : trendHTML()}`;
  bind();
}

/* ---------------- today ---------------- */
function todayHTML(){
  const d = today();
  const heavy = isHeavy(d);
  const vis = visibleAnchors(d);
  const n = doneCount(d);
  const sl = sleepOn(d);
  const note = store.get().notes[d] || '';

  return `
  <div class="card in" style="background:var(--accent-tint);border-color:transparent">
    <div class="spread" style="align-items:flex-start">
      <div class="grow">
        <div class="card-title">${heavy ? 'Just the essentials today' : 'Anchors'}</div>
        <div class="card-note" style="margin-top:4px">
          ${heavy
            ? 'Meds, food, sleep. That is a complete day. Nothing else is being asked of you.'
            : n === vis.length
              ? 'All of them. That is a good day however the rest of it went.'
              : 'Small and physical. Tap what you have done — no order, no streak.'}
        </div>
      </div>
      <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:26px;color:var(--accent-1)">${n}<span style="font-size:16px;opacity:.6">/${vis.length}</span></div>
    </div>
  </div>

  <div class="stack" style="margin-top:12px;gap:9px">
    ${vis.map(a => a.id === 'meds' ? medsRowHTML(d) : (() => {
      const on = isDone(d, a.id);
      return `<button class="rowcard" data-act="toggle" data-id="${a.id}" style="width:100%;text-align:left">
        <span style="width:38px;height:38px;border-radius:99px;flex:none;display:grid;place-items:center;
              background:${on ? 'var(--good)' : 'var(--bg-sunk)'};color:${on ? '#fff' : 'var(--faint)'};
              box-shadow:${on ? 'var(--clay-sm)' : 'var(--clay-in)'}">
          ${icon(on ? 'check' : a.icon, 19)}
        </span>
        <div class="grow">
          <b style="${on ? 'opacity:.6;text-decoration:line-through' : ''}">${esc(a.label)}</b>
          ${a.note ? `<span class="sub">${esc(a.note)}</span>` : ''}
        </div>
      </button>`;
    })()).join('')}
  </div>

  <div class="sec">Last night</div>
  <button class="card in" data-act="sleep" style="width:100%;text-align:left">
    <div class="spread">
      <div class="grow">
        <div class="card-title">${sl ? `${sl.hours} hours` : 'Not logged'}</div>
        <div class="card-note" style="margin-top:3px">
          ${sl ? ['Rough','Broken','Alright','Solid'][(sl.quality||3)-1] + ' — tap to change'
               : 'Worth keeping — it is the first thing to move when things get hard.'}
        </div>
      </div>
      <span style="color:var(--accent-1)">${icon('moon',22)}</span>
    </div>
  </button>

  <div class="sec">Anything you want to put down</div>
  <div class="card in">
    <!-- A blank box asks you to be interesting on demand, which is exactly
         what you cannot do on a flat day. A question is easier to answer
         than a page is to fill. Tap it for a different one. -->
    <button class="rowcard" data-act="reprompt" style="width:100%;text-align:left;margin-bottom:11px">
      <span style="color:var(--accent-1);flex:none">${icon('spark',17)}</span>
      <span class="grow" style="font-size:13.5px;line-height:1.5">${esc(currentPrompt())}</span>
      <span class="tiny faint" style="flex:none">another</span>
    </button>
    <textarea class="textarea" id="day-note" placeholder="Two lines is plenty. Nobody reads this but you."
      style="min-height:76px">${esc(note)}</textarea>
    <div class="spread" style="margin-top:10px">
      <span class="tiny muted">Saved on this device only.</span>
      <button class="btn btn-soft btn-sm" data-act="savenote">Save</button>
    </div>
  </div>

  <button class="btn ${heavy ? 'btn-soft' : 'btn-plain'} block in" style="margin-top:18px" data-act="heavy">
    ${heavy ? 'Back to a normal day' : 'Today is a heavy one'}
  </button>
  <div class="tiny muted center" style="margin-top:8px;line-height:1.55">
    ${heavy ? 'Everything non-essential is hidden until tomorrow.'
            : 'Drops the list to meds, food and sleep. No penalty, no record of it.'}
  </div>`;
}

/* Three doses a day needs three targets, not one checkbox. Each pip is
   its own tap, so a partial day records as partial rather than failed. */
function medsRowHTML(d){
  const n = medsTaken(d), of = medDoses();
  const all = n >= of;
  const labels = of === 3 ? ['Morning','Midday','Night'] : of === 2 ? ['Morning','Night'] : ['Today'];
  return `
  <div class="rowcard" style="align-items:flex-start">
    <span style="width:38px;height:38px;border-radius:99px;flex:none;display:grid;place-items:center;margin-top:2px;
          background:${all ? 'var(--good)' : n ? 'var(--accent-tint)' : 'var(--bg-sunk)'};
          color:${all ? '#fff' : n ? 'var(--accent-1)' : 'var(--faint)'};
          box-shadow:${n ? 'var(--clay-sm)' : 'var(--clay-in)'}">
      ${icon(all ? 'check' : 'pill', 19)}
    </span>
    <div class="grow">
      <div class="spread" style="align-items:baseline">
        <b>Meds</b>
        <span class="tiny mono" style="color:${all ? 'var(--good)' : 'var(--muted)'};font-weight:700">${n}/${of}</span>
      </div>
      <span class="sub">${all ? 'All in for today.' : 'Tap each dose as you take it.'}</span>
      <div class="row" style="gap:7px;margin-top:9px">
        ${Array.from({length:of}, (_,i) => `
          <button data-act="dose" data-i="${i}" aria-label="${esc(labels[i]||'Dose '+(i+1))}"
            style="flex:1;padding:9px 4px;border-radius:14px;font-size:11px;font-weight:700;letter-spacing:.03em;
                   background:${i < n ? 'var(--good)' : 'var(--bg-sunk)'};
                   color:${i < n ? '#fff' : 'var(--faint)'};
                   box-shadow:${i < n ? 'var(--clay-sm)' : 'var(--clay-in)'}">
            ${esc(labels[i] || 'Dose ' + (i+1))}
          </button>`).join('')}
      </div>
    </div>
  </div>`;
}

/* ---------------- reset ---------------- */
function resetHTML(){
  return `
  <div class="card in">
    <div class="card-title">Sixty seconds, no cushion</div>
    <p class="card-note" style="margin-top:7px;line-height:1.6">
      None of these are meditation. They work on your body rather than your mind — heart rate,
      breathing, attention — which is why they still work on a day when sitting still and observing
      your thoughts is the last thing you want to do.
    </p>
  </div>

  <div class="stack" style="margin-top:12px;gap:10px">
    ${RESETS.map(r => `
      <button class="card in" data-act="reset" data-id="${r.id}" style="width:100%;text-align:left">
        <div class="spread" style="align-items:baseline">
          <b style="font-size:15.5px">${esc(r.name)}</b>
          <span class="badge accent">${esc(r.time)}</span>
        </div>
        <div class="card-note" style="margin-top:6px">${esc(r.how)}</div>
      </button>`).join('')}
  </div>`;
}

/* ---------------- patterns ---------------- */
function trendHTML(){
  const m14 = medsRate(14), m30 = medsRate(30);
  const sl = sleepAvg(7);
  const days = lastNDays(14);

  return `
  <div class="grid2 in">
    ${stat(m14.doses + `<small>/${m14.ofDoses}</small>`, 'Doses · last 14 days', 'var(--accent-1)')}
    ${stat(sl ? sl.hours + '<small>h</small>' : '—', 'Sleep · 7-night average')}
  </div>

  <div class="card in in-2" style="margin-top:12px">
    <div class="card-title">Meds</div>
    <div class="card-note" style="margin:4px 0 14px">Fourteen days. Grey means not logged, which is not the same as not taken.</div>
    <div class="row" style="gap:5px">
      ${days.map(d => {
        const t = medsTaken(d), of = medDoses();
        // Partial days show partial fill rather than reading as a miss.
        return `<div style="flex:1;height:34px;border-radius:8px;overflow:hidden;position:relative;
          background:var(--bg-sunk);box-shadow:var(--clay-in)" title="${esc(fmtDayShort(d))} — ${t}/${of}">
          <div style="position:absolute;inset:auto 0 0 0;height:${t/of*100}%;background:var(--good)"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="tiny muted" style="margin-top:10px">
      ${m14.taken} full days, ${m14.any - m14.taken} partial, ${m14.of - m14.any} with nothing logged.
      Partial is still better than none — the bar fills to how far you got.
    </div>
  </div>

  ${sl ? `
  <div class="card in in-3" style="margin-top:12px">
    <div class="card-title">Sleep</div>
    <div class="card-note" style="margin:4px 0 12px">
      Averaging ${sl.hours} hours over ${sl.nights} logged night${sl.nights>1?'s':''}.
    </div>
    <div class="row" style="gap:5px;align-items:flex-end;height:80px">
      ${days.map(d => {
        const s = sleepOn(d);
        const h = s ? Math.min(100, s.hours / 10 * 100) : 0;
        return `<div style="flex:1;height:${Math.max(6,h)}%;border-radius:7px;
          background:${s ? 'var(--accent-1)' : 'var(--bg-sunk)'};
          box-shadow:${s ? 'var(--clay-sm)' : 'var(--clay-in)'};opacity:${s?1:.6}"></div>`;
      }).join('')}
    </div>
    ${sl.spread >= 3 ? `
      <div class="card tight sunk" style="margin-top:14px">
        <div class="tiny" style="line-height:1.6;color:var(--ink-2)">
          Your sleep is swinging by about ${sl.spread} hours night to night. For bipolar specifically
          an irregular pattern matters more than a short night — it is worth mentioning to whoever
          manages your medication, sooner rather than at the next routine appointment.
        </div>
      </div>` : ''}
  </div>` : `
  <div class="card in in-3" style="margin-top:12px">
    <div class="card-note">Log a few nights and this fills in — hours, consistency, and whether the pattern is drifting.</div>
  </div>`}

  ${notesHTML()}`;
}

function notesHTML(){
  const notes = Object.entries(store.get().notes)
    .filter(([,v]) => v && v.trim())
    .sort((a,b) => b[0].localeCompare(a[0]))
    .slice(0, 10);
  if (!notes.length) return '';
  return `
  <div class="sec">What you wrote</div>
  <div class="stack" style="gap:9px">
    ${notes.map(([d, text]) => `
      <div class="card tight sunk">
        <div class="tiny muted" style="margin-bottom:5px">${esc(fmtDayShort(d))}</div>
        <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(text)}</div>
      </div>`).join('')}
  </div>
  <div class="tiny muted center" style="margin-top:12px;line-height:1.55">
    Useful on a bad week — you can look back and see what was actually going on, rather than
    concluding you were just being weak.
  </div>`;
}

/* ---------------- sheets ---------------- */
function openSleep(){
  const d = today();
  const s = sleepOn(d) || { hours:7, quality:3 };
  openSheet(`
    <h2>Last night</h2>
    <p class="sub">Rough numbers are fine. The pattern is what matters, not the precision.</p>
    <label class="label">Hours</label>
    <input class="input" type="number" inputmode="decimal" step="0.5" min="0" max="16" id="sl-h"
      value="${s.hours}" style="font-size:24px;font-weight:700;text-align:center;padding:16px">
    <label class="label" style="margin-top:18px">How was it</label>
    <div class="chips" id="sl-q">
      ${['Rough','Broken','Alright','Solid'].map((l,i) =>
        `<button class="chip ${s.quality===i+1?'on':''}" data-act="q" data-v="${i+1}">${l}</button>`).join('')}
    </div>
    <button class="btn btn-primary block" style="margin-top:20px" data-act="save">Save</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  let q = s.quality;
  bindActions(document.querySelector('.sheet'), {
    q: (dd, el) => { q = +dd.v; el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c===el)); },
    save: () => {
      store.update(st => { st.sleep[d] = { hours: sheetNum('sl-h', 7), quality: q }; });
      closeSheet(); haptic(); render();
    },
    close: closeSheet,
  });
}

function openReset(id){
  const r = RESETS.find(x => x.id === id);
  if (!r) return;
  openSheet(`
    <h2>${esc(r.name)}</h2>
    <p class="sub">${esc(r.time)}</p>
    <div class="card tight sunk" style="margin-bottom:14px">
      <div style="font-size:15px;line-height:1.65">${esc(r.how)}</div>
    </div>
    <div class="label">Why it works</div>
    <div class="card-note" style="line-height:1.6">${esc(r.why)}</div>
    <button class="btn btn-primary block" style="margin-top:20px" data-act="close">Done</button>
  `);
  bindActions(document.querySelector('.sheet'), { close: closeSheet });
}

function openSettings(){
  const s = store.get();
  openSheet(`
    <h2>Anchors</h2>
    <p class="sub">Your list, not mine. Meds and food stay marked essential so they survive a heavy day.</p>
    <div class="stack" style="gap:8px">
      ${s.anchors.map((a,i) => `
        <div class="rowcard">
          <span style="color:var(--accent-1)">${icon(a.icon,20)}</span>
          <div class="grow"><b style="font-size:14.5px">${esc(a.label)}</b>
            <span class="sub" style="font-size:11.5px">${a.core ? 'Essential' : 'Optional'}</span></div>
          ${!a.core ? `<button class="btn btn-sm" style="color:var(--faint);padding:6px 9px"
            data-act="rm" data-id="${a.id}">${icon('close',15)}</button>` : ''}
        </div>`).join('')}
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      <input class="input grow" id="new-anchor" placeholder="Add an anchor">
      <button class="btn btn-soft btn-sm" data-act="add">Add</button>
    </div>
    <div class="tiny muted" style="margin-top:10px;line-height:1.55">
      Keep them small and physical. An anchor you resent stops being one.
    </div>
    <button class="btn btn-ghost block" style="margin-top:18px" data-act="close">Done</button>
  `);
  const reopen = () => { closeSheet(); setTimeout(openSettings, 160); };
  bindActions(document.querySelector('.sheet'), {
    add: () => {
      const v = sheetVal('new-anchor').trim();
      if (!v) return;
      store.update(st => st.anchors.push({ id:uid(), label:v, icon:'check', core:false, note:'' }));
      reopen();
    },
    rm: d => { store.update(st => { st.anchors = st.anchors.filter(a => a.id !== d.id); }); reopen(); },
    close: () => { closeSheet(); render(); },
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    toggle: d => {
      const day = today();
      store.update(s => {
        if (!s.done[day]) s.done[day] = {};
        if (s.done[day][d.id]) delete s.done[day][d.id];
        else s.done[day][d.id] = true;
      });
      haptic();
      render();
    },
    dose: d => {
      const day = today(), i = +d.i, cur = medsTaken(day);
      // Behaves like a star rating: tapping the Nth pip sets the count to
      // N, except tapping the last filled one unticks it. So a mis-tap is
      // always one tap to undo, and correcting 3 back to 1 does not wipe
      // the lot — which is what the naive version did.
      const target = (i + 1 === cur) ? i : i + 1;
      bumpMeds(day, target - cur);
      haptic();
      render();
    },
    sleep: openSleep,
    reset: d => openReset(d.id),
    savenote: () => {
      const v = document.getElementById('day-note').value;
      store.update(s => { s.notes[today()] = v; });
      toast('Saved');
    },
    reprompt: () => {
      // Re-rendering blows away whatever is half-typed in the box, so keep
      // it. Shuffling the question should never cost you a sentence.
      const draft = document.getElementById('day-note')?.value ?? '';
      promptNudge++;
      render();
      const box = document.getElementById('day-note');
      if (box){ box.value = draft; }
    },
    heavy: () => {
      const d = today();
      store.update(s => { if (s.heavy[d]) delete s.heavy[d]; else s.heavy[d] = true; });
      haptic();
      render();
    },
    settings: openSettings,
  });
}
