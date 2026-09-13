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
  /* Off by default: he has a separate app that actually sends
     notifications, and a second half-kept log is worse than none — it
     makes adherence look terrible in the doctor summary when the doses
     were taken, just recorded elsewhere. */
  medTrack: false,
  anchors: DEFAULT_ANCHORS,
  done: {},        // dayKey -> { anchorId: true }
  sleep: {},       // dayKey -> { hours, quality }   quality 1-4
  mood: {},        // dayKey -> { m, e }  m -3..+3 (low..elevated), e 0..3 energy
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
const moodOn     = d => store.get().mood[d] || null;

/* Mood is bipolar, not a happiness score. A 1-to-5 "how good was today"
   cannot represent being wired at 3am, which is the state that actually
   needs catching. So it runs low to elevated through a true middle, and
   energy is a separate axis — low mood with high energy is a mixed state
   and the most dangerous square on the board. */
const MOOD_SCALE = [
  { v:-3, label:'Very low',  tone:'#3B5BDB' },
  { v:-2, label:'Low',       tone:'#5C7CFA' },
  { v:-1, label:'A bit flat',tone:'#91A7FF' },
  { v: 0, label:'Level',     tone:'#51CF66' },
  { v: 1, label:'Lifted',    tone:'#FFD43B' },
  { v: 2, label:'High',      tone:'#FF922B' },
  { v: 3, label:'Very high', tone:'#F03E3E' },
];
const moodMeta = v => MOOD_SCALE.find(x => x.v === v) || MOOD_SCALE[3];
const ENERGY = ['Flat', 'Low', 'Okay', 'Wired'];

/** On a heavy day only the core anchors are asked for. */
const visibleAnchors = d => {
  const list = isHeavy(d) ? anchors().filter(a => a.core) : anchors();
  return store.get().medTrack ? list : list.filter(a => a.id !== 'meds');
};

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

/* What this app would most like you to do right now, and how loudly.
   Home collects these from every tool and shows only the winner — one
   clear instruction beats six dashboards when you are running on empty.
   Urgency rises through the day so a missed morning dose gets louder
   rather than quietly scrolling away. */
function nextFromDay(){
  const d = today(), h = new Date().getHours();
  /* No medication nudge. He asked for it gone — a dedicated app already
     sends those notifications, and two things reminding you about the
     same dose is how you start ignoring both. */
  if (h >= 18 && !moodOn(d)){
    return { id:'mood', label:'How was today?', sub:'Ten seconds. It builds the picture.',
             act:'day-mood', icon:'spark', urgency:55 };
  }
  if (h < 12 && !sleepOn(d)){
    return { id:'sleep', label:'How did you sleep?', sub:'The earliest warning sign there is.',
             act:'day-sleep', icon:'moon', urgency:45 };
  }
  return null;
}

/* ---------------- summary (HQ) ---------------- */
export async function summary(){
  await store.load();
  const d = today();
  const vis = visibleAnchors(d);
  const n = doneCount(d);
  const track = store.get().medTrack;
  const sl = sleepOn(d), mo = moodOn(d);
  return {
    headline: `${n} of ${vis.length} done`,
    /* With medication tracked elsewhere, the useful second line is what is
       still unlogged here rather than a dose count he does not want. */
    detail: isHeavy(d)
      ? 'Heavy day — just the essentials'
      : track && !medsAllIn(d) ? `Meds ${medsTaken(d)}/${medDoses()}`
      : !mo ? 'Mood not logged yet'
      : !sl ? 'Sleep not logged yet'
      : 'Mood and sleep logged',
    badge: track && !medsAllIn(d) ? 'Meds' : null,
    // Tickable from the home screen. The whole point of an anchor is
    // that logging it costs nothing — making him open an app first is
    // exactly the friction that stopped the nicotine logging.
    next: nextFromDay(),
    pips: vis.map(a => ({
      id: a.id,
      label: a.id === 'meds' ? `Meds ${medsTaken(d)}/${medDoses()}` : a.label,
      on: isDone(d, a.id),
      partial: a.id === 'meds' && medsTaken(d) > 0 && !medsAllIn(d),
    })),
  };
}

/** Called from the HQ hero so anchors can be ticked without navigating. */
/* Home opens these directly so a one-tap instruction stays one tap. */
export async function openFromHome(what){
  await store.load();
  if (what === 'mood')  return openMood();
  if (what === 'sleep') return openSleep();
  if (what === 'meds')  { bumpMeds(today(), 1); haptic(); return true; }
}

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

function paintView(){
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

/* Re-rendering swaps the whole view via innerHTML. For a moment the page
   has no height, so the browser clamps scrollY to 0 and you get thrown to
   the top — which is what happened every time a set or a number was
   logged. Capture the offset, repaint, put it back. */
function render(){
  const y = window.scrollY;
  paintView();
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
}

/* ---------------- today ---------------- */
function moodCardHTML(d){
  const mo = moodOn(d);
  if (!mo) return `
    <button class="card in" data-act="mood" style="width:100%;text-align:left">
      <div class="spread">
        <div class="grow">
          <div class="card-title">Not logged</div>
          <div class="card-note" style="margin-top:3px">
            Ten seconds. Over weeks it becomes the thing a doctor can actually read.
          </div>
        </div>
        <span style="color:var(--accent-1)">${icon('spark',22)}</span>
      </div>
    </button>`;

  const m = moodMeta(mo.m);
  return `
  <button class="card in" data-act="mood" style="width:100%;text-align:left">
    <div class="spread">
      <div class="grow">
        <div class="card-title" style="color:${m.tone}">${esc(m.label)}</div>
        <div class="card-note" style="margin-top:3px">Energy: ${esc(ENERGY[mo.e ?? 2])} — tap to change</div>
      </div>
      <span style="width:40px;height:40px;border-radius:99px;flex:none;background:${m.tone};
                   box-shadow:var(--clay-sm)"></span>
    </div>
  </button>`;
}

function openMood(){
  const d = today();
  const cur = moodOn(d) || { m:0, e:2 };
  let m = cur.m, e = cur.e ?? 2;

  const paint = () => {
    const meta = moodMeta(m);
    const lab = document.getElementById('mo-label');
    if (lab){ lab.textContent = meta.label; lab.style.color = meta.tone; }
    document.querySelectorAll('[data-act="mo"]').forEach(el => {
      const on = +el.dataset.v === m;
      el.style.transform = on ? 'scale(1.28)' : 'scale(1)';
      el.style.boxShadow = on ? '0 0 0 3px var(--surface), 0 0 0 5.5px currentColor' : 'var(--clay-sm)';
    });
    document.querySelectorAll('[data-act="en"]').forEach(el =>
      el.classList.toggle('on', +el.dataset.v === e));
  };

  openSheet(`
    <h2>How are you today?</h2>
    <p class="sub">Low to high through a level middle — not good to bad.</p>

    <div class="center" style="margin:20px 0 6px">
      <b id="mo-label" style="font-family:'Sora',sans-serif;font-size:22px"></b>
    </div>
    <div class="row" style="justify-content:space-between;gap:6px;margin-top:10px">
      ${MOOD_SCALE.map(x => `
        <button data-act="mo" data-v="${x.v}" aria-label="${esc(x.label)}"
          style="width:34px;height:34px;border-radius:99px;flex:none;color:${x.tone};
                 background:${x.tone};box-shadow:var(--clay-sm);transition:transform .16s"></button>`).join('')}
    </div>
    <div class="spread tiny muted" style="margin-top:8px">
      <span>Very low</span><span>Level</span><span>Very high</span>
    </div>

    <label class="label" style="margin-top:22px">Energy</label>
    <div class="chips" id="mo-energy">
      ${ENERGY.map((l, i) => `<button class="chip" data-act="en" data-v="${i}">${l}</button>`).join('')}
    </div>
    <div class="tiny muted" style="margin-top:8px;line-height:1.55">
      Worth splitting out: feeling low but wired is a different state from feeling
      low and flat, and it is the one to mention to a doctor.
    </div>

    <button class="btn btn-primary block" style="margin-top:20px" data-act="save">Save</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    mo: dd => { m = +dd.v; haptic(6); paint(); },
    en: dd => { e = +dd.v; haptic(6); paint(); },
    save: () => {
      store.update(st => { st.mood[d] = { m, e }; });
      closeSheet(); haptic(); toast('Logged'); render();
    },
    close: closeSheet,
  });
  paint();
}

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

  <div class="sec">How are you today</div>
  ${moodCardHTML(d)}

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
/* Mood over the last 28 days as a column either side of a centre line —
   above the line is elevated, below is low. A single rising or falling
   trace is how you actually see a cycle turning, which a list of numbers
   never shows you. */
function moodChartHTML(){
  const days = lastNDays(28);
  const any = days.some(d => moodOn(d));
  if (!any) return `
    <div class="card in">
      <div class="card-title">Mood chart</div>
      <div class="card-note" style="margin-top:4px;line-height:1.6">
        Log a few days and a shape appears here — the rise and fall over weeks is
        the thing worth seeing, and the thing worth showing someone.
      </div>
    </div>`;

  const H = 96, mid = H / 2;
  return `
  <div class="card in">
    <div class="card-title">Mood · last 28 days</div>
    <div class="card-note" style="margin-top:3px">Above the line is elevated, below is low.</div>
    <div style="display:flex;align-items:stretch;gap:2px;height:${H}px;margin-top:14px;position:relative">
      <div style="position:absolute;left:0;right:0;top:${mid}px;height:1.5px;background:var(--line);"></div>
      ${days.map(d => {
        const mo = moodOn(d);
        if (!mo) return `<div style="flex:1"></div>`;
        const meta = moodMeta(mo.m);
        const h = Math.abs(mo.m) / 3 * (mid - 4);
        const up = mo.m > 0;
        return `<div style="flex:1;position:relative">
          <div style="position:absolute;left:0;right:0;border-radius:3px;background:${meta.tone};
            ${mo.m === 0
              ? `top:${mid-2.5}px;height:5px`
              : up ? `bottom:${H-mid}px;height:${h}px` : `top:${mid}px;height:${h}px`}"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="spread tiny muted" style="margin-top:8px">
      <span>4 weeks ago</span><span>Today</span>
    </div>
  </div>`;
}

/* What a psychiatrist actually asks at an appointment, answered from the
   log instead of from memory — memory being exactly what is unreliable
   during a mood episode. Sleep gets the most weight because for bipolar
   it is the earliest reliable warning sign there is. */
function buildReport(n = 28){
  const days = lastNDays(n);
  const moods = days.map(moodOn).filter(Boolean);
  const sleeps = days.map(sleepOn).filter(s => s && s.hours > 0);
  const rate = medsRate(n);

  const L = [];
  L.push(`ALEX HQ — ${n}-day summary to ${fmtDayShort(today())}`);
  L.push('');

  L.push(`MEDICATION`);
  if (store.get().medTrack){
    L.push(`  ${rate.doses} of ${rate.ofDoses} doses logged (${Math.round(rate.doses / Math.max(1,rate.ofDoses) * 100)}%).`);
    L.push(`  ${rate.taken} of ${rate.of} days complete.`);
  } else {
    // Reporting 0% would be a lie that a clinician would act on.
    L.push('  Tracked in a separate app, not here. Figures not available.');
  }
  L.push('');

  L.push(`SLEEP`);
  if (sleeps.length){
    const hrs = sleeps.map(s => s.hours);
    const avg = hrs.reduce((a,b) => a+b, 0) / hrs.length;
    const lo = Math.min(...hrs), hi = Math.max(...hrs);
    const short = hrs.filter(h => h < 6).length;
    L.push(`  Average ${avg.toFixed(1)}h across ${sleeps.length} logged nights (range ${lo}–${hi}h).`);
    L.push(`  ${short} night${short===1?'':'s'} under 6 hours.`);
    if (hi - lo >= 4) L.push(`  Spread of ${hi - lo}h between shortest and longest night.`);
  } else L.push('  No nights logged.');
  L.push('');

  L.push(`MOOD (scale -3 very low to +3 very high)`);
  if (moods.length){
    const vals = moods.map(m => m.m);
    const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const low = vals.filter(v => v <= -2).length;
    const high = vals.filter(v => v >= 2).length;
    L.push(`  ${moods.length} day${moods.length===1?'':'s'} logged. Average ${avg.toFixed(1)}, range ${lo} to ${hi}.`);
    L.push(`  ${low} day${low===1?'':'s'} at or below -2; ${high} day${high===1?'':'s'} at or above +2.`);
    const mixed = moods.filter(m => m.m <= -1 && (m.e ?? 2) >= 3).length;
    if (mixed) L.push(`  ${mixed} day${mixed===1?'':'s'} logged as low mood with high energy (mixed features).`);
  } else L.push('  No days logged.');
  L.push('');

  /* Three or more short nights in a row sitting next to elevated mood is
     the pattern worth putting in front of a clinician by name. */
  const flags = [];
  let run = 0;
  for (const d of days){
    const sl = sleepOn(d);
    if (sl && sl.hours > 0 && sl.hours < 6){ run++; if (run >= 3) break; } else run = 0;
  }
  if (run >= 3) flags.push('Three or more consecutive nights under 6 hours.');
  if (moods.some(m => m.m >= 2) && moods.some(m => m.m <= -2))
    flags.push('Both elevated (+2 or more) and low (-2 or less) days inside this window.');
  if (store.get().medTrack && rate.ofDoses && rate.doses / rate.ofDoses < 0.8)
    flags.push('Medication logged under 80% of doses.');

  if (flags.length){
    L.push('WORTH RAISING');
    flags.forEach(f => L.push(`  - ${f}`));
    L.push('');
  }

  L.push('Self-reported, logged daily on a phone. Not a clinical instrument.');
  return L.join('\n');
}

function openReport(){
  const text = buildReport(28);
  openSheet(`
    <h2>Summary for your doctor</h2>
    <p class="sub">Built from what you have logged. Copy it, or read it off the screen.</p>
    <div class="card tight sunk" style="margin-top:14px">
      <pre style="margin:0;white-space:pre-wrap;font-size:12.5px;line-height:1.6;
                  font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${esc(text)}</pre>
    </div>
    <button class="btn btn-primary block" style="margin-top:16px" data-act="copy">Copy it</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    copy: async () => {
      try{ await navigator.clipboard.writeText(text); toast('Copied ✓'); }
      catch{ toast('Select the text and copy it manually'); }
    },
    close: closeSheet,
  });
}

function trendHTML(){
  const m14 = medsRate(14), m30 = medsRate(30);
  const sl = sleepAvg(7);
  const days = lastNDays(14);

  return `
  ${moodChartHTML()}

  <button class="btn btn-plain block in" style="margin-top:12px" data-act="report">
    ${icon('note',17)} Summary for your doctor
  </button>

  <div class="grid2 in" style="margin-top:14px">
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
    mood: openMood,
    report: openReport,
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
