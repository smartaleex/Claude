/* ============================================================
   Forge — training. 4-day split, 3 supersets a session, 6-week blocks.
   Logs sets, tracks the block clock, and reads bodyweight from Fuel.
   ============================================================ */

import { Slice, today, dayKey, keyToDate, daysBetween, uid, fmtDayShort } from '../core/store.js';
import { ask } from '../core/ai.js';
import {
  esc, num, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic,
} from '../core/ui.js';
import { BLOCKS, WARMUPS, EXTRAS, PHYSIQUE } from '../data/workouts.js';

const store = new Slice('forge', {
  blockIndex: 0,
  blockStart: today(),
  sessions: {},     // sessionId -> { day, dayKey, sets:{ exKey:[{w}] }, done }
  lastByEx: {},     // exercise name -> { w } for prefilling
  activeId: null,
});

/* A set is just a tick. Weight is optional metadata on top of it —
   in the gym you want one tap, not a form. Reps live in the program
   (3 × 10-12), so re-entering them per set was noise. */
const setWeight = s => (s && typeof s === 'object') ? s.w : null;
const fmtSet = s => {
  const w = setWeight(s);
  return w === null || w === undefined || w === '' ? '✓' : `${w}kg`;
};

let tab = 'plan';
let root = null;

const block = () => BLOCKS[store.get().blockIndex % BLOCKS.length];
const weekInBlock = () => Math.floor(daysBetween(store.get().blockStart, today()) / 7) + 1;

/* Rotate the block after 6 weeks — you asked for a 6-week interchange. */
function checkBlockRollover(){
  if (weekInBlock() > 6){
    store.update(s => {
      s.blockIndex = (s.blockIndex + 1) % BLOCKS.length;
      s.blockStart = today();
    });
    return true;
  }
  return false;
}

/** Which day is next: the one least recently trained. */
function nextDay(){
  const sess = Object.values(store.get().sessions).filter(s => s.done);
  const b = block();
  let best = b.days[0], bestTime = Infinity;
  for (const d of b.days){
    const last = sess.filter(s => s.day === d.key).map(s => s.dayKey).sort().at(-1);
    const t = last ? keyToDate(last).getTime() : 0;
    if (t < bestTime){ bestTime = t; best = d; }
  }
  return best;
}

const doneCount = () => Object.values(store.get().sessions).filter(s => s.done).length;

function thisWeekCount(){
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mk = dayKey(monday);
  return Object.values(store.get().sessions).filter(s => s.done && s.dayKey >= mk).length;
}

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  checkBlockRollover();
  const b = block();
  const d = nextDay();
  const w = thisWeekCount();
  return {
    headline: doneToday(d.key) ? 'Done for today ✓' : d.name,
    detail: `Phase ${b.phase} · ${b.name} · week ${Math.min(weekInBlock(),6)} of 6`,
    badge: `${w}/4 this week`,
    // Rendered as a chip row on the HQ tile so today's session can be
    // switched without opening Forge — plans change on the way to the gym.
    chips: b.days.map(day => ({
      label: SHORT[day.key] || day.name,
      act: 'forge-day',
      data: { d: day.key },
      on: doneToday(day.key),
    })),
  };
}

/** Short labels for the HQ chip row. */
const SHORT = { d1:'Delts/Lats', d2:'Push', d3:'Legs', d4:'Back/Arms' };

/** Called from the HQ tile. Only creates the session — rendering is left
    to mount(), since Forge has no root element until it's navigated to. */
export async function startFromHome(dayK){
  await store.load();
  newSession(dayK);
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
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Training · Forge</div>
        <h1 class="page-h1">${tab==='plan' ? 'The plan' : tab==='goal' ? 'The goal' : 'History'}</h1>
        <div class="page-sub">Phase ${block().phase} · ${esc(block().name)} · week ${Math.min(weekInBlock(),6)} of 6</div>
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
  const b = block();
  const next = nextDay();
  const wk = thisWeekCount();

  return `
  <div class="hero in">
    <div class="eyebrow" style="color:rgba(255,255,255,.75)">Up next</div>
    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:29px;letter-spacing:-.03em;margin-top:6px">${esc(next.name)}</div>
    <div class="hero-cap">3 supersets · 6 exercises · about 40 minutes</div>
    <div class="bar"><i style="width:${wk/4*100}%"></i></div>
    <div class="hero-cap" style="margin-top:8px">${wk} of 4 sessions done this week</div>
  </div>

  <button class="btn btn-primary block in in-2" style="margin-top:14px" data-act="start" data-d="${next.key}">
    Start ${esc(next.name)} →
  </button>

  <div class="card in in-2" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
    <div class="spread">
      <div class="grow">
        <div class="card-title">Phase ${b.phase} · ${esc(b.name)}</div>
        <div class="card-note" style="margin-top:4px">${esc(b.focus)}</div>
      </div>
    </div>
    <div class="tiny muted" style="margin-top:10px">
      Week ${Math.min(weekInBlock(),6)} of 6 — then it rolls to
      Phase ${(b.phase % BLOCKS.length) + 1}, and cycles back round after Phase ${BLOCKS.length}.
    </div>
  </div>

  <div class="sec">Pick today's session</div>
  <div class="stack" style="gap:9px">
    ${b.days.map(d => {
      const last = Object.values(store.get().sessions)
        .filter(s => s.done && s.day === d.key).map(s => s.dayKey).sort().at(-1);
      const isDone = doneToday(d.key);
      return `<div class="rowcard" style="${isDone?'opacity:.72':''}">
        <button data-act="${isDone?'undo':'tick'}" data-d="${d.key}" aria-label="Mark done"
          style="width:30px;height:30px;border-radius:99px;flex:none;display:grid;place-items:center;
                 font-size:14px;font-weight:800;
                 background:${isDone?'var(--good)':'var(--bg-sunk)'};
                 color:${isDone?'#fff':'var(--faint)'}">${isDone?'✓':''}</button>
        <button class="grow" data-act="start" data-d="${d.key}" style="text-align:left">
          <div class="spread" style="align-items:baseline">
            <b style="${isDone?'text-decoration:line-through':''}">${esc(d.name)}</b>
            <span class="badge ${d.tag==='Priority'?'accent':'neutral'}">${esc(d.tag)}</span>
          </div>
          <span class="sub">${isDone ? 'Done today' : last ? 'Last done ' + esc(fmtDayShort(last)) : 'Not done yet'}</span>
        </button>
        <span class="caret">›</span>
      </div>`;
    }).join('')}
  </div>
  <div class="tiny muted" style="margin:8px 2px 0">
    Tap the circle to tick a session off, or the name to open it and log sets.
  </div>

  <div class="sec">Optional extras</div>
  <div class="card in">
    <div class="card-note" style="margin-bottom:12px">
      Add any of these when you've got a spare five minutes. The face pulls and dead hangs matter more than they look.
    </div>
    ${EXTRAS.map(e => `
      <div style="padding:11px 0;border-bottom:1px solid var(--line-soft)">
        <div class="spread"><b style="font-size:14.5px">${esc(e.n)}</b><span class="tiny muted mono">${esc(e.d)}</span></div>
        <div class="tiny muted" style="margin-top:3px">${esc(e.why)}</div>
      </div>`).join('')}
  </div>`;
}

/* ---------------- live session ---------------- */
function sessionHTML(sess){
  const b = block();
  const day = b.days.find(d => d.key === sess.day);
  const wu = WARMUPS[day.warmup];
  const totalSets = day.supersets.reduce((n,ss) => n + ss.a.s + ss.b.s, 0);
  const doneSets = Object.values(sess.sets).reduce((n,arr) => n + arr.length, 0);

  return `
  <div class="card in" style="background:var(--accent-tint);border-color:transparent">
    <div class="spread">
      <div class="grow">
        <div class="card-title">${esc(day.name)}</div>
        <div class="card-note" style="margin-top:3px">${doneSets} of ${totalSets} sets logged</div>
      </div>
      <button class="btn btn-sm btn-plain" data-act="abandon">Exit</button>
    </div>
    <div class="bar" style="background:rgba(0,0,0,.08);margin-top:14px">
      <i style="width:${doneSets/totalSets*100}%;background:var(--accent-1)"></i>
    </div>
  </div>

  <div class="card in in-2" style="margin-top:14px">
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
  </div>

  ${day.note ? `<div class="tiny muted" style="margin:16px 2px 0;line-height:1.6">${esc(day.note)}</div>` : ''}

  ${day.supersets.map((ss,i) => `
    <div class="sec">Superset ${String.fromCharCode(65+i)} · minimal rest between the pair, 90s after</div>
    <div class="card in" style="padding:0;overflow:hidden">
      ${[ss.a, ss.b].map((ex,j) => exerciseHTML(ex, `${i}-${j}`, sess, j===0)).join('')}
    </div>`).join('')}

  <button class="btn btn-primary block" style="margin:20px 0 8px" data-act="finish">Finish session ✓</button>`;
}

function exerciseHTML(ex, key, sess, first){
  const logged = sess.sets[key] || [];
  const prev = store.get().lastByEx[ex.n];
  const doneAll = logged.length >= ex.s;
  return `
  <div style="padding:16px;${first ? 'border-bottom:1px solid var(--line-soft)' : ''}">
    <div class="spread" style="align-items:flex-start">
      <div class="grow">
        <b style="font-size:15px;${doneAll?'opacity:.55':''}">${esc(ex.n)}</b>
        <div class="tiny muted mono" style="margin-top:2px">
          ${logged.length}/${ex.s} × ${esc(ex.r)}${prev?.w != null ? ` · last ${prev.w}kg` : ''}
        </div>
      </div>
      <button class="btn ${doneAll?'btn-plain':'btn-soft'} btn-sm" data-act="addset" data-k="${key}" data-n="${esc(ex.n)}">
        ${doneAll ? '+ Extra' : '+ Set'}
      </button>
    </div>
    ${ex.note ? `<div class="tiny" style="margin-top:8px;color:var(--accent-1);background:var(--accent-tint);padding:9px 11px;border-radius:11px;line-height:1.5">${esc(ex.note)}</div>` : ''}
    ${logged.length ? `<div class="chips" style="margin-top:10px">
      ${logged.map((s,i) => `<button class="chip on" style="font-size:12.5px;padding:7px 13px"
          data-act="editset" data-k="${key}" data-i="${i}" data-n="${esc(ex.n)}">${fmtSet(s)}</button>`).join('')}
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
      <div><div class="hero-num" style="font-size:46px">${round(cur,1)}<span style="font-size:22px">kg</span></div>
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
      ['Side & rear delts','Shoulder width is the whole illusion. Trained on 3 of 4 days for a reason.'],
      ['Lat width','Wide grips and straight-arm work. Width makes the waist look smaller without losing a kilo.'],
      ['Upper chest','15-30° incline only. A high chest reads swimmer; a low one reads gym.'],
      ['Posture','Lower traps and rear delts. Rounded shoulders hide everything you build.'],
    ].map(([t,d]) => `<div style="padding:10px 0">
      <b style="font-size:14.5px">${t}</b>
      <div class="tiny muted" style="margin-top:2px;line-height:1.55">${d}</div></div>`).join('')}
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

  <button class="btn btn-plain block in" style="margin-top:14px" data-act="advice">✨ Ask about form or a swap</button>`;
}

/* ---------------- history ---------------- */
function historyHTML(){
  const sess = Object.values(store.get().sessions).filter(s => s.done)
    .sort((a,b) => b.dayKey.localeCompare(a.dayKey));
  if (!sess.length) return empty('🏋️', 'No sessions logged yet.<br>Finish one and it will show up here.');

  return `
  <div class="grid2 in" style="margin-bottom:14px">
    ${stat(num(doneCount()), 'Sessions all time')}
    ${stat(num(thisWeekCount()) + '<small>/4</small>', 'This week')}
  </div>
  <div class="stack" style="gap:9px">
    ${sess.slice(0,40).map(s => {
      const day = BLOCKS.flatMap(b => b.days).find(d => d.key === s.day);
      const nSets = Object.values(s.sets || {}).reduce((n,a) => n + a.length, 0);
      // Only sets that carry a weight contribute to volume; a ticked set
      // still counts as training, it just isn't measurable.
      const weighted = Object.values(s.sets || {}).flat().filter(x => setWeight(x) != null);
      const vol = weighted.reduce((n,x) => n + setWeight(x), 0);
      const detail = s.quick || !nSets
        ? 'Ticked off'
        : `${nSets} set${nSets>1?'s':''}${weighted.length ? ` · ${num(vol)}kg total` : ''}`;
      return `<div class="rowcard">
        <div class="grow"><b>${esc(day?.name || s.day)}</b>
          <span class="sub">${esc(fmtDayShort(s.dayKey))} · ${detail}</span></div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ---------------- actions ---------------- */
/** Create and make active. No rendering, so it's safe to call before mount. */
function newSession(dayKey_){
  const id = uid();
  store.update(s => {
    s.sessions[id] = { id, day:dayKey_, dayKey:today(), sets:{}, done:false };
    s.activeId = id;
  });
  tab = 'plan';
  return id;
}

function startSession(dayKey_){
  newSession(dayKey_);
  haptic();
  render();
}

/* One tap logs the set. Weight carries over from last time if you've
   logged it before, otherwise the set is just a tick — you can add the
   number later, or never. Nothing here should slow you down mid-set. */
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

/* Finishing never requires logged sets. Plenty of sessions get done
   without anyone touching their phone, and refusing to record those
   would make the history lie about how much training actually happened. */
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

/** Mark a day complete straight from the plan, without opening it. */
function quickComplete(dayK){
  const b = block();
  const name = b.days.find(d => d.key === dayK)?.name || 'Session';
  store.update(s => {
    const id = uid();
    s.sessions[id] = { id, day:dayK, dayKey:today(), sets:{}, done:true, quick:true };
  });
  haptic(20);
  toast(`${name} ✓`);
  render();
}

/** Undo a tick made today, in case of a mis-tap. */
function undoToday(dayK){
  store.update(s => {
    const match = Object.values(s.sessions)
      .filter(x => x.done && x.day === dayK && x.dayKey === today())
      .sort((a,b) => (a.id > b.id ? -1 : 1))[0];
    if (match) delete s.sessions[match.id];
  });
  haptic();
  toast('Undone');
  render();
}

const doneToday = dayK => Object.values(store.get().sessions)
  .some(s => s.done && s.day === dayK && s.dayKey === today());

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
      try{
        const res = await ask({
          prompt: `You are a strength coach. Your client: 185cm, ~75kg, already lean with visible abs, chasing a swimmer physique (wide delts, wide lats, high upper chest). He is lean bulking, trains 4 days a week, 35-45 minutes, three supersets per session, fasted in the morning.

Critical constraints you must respect in any advice:
- Weak/unstable shoulder AND generalised hypermobility. Passive structures won't protect his joints, so avoid deep-stretch overhead loading, behind-the-neck work, deep barbell benching and deep dips. Prefer neutral grips, controlled ROM, dumbbells and cables.
- Distal triceps/elbow pain when pressing. He warms up with high-rep light pushdowns. Avoid hard lockouts.
- Knees cave inward under load.
He cares about how he looks, not what he lifts.

His question: "${q}"

Respond with ONLY this JSON:
{"answer":"2-4 short paragraphs, plain language, specific and practical","swaps":[{"instead":"exercise name","use":"replacement","why":"one line"}]}`,
          offline: () => ({
            answer: 'AI is off right now, so here are the standing rules: if a movement hurts the shoulder, move to a neutral grip and cut the range before you cut the weight. If the elbow is the problem, add a second round of light pushdowns before pressing and stop short of lockout. Anything that loads a deep stretch overhead is the wrong exercise for your joints, no matter how good it is for everyone else.',
            swaps: [
              { instead:'Barbell overhead press', use:'Half-kneeling landmine press', why:'Keeps the arc in front of your body where the shoulder is stable.' },
              { instead:'Deep barbell bench',     use:'Incline dumbbell press to a controlled depth', why:'Stops the shoulder reaching the end range that bothers it.' },
              { instead:'Dips',                   use:'Weighted push-up', why:'Same triceps and chest work without the bottom position that irritates both joints.' },
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

function openSettings(){
  const s = store.get();
  openSheet(`
    <h2>Phases</h2>
    <p class="sub">Six weeks each, then it advances on its own and loops back to Phase 1 after the last one. Switch manually any time.</p>
    <label class="label">Current phase</label>
    <div class="stack" style="gap:8px">
      ${BLOCKS.map((b,i) => `
        <button class="card tight" data-act="setblock" data-i="${i}"
                style="text-align:left;box-shadow:none;background:${i===s.blockIndex?'var(--accent-tint)':'var(--surface-2)'}">
          <div class="spread"><b>Phase ${b.phase} · ${esc(b.name)}</b>${i===s.blockIndex?'<span class="badge accent">Current</span>':''}</div>
          <div class="tiny muted" style="margin-top:4px">${esc(b.focus)}</div>
        </button>`).join('')}
    </div>
    <button class="btn btn-plain block" style="margin-top:16px" data-act="restart">Restart the 6-week clock</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    setblock: d => {
      store.update(st => { st.blockIndex = +d.i; st.blockStart = today(); });
      closeSheet(); toast('Block switched'); render();
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
