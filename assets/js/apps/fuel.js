/* ============================================================
   Fuel — macro tracking for the lean bulk.
   Photo/label/text logging, AI suggestions, history, trends.
   ============================================================ */

import { Slice, today, shiftDay, lastNDays, fmtDay, fmtDayShort, uid } from '../core/store.js';
import { ask, fileToImage, clean, aiStatus } from '../core/ai.js';
import {
  esc, num, round, pct, toast, openSheet, closeSheet, sheetNum, bindActions,
  meter, stat, empty, barChart, haptic, $$,
} from '../core/ui.js';
import { icon } from '../core/icons.js';
import { offlineMatch, offlineSuggest, looksBranded } from '../data/foods.js';

/* Targets carried over verbatim from the original Fuel artifact
   (fuelv2.html): 2800 kcal, 150p / 340c / 90f. Kept as the default so the
   app matches what he has actually been tracking against.

   Note these sit slightly below the calculated lean-bulk figure of
   ~2930 (maintenance ~2655 + 275). That gap is deliberate — the artifact
   numbers are the source of truth, and Trends offers the calculated
   target as a suggestion rather than silently overriding them. */
const store = new Slice('fuel', {
  targets: { kcal:2800, p:150, c:340, f:90 },
  cycle: true,     // carbs follow the training week — see todaysTargets()
  profile: { kg:75, cm:185, age:28, activity:1.5 },
  days: {},
  weights: {},   // dayKey -> kg
});

/* ---------------- cross-app: today's training ----------------
   Fuel and Training were two silos describing the same body. A training
   day and a rest day should not have identical macros: on a lean bulk
   the carbs want to be where the work is.

   Read-only look at Forge's own store rather than a shared module —
   Fuel keeps working if Forge has never been opened. Protein and fat
   hold steady; carbs take the swing, because that is the macro that
   actually fuels the session. The multipliers are set so a 4-training /
   3-rest week averages back to the target: 4(1.08) + 3(0.89) = 6.99. */
const TRAIN_MULT = 1.08;
const REST_MULT  = 0.89;

function trainingToday(){
  try{
    const f = JSON.parse(localStorage.getItem('alexhq:forge') || '{}');
    const t = today();
    const sess = Object.values(f.sessions || {}).find(s => s.dayKey === t);
    if (!sess) return null;
    const days = ['Back + Biceps','Chest + Triceps','Legs + Core','Shoulders + Arms'];
    const idx = { d1:0, d2:1, d3:2, d4:3 }[sess.day];
    return { name: days[idx] || 'Session', done: !!sess.done };
  }catch{ return null; }
}

/** Targets adjusted for whether today is a training day. */
function todaysTargets(){
  const T = store.get().targets;
  if (!store.get().cycle) return { ...T, mode:'flat' };
  const tr = trainingToday();
  const mult = tr ? TRAIN_MULT : REST_MULT;
  const kcal = Math.round(T.kcal * mult);
  // Protein and fat hold; carbs absorb the difference.
  const c = Math.max(0, Math.round((kcal - T.p*4 - T.f*9) / 4));
  return { kcal, p:T.p, c, f:T.f, mode: tr ? 'training' : 'rest', session: tr?.name || null };
}

const ACTIVITY = [
  { v:1.375, l:'Light',    d:'Desk job, 2-3 sessions' },
  { v:1.5,   l:'Moderate', d:'Desk job, 4 sessions, on your feet a bit' },
  { v:1.65,  l:'High',     d:'Active job or 5+ sessions' },
];

/** Mifflin-St Jeor. Uses the latest logged weight if there is one. */
function maintenance(){
  const p = store.get().profile;
  const ws = store.get().weights;
  const keys = Object.keys(ws).sort();
  const kg = keys.length ? ws[keys.at(-1)] : p.kg;
  const bmr = 10*kg + 6.25*p.cm - 5*p.age + 5;
  return Math.round(bmr * p.activity);
}
const bulkTarget = () => maintenance() + 275;

let tab = 'today';
let viewDay = null;
let adding = false;
let photos = [];
let mealSel = 'Auto';
let root = null;

/* ---------------- data helpers ---------------- */
const entries = d => store.get().days[d] || [];
const totals = d => entries(d).reduce((t,e) => ({
  kcal: t.kcal + (+e.kcal||0), p: t.p + (+e.p||0),
  c: t.c + (+e.c||0), f: t.f + (+e.f||0),
}), { kcal:0, p:0, c:0, f:0 });

const autoMeal = () => {
  const h = new Date().getHours() + new Date().getMinutes()/60;
  return h < 10.5 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack';
};

/* ---------------- home summary ---------------- */
export async function summary(){
  await store.load();
  const t = totals(today()), T = store.get().targets;
  const left = Math.max(0, T.kcal - t.kcal);
  const pLeft = Math.max(0, T.p - t.p);
  return {
    headline: `${num(t.kcal)} / ${num(T.kcal)} kcal`,
    detail: pLeft > 0 ? `${num(pLeft)}g protein still to go` : 'Protein target hit ✓',
    badge: left > 0 ? `${num(left)} left` : 'Done',
  };
}

/* ---------------- mount ---------------- */
export async function mount(el, sub){
  root = el;
  await store.load();
  if (sub === 'add'){ tab = 'today'; adding = true; }
  render();
}

function render(){
  const T = store.get().targets;
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Lean bulk · Fuel</div>
        <h1 class="page-h1">${tab==='today' ? "Today" : tab==='history' ? 'History' : 'Trends'}</h1>
        <div class="page-sub">${tab==='today' ? esc(fmtDay(today())) : `${num(T.kcal)} kcal · ${num(T.p)}g protein target`}</div>
      </div>
      <button class="chip" data-act="targets">${icon('settings',18)}</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:16px 0">
    ${[['today','Today'],['history','History'],['trends','Trends']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  <div id="fuel-body">${
    tab === 'today'   ? dayHTML(today(), true)
  : tab === 'history' ? (viewDay ? dayHTML(viewDay, false) : historyHTML())
  :                     trendsHTML()
  }</div>`;

  if (tab === 'trends') drawTrends();
  bind();
}

/* ---------------- day view ---------------- */
function dayHTML(d, isToday){
  const t = totals(d);
  const T = isToday ? todaysTargets() : store.get().targets;
  const es = entries(d);
  const p = pct(t.kcal, T.kcal);
  const rem = T.kcal - t.kcal;

  return `
  ${!isToday ? `<div class="row" style="margin-bottom:14px">
    <button class="btn btn-plain btn-sm" data-act="back">‹ Back</button>
    <b style="font-family:'Sora',sans-serif">${esc(fmtDay(d))}</b>
  </div>` : ''}

  <div class="hero in">
    <div class="spread" style="align-items:flex-start">
      <div>
        <div class="hero-num">${num(t.kcal)}</div>
        <div class="hero-cap">of ${num(T.kcal)} kcal</div>
      </div>
      <div>
        <div class="hero-side">${Math.round(p)}%</div>
        <div class="hero-cap" style="text-align:right">${rem>=0 ? num(rem)+' to go' : num(-rem)+' over'}</div>
      </div>
    </div>
    <div class="bar"><i style="width:${p}%"></i></div>
    ${isToday && T.mode !== 'flat' ? `<div class="hero-cap" style="margin-top:9px;font-size:12.5px">
      ${T.mode === 'training'
        ? `Training day${T.session ? ' · ' + esc(T.session) : ''} — carbs up`
        : 'Rest day — carbs down, protein holds'}
    </div>` : ''}
  </div>

  <div class="card in in-2" style="margin-top:14px">
    ${meter({ label:'Protein', value:t.p, target:T.p, color:'var(--pro)', bar:'var(--pro-bar)' })}
    ${meter({ label:'Carbs',   value:t.c, target:T.c, color:'var(--carb)', bar:'var(--carb-bar)' })}
    ${meter({ label:'Fat',     value:t.f, target:T.f, color:'var(--fat)',  bar:'var(--fat-bar)' })}
  </div>

  ${isToday ? `
    <button class="btn btn-primary block in in-3" style="margin-top:14px" data-act="suggest" id="suggest-btn">
      ${icon('spark',17)} What should I eat?
    </button>

    <div class="row" style="margin:16px 0 12px">
      <button class="chip ${!adding?'on':''}" data-act="showlog">Log (${es.length})</button>
      <button class="chip ${adding?'on':''}" data-act="showadd">+ Add food</button>
    </div>
    ${adding ? addPanel() : logList(d)}
  ` : `<div style="margin-top:16px">${logList(d)}</div>`}`;
}

function logList(d){
  const es = entries(d);
  if (!es.length) return empty(icon('food',34), `Nothing logged ${d===today() ? 'yet today' : 'this day'}.<br>A lean bulk doesn't run on vibes.`);
  return `<div class="stack" style="gap:9px">` + [...es].reverse().map(e => `
    <div class="card tight" style="padding:14px 16px">
      <div class="spread" data-act="toggle" data-id="${e.id}">
        <div class="grow">
          <b style="font-size:15.5px">${esc(e.name)}</b>
          <div class="tiny muted" style="margin-top:2px">${esc(e.meal||'Snack')}</div>
        </div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:18px;color:var(--accent-1)">
          ${num(e.kcal)}<small style="font-family:Inter;font-weight:500;color:var(--muted);font-size:12px"> kcal</small>
        </div>
      </div>
      <div id="d-${e.id}" hidden style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft)">
        ${e.reasoning ? `<div class="tiny muted" style="background:var(--surface-2);padding:11px 12px;border-radius:12px;line-height:1.55;margin-bottom:10px">
          <span class="badge accent" style="margin-bottom:5px">${esc(e.source||'Estimate')}</span><br>${esc(e.reasoning)}</div>` : ''}
        <div class="row">
          ${[['P',e.p,'var(--pro)','var(--pro-tint)'],['C',e.c,'var(--carb)','var(--carb-tint)'],['F',e.f,'var(--fat)','var(--fat-tint)']]
            .map(([l,v,col,tint]) => `<div class="grow center" style="background:${tint};color:${col};border-radius:12px;padding:9px 4px">
              <b style="font-family:'Sora',sans-serif;font-size:15px;display:block">${num(v)}g</b>
              <span style="font-size:10px;letter-spacing:.09em;font-weight:700">${l}</span></div>`).join('')}
          <button class="btn btn-danger btn-sm" data-act="del" data-day="${d}" data-id="${e.id}">Delete</button>
        </div>
      </div>
    </div>`).join('') + `</div>`;
}

function addPanel(){
  return `
  <div class="card in">
    <div class="card-title">Snap it or describe it</div>
    <p class="card-note" style="margin:6px 0 14px">
      Photograph the nutrition panel or the plate, and say how much you actually ate — "ate 4/5", "2 serves", "180g".
    </p>
    <div class="row" style="margin-bottom:12px">
      <button class="btn btn-plain grow btn-sm" data-act="cam">${icon('camera',16)} Take photo</button>
      <button class="btn btn-plain grow btn-sm" data-act="lib">From library</button>
    </div>
    ${photos.length ? `<div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">${photos.map((p,i) => `
      <div style="position:relative;width:62px;height:62px;border-radius:12px;overflow:hidden;border:1.5px solid var(--line)">
        <img src="${p.url}" style="width:100%;height:100%;object-fit:cover">
        <button data-act="rmphoto" data-i="${i}" style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:99px;background:rgba(13,14,20,.78);color:#fff;font-size:11px;line-height:1">✕</button>
      </div>`).join('')}</div>` : ''}
    <textarea class="textarea" id="fuel-desc" placeholder='e.g. "ate 4/5 of this serve" or "2 Weet-Bix with full cream milk"'></textarea>
    <div class="chips" style="margin:12px 0 4px">
      ${['Auto','Breakfast','Lunch','Dinner','Snack'].map(m =>
        `<button class="chip ${m===mealSel?'on':''}" data-act="meal" data-v="${m}">${m}</button>`).join('')}
    </div>
    <button class="btn btn-ink block" style="margin-top:14px" data-act="analyse" id="analyse-btn">Analyse & log →</button>
    <div id="fuel-err" class="tiny" style="color:var(--bad);margin-top:10px;display:none"></div>
  </div>`;
}

/* ---------------- history ---------------- */
function historyHTML(){
  const days = Object.keys(store.get().days).filter(d => d !== today()).sort().reverse();
  if (!days.length) return empty(icon('note',34), 'No past days yet.<br>History builds itself as you log.');
  const T = store.get().targets;
  return `<div class="tiny muted" style="margin-bottom:10px">Green dot = protein target hit</div>
  <div class="stack" style="gap:9px">${days.map(d => {
    const t = totals(d);
    const hit = t.p >= T.p;
    return `<button class="rowcard" data-act="openday" data-d="${d}" style="width:100%;text-align:left">
      <span style="width:10px;height:10px;border-radius:99px;flex:none;background:${hit?'var(--good)':'var(--line)'}"></span>
      <div class="grow"><b>${esc(fmtDayShort(d))}</b>
        <span class="sub">${num(t.kcal)} kcal · ${num(t.p)}g protein · ${entries(d).length} items</span></div>
      <span class="caret">›</span>
    </button>`;
  }).join('')}</div>`;
}

/* ---------------- trends ----------------
   A day where you logged a coffee and then forgot isn't a 220 kcal day,
   it's a missing day. Counting it would drag every average down and
   invent a problem that isn't there — so one threshold, used by every
   average on this screen, keeps the numbers consistent with each other. */
const MIN_LOG = 800;
const loggedDays = n => lastNDays(n).filter(d => totals(d).kcal >= MIN_LOG);

function avgOver(n){
  const ds = loggedDays(n);
  if (!ds.length) return null;
  const s = ds.reduce((a,d) => { const t = totals(d); return { kcal:a.kcal+t.kcal, p:a.p+t.p }; }, { kcal:0, p:0 });
  return { kcal: Math.round(s.kcal/ds.length), p: Math.round(s.p/ds.length), n: ds.length };
}
function proteinStreak(){
  const T = store.get().targets;
  let n = 0, d = today();
  if (!entries(d).length || totals(d).p < T.p) d = shiftDay(d,-1);
  while (entries(d).length && totals(d).p >= T.p){ n++; d = shiftDay(d,-1); }
  return n;
}

function trendsHTML(){
  const a7 = avgOver(7), a30 = avgOver(30);
  const T = store.get().targets;
  const logged30 = loggedDays(30);
  const hit = logged30.length ? Math.round(logged30.filter(d => totals(d).p >= T.p).length / logged30.length * 100) : null;
  const f = (v,u) => v === null || v === undefined ? `<span style="color:var(--faint)">—</span>` : `${num(v)}<small> ${u}</small>`;

  const ws = store.get().weights;
  const wKeys = Object.keys(ws).sort();
  const latest = wKeys.length ? ws[wKeys.at(-1)] : null;

  return `
  ${realityCheck()}
  <div class="grid2 in">
    ${stat(f(a7?.kcal,'kcal'), '7-day avg intake')}
    ${stat(f(a7?.p,'g'), '7-day avg protein', 'var(--pro)')}
    ${stat(f(hit,'%'), 'Protein hit rate · 30d', 'var(--carb)')}
    ${stat(f(proteinStreak(),'days'), 'Protein streak', 'var(--fat)')}
    ${stat(f(a30?.kcal,'kcal'), '30-day avg intake')}
    ${stat(f(a30?.p,'g'), '30-day avg protein', 'var(--pro)')}
  </div>

  <div class="card in in-2" style="margin-top:14px">
    <div class="card-title">Last 14 days</div>
    <div class="card-note" style="margin-bottom:12px">Bars are daily calories. Dashed line is your target.</div>
    <canvas id="fuel-chart" style="width:100%;height:180px"></canvas>
    <div class="row tiny muted" style="gap:14px;margin-top:10px;flex-wrap:wrap">
      <span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--accent-1);margin-right:5px"></i>Protein hit</span>
      <span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--line);margin-right:5px"></i>Short</span>
    </div>
  </div>

  <div class="card in in-3" style="margin-top:14px">
    <div class="spread">
      <div class="grow">
        <div class="card-title">Bodyweight</div>
        <div class="card-note">${latest ? `Last logged ${latest}kg` : 'Log it weekly — same time, same conditions.'}</div>
      </div>
      <button class="btn btn-soft btn-sm" data-act="logweight">+ Log</button>
    </div>
    ${wKeys.length >= 2 ? `<canvas id="fuel-weight" style="width:100%;height:120px;margin-top:14px"></canvas>
      <div class="tiny muted center" style="margin-top:8px">
        ${weightTrendNote()}
      </div>` : ''}
  </div>`;
}

/* ---------------- reality check ----------------
   The single most useful thing this app can tell him. It is easy to hit
   a protein target, feel diligent, and still eat under maintenance —
   which is exactly what his first month of logs showed. Averages are
   measured over days he actually logged; part-logged days (a coffee and
   nothing else) would drag the mean down and invent a problem. */
function realityCheck(){
  const days = loggedDays(21);
  const skipped = lastNDays(21).filter(d => entries(d).length && totals(d).kcal < MIN_LOG).length;
  if (days.length < 3) return '';

  const avg = Math.round(days.reduce((n,d) => n + totals(d).kcal, 0) / days.length);
  const avgP = Math.round(days.reduce((n,d) => n + totals(d).p, 0) / days.length);
  const maint = maintenance();
  const target = bulkTarget();
  const vsMaint = avg - maint;

  let tone, title, body;
  if (vsMaint < -150){
    tone = 'bad';
    title = "You're eating below maintenance";
    body = `Averaging ${num(avg)} kcal against an estimated ${num(maint)} maintenance — about
            ${num(-vsMaint)} short every day. You can train perfectly and hit protein, but
            no surplus means no new muscle. This is the reason the build isn't moving.`;
  } else if (vsMaint < 120){
    tone = 'warn';
    title = 'Maintaining, not building';
    body = `Averaging ${num(avg)} kcal against ${num(maint)} maintenance. You're holding your
            weight rather than gaining. Add roughly ${num(target-avg)} a day to get moving.`;
  } else if (avg <= target + 250){
    tone = 'good';
    title = 'Surplus is right where it should be';
    body = `Averaging ${num(avg)} kcal, about ${num(vsMaint)} over maintenance. That's the
            range where the gain is mostly muscle rather than fat.`;
  } else {
    tone = 'warn';
    title = 'Surplus is bigger than it needs to be';
    body = `Averaging ${num(avg)} kcal, ${num(vsMaint)} over maintenance. Past about
            ${num(target - maint + 250)} the extra mostly goes on as fat. Easing back
            ${num(avg-target)} keeps it lean.`;
  }

  const pGap = 158 - avgP;
  const c = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--good)';
  const bg = tone === 'bad' ? 'var(--bad-tint)' : tone === 'warn' ? 'var(--warn-tint)' : 'var(--good-tint)';

  return `
  <div class="card in" style="background:${bg};border-color:transparent;margin-bottom:14px">
    <div class="spread" style="align-items:baseline">
      <div class="card-title" style="color:${c}">${title}</div>
      <span class="tiny" style="color:${c};font-weight:700">${days.length} days</span>
    </div>
    <p class="card-note" style="margin-top:6px;line-height:1.6">${body}</p>
    <div class="hr" style="margin:12px 0"></div>
    <div class="grid3" style="gap:8px">
      <div><div class="tiny muted">Your average</div><b class="mono" style="font-size:15px">${num(avg)}</b></div>
      <div><div class="tiny muted">Maintenance</div><b class="mono" style="font-size:15px">${num(maint)}</b></div>
      <div><div class="tiny muted">Bulk target</div><b class="mono" style="font-size:15px">${num(target)}</b></div>
    </div>
    ${pGap > 12 ? `<div class="tiny" style="margin-top:10px;color:${c}">
      Protein is averaging ${num(avgP)}g against ~158g. Worth closing, but calories are the bigger lever.
    </div>` : ''}
    ${skipped ? `<div class="tiny muted" style="margin-top:8px">
      ${skipped} part-logged day${skipped>1?'s':''} excluded — days with under ${num(MIN_LOG)} kcal aren't counted.
    </div>` : ''}
    ${Math.abs(store.get().targets.kcal - target) > 60 ? `
      <button class="btn btn-sm block" style="margin-top:12px;background:${c};color:#fff"
              data-act="applytarget">Set my target to ${num(target)} kcal</button>` : ''}
  </div>`;
}

function weightTrendNote(){
  const ws = store.get().weights;
  const keys = Object.keys(ws).sort();
  if (keys.length < 2) return '';
  const first = keys[0], last = keys.at(-1);
  const weeks = Math.max(1, (new Date(last) - new Date(first)) / 6048e5);
  const rate = (ws[last] - ws[first]) / weeks;
  // On a lean bulk, ~0.2-0.4kg/wk adds muscle; faster mostly adds fat.
  const verdict = rate < 0.1 ? 'Too slow for a bulk — push calories up.'
                : rate <= 0.45 ? 'Right in the sweet spot for lean gains.'
                : 'Faster than ideal — some of that will be fat.';
  return `${rate >= 0 ? '+' : ''}${round(rate,2)} kg/week · ${verdict}`;
}

function drawTrends(){
  const T = store.get().targets;
  const days = lastNDays(14);
  requestAnimationFrame(() => {
    barChart(document.getElementById('fuel-chart'), {
      values: days.map(d => totals(d).kcal),
      labels: days.map((d,i) => i%2===0 ? d.slice(8)+'/'+d.slice(5,7) : ''),
      target: T.kcal,
      colorFor: (v,i) => {
        const d = days[i];
        if (!totals(d).kcal) return '#EDEFF5';
        return totals(d).p >= T.p ? getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim() : '#DADEE8';
      },
    });

    const ws = store.get().weights;
    const keys = Object.keys(ws).sort();
    if (keys.length >= 2){
      import('../core/ui.js').then(({ lineChart }) => {
        lineChart(document.getElementById('fuel-weight'), {
          values: keys.map(k => ws[k]),
          color: getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
        });
      });
    }
  });
}

/* ---------------- AI: analyse food ---------------- */
function itemsPrompt(desc, meal, hasPhoto){
  return `You are a nutrition estimator for an Australian macro tracker.
User description (may include portion): "${desc || 'none — go by the photo'}"
Meal: ${meal}
Rules:
- If a nutrition label is pictured, read its per-serve values and scale by the portion actually eaten.
- If it's a plate of food, estimate realistic Australian portions.
- If quantity is vague ("a handful", "some"), assume a typical serving and say so in "reasoning".
- Combine into 1-3 logical items maximum.
- In "reasoning", explain HOW you got the numbers (e.g. "Label: 165 kcal/100g x 150g eaten").
- kcal not kJ. If a label shows kJ, convert: kcal = kJ / 4.184.
${hasPhoto ? '' : '- No photo was supplied; estimate from the text alone.'}
Respond with ONLY this JSON, no markdown or preamble:
{"items":[{"name":"short name","kcal":0,"p":0,"c":0,"f":0,"reasoning":"one short sentence"}]}
All numbers integers.`;
}

async function analyse(){
  const descEl = document.getElementById('fuel-desc');
  const desc = clean(descEl?.value || '');
  const err = document.getElementById('fuel-err');
  const btn = document.getElementById('analyse-btn');
  err.style.display = 'none';

  if (!desc && !photos.length){
    err.textContent = 'Add a photo or a description first.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span> Analysing…`;
  const meal = mealSel === 'Auto' ? autoMeal() : mealSel;

  try{
    const res = await ask({
      prompt: itemsPrompt(desc, meal, photos.length > 0),
      images: photos,
      offline: () => {
        const m = offlineMatch(desc);
        return m ? { items: m } : null;
      },
    });
    const items = res.data.items;
    if (!items?.length) throw new Error('No items came back.');
    const src = res.tier === 3 ? 'Offline estimate'
      : photos.length ? 'Photo estimate'
      : looksBranded(desc) ? 'Brand estimate' : 'Text estimate';
    openReview(items, meal, src);
  }catch(e){
    err.textContent = `Couldn't work that out — ${e.message}. Nothing was logged.`;
    err.style.display = 'block';
  }finally{
    btn.disabled = false;
    btn.textContent = 'Analyse & log →';
  }
}

let pending = { items:[], meal:'Snack', source:'' };

function openReview(items, meal, source){
  pending = { items, meal, source };
  openSheet(`
    <h2>Check the numbers</h2>
    <p class="sub">Tweak anything that looks off, then log it.</p>
    ${items.map((it,i) => `
      <div class="card tight sunk" style="margin-bottom:10px">
        <b style="font-size:15px">${esc(it.name)}</b>
        ${it.reasoning ? `<div class="tiny muted" style="margin:8px 0 10px;line-height:1.5">
          <span class="badge accent">${esc(source)}</span><br>${esc(it.reasoning)}</div>` : ''}
        <div class="grid2" style="grid-template-columns:repeat(4,1fr);gap:7px">
          ${[['k','Kcal',it.kcal],['p','P',it.p],['c','C',it.c],['f','F',it.f]].map(([k,l,v]) => `
            <div><div class="label" style="font-size:10px;margin-bottom:4px">${l}</div>
            <input class="input" style="padding:9px 6px;text-align:center;font-weight:700;background:var(--surface)"
                   type="number" inputmode="numeric" id="rv-${k}-${i}" value="${Math.round(v)}"></div>`).join('')}
        </div>
      </div>`).join('')}
    <button class="btn btn-primary block" data-act="save">Log ${items.length>1 ? items.length+' items' : 'it'}</button>
    <button class="btn btn-ghost block" data-act="cancel">Discard</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    save: () => {
      const d = today();
      const days = store.get().days;
      if (!days[d]) days[d] = [];
      pending.items.forEach((it,i) => {
        days[d].push({
          id: uid(), name: it.name, meal: pending.meal,
          kcal: sheetNum(`rv-k-${i}`), p: sheetNum(`rv-p-${i}`),
          c: sheetNum(`rv-c-${i}`), f: sheetNum(`rv-f-${i}`),
          source: pending.source, reasoning: it.reasoning || '',
        });
      });
      store.update();
      photos = []; adding = false;
      closeSheet(); haptic(); toast('Logged ✓'); render();
    },
    cancel: closeSheet,
  });
}

/* ---------------- AI: suggestions ---------------- */
async function suggest(){
  const btn = document.getElementById('suggest-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span> Thinking…`;

  const t = totals(today()), T = store.get().targets;
  const gap = {
    kcal: Math.max(0, T.kcal - t.kcal), p: Math.max(0, T.p - t.p),
    c: Math.max(0, T.c - t.c), f: Math.max(0, T.f - t.f),
  };

  const prompt = `I'm on a lean bulk: ${T.kcal} kcal and ${T.p}g protein daily.
Remaining today: ${gap.kcal} kcal, ${gap.p}g protein, ${gap.c}g carbs, ${gap.f}g fat.
Local time: ${new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}. I'm in Sydney, cook simply, like Greek food and standard gym staples.
Suggest 3 realistic options that fit the remaining macros, prioritising the protein gap. If barely any calories are left, suggest small things.
Respond with ONLY this JSON:
{"suggestions":[{"name":"short name","desc":"one sentence on what and why","kcal":0,"p":0,"c":0,"f":0}]}`;

  try{
    const res = await ask({ prompt, offline: () => ({ suggestions: offlineSuggest(gap) }) });
    const list = res.data.suggestions || [];
    openSheet(`
      <h2>To hit today's goals</h2>
      <p class="sub">Built around the ${num(gap.p)}g of protein you've got left.${res.tier===3 ? ' (offline picks)' : ''}</p>
      ${list.map((s,i) => `
        <div class="card tight sunk" style="margin-bottom:10px">
          <b style="font-size:15px">${esc(s.name)}</b>
          <p class="card-note" style="margin:5px 0 11px">${esc(s.desc)}</p>
          <div class="spread">
            <span class="tiny muted mono">${num(s.kcal)} kcal · P ${num(s.p)} · C ${num(s.c)} · F ${num(s.f)}</span>
            <button class="btn btn-ink btn-sm" data-act="quick" data-i="${i}">Log it</button>
          </div>
        </div>`).join('')}
      <button class="btn btn-ghost block" data-act="close">Close</button>
    `);
    bindActions(document.querySelector('.sheet'), {
      quick: d => {
        const s = list[+d.i];
        const day = today();
        const days = store.get().days;
        if (!days[day]) days[day] = [];
        days[day].push({ id:uid(), name:s.name, meal:autoMeal(), kcal:s.kcal, p:s.p, c:s.c, f:s.f,
                         source:'Suggestion', reasoning:s.desc });
        store.update();
        closeSheet(); haptic(); toast('Logged ✓'); render();
      },
      close: closeSheet,
    });
  }catch(e){
    toast(e.message || 'Could not get suggestions');
  }finally{
    btn.disabled = false;
    btn.innerHTML = icon('spark',17) + ' What should I eat?';
  }
}

/* ---------------- sheets ---------------- */
function openTargets(){
  const T = store.get().targets;
  const P = store.get().profile;
  const ai = aiStatus();
  openSheet(`
    <h2>Targets</h2>
    <p class="sub">A controlled surplus beats a big one. You're already lean — the gap is size, not body fat.</p>

    <div class="card tight sunk" style="margin-bottom:16px">
      <div class="spread">
        <div><div class="tiny muted">Maintenance</div>
          <b class="mono" style="font-size:18px">${num(maintenance())}</b></div>
        <div style="text-align:right"><div class="tiny muted">Suggested bulk</div>
          <b class="mono" style="font-size:18px;color:var(--accent-1)">${num(bulkTarget())}</b></div>
      </div>
      <button class="btn btn-soft btn-sm block" style="margin-top:12px" data-act="auto">Use the suggested numbers</button>
    </div>

    <label class="label">Daily targets</label>
    <div class="grid2">
      ${[['k','Kcal',T.kcal],['p','Protein (g)',T.p],['c','Carbs (g)',T.c],['f','Fat (g)',T.f]].map(([k,l,v]) =>
        `<div><label class="label">${l}</label>
         <input class="input" type="number" inputmode="numeric" id="t-${k}" value="${v}"></div>`).join('')}
    </div>

    <label class="label" style="margin-top:20px">About you — this is what maintenance is calculated from</label>
    <div class="grid3">
      ${[['kg','Weight kg',P.kg],['cm','Height cm',P.cm],['age','Age',P.age]].map(([k,l,v]) =>
        `<div><label class="label" style="font-size:10px">${l}</label>
         <input class="input" type="number" inputmode="numeric" id="p-${k}" value="${v}"></div>`).join('')}
    </div>
    <label class="label" style="margin-top:14px">Activity</label>
    <div class="chips">
      ${ACTIVITY.map(a => `<button class="chip ${Math.abs(P.activity-a.v)<0.01?'on':''}"
        data-act="act" data-v="${a.v}">${a.l}</button>`).join('')}
    </div>
    <div class="tiny muted" style="margin-top:6px">${esc(ACTIVITY.find(a => Math.abs(P.activity-a.v)<0.01)?.d || '')}</div>

    <button class="btn btn-primary block" style="margin-top:20px" data-act="save">Save</button>
    <div class="tiny muted center" style="margin-top:14px">AI: ${esc(ai.label)}</div>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);

  let act = P.activity;
  const persistProfile = () => store.update(s => {
    s.profile = { kg: sheetNum('p-kg', 75), cm: sheetNum('p-cm', 185),
                  age: sheetNum('p-age', 28), activity: act };
  });

  bindActions(document.querySelector('.sheet'), {
    act: (d, el) => {
      act = +d.v;
      el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
      persistProfile();
      // Reopen so the maintenance figure reflects the change immediately.
      openTargets();
    },
    auto: () => {
      persistProfile();
      const kcal = bulkTarget();
      const p = Math.round(store.get().profile.kg * 2.1);
      const f = Math.round(kcal * 0.28 / 9);              // ~28% of calories from fat
      const c = Math.round((kcal - p*4 - f*9) / 4);       // carbs fill the rest
      store.update(s => { s.targets = { kcal, p, c, f }; });
      closeSheet(); toast('Targets updated'); render();
    },
    save: () => {
      persistProfile();
      store.update(s => {
        s.targets = {
          kcal: sheetNum('t-k', 2800), p: sheetNum('t-p', 150),
          c: sheetNum('t-c', 340), f: sheetNum('t-f', 90),
        };
      });
      closeSheet(); toast('Saved'); render();
    },
    close: closeSheet,
  });
}

function openWeight(){
  const ws = store.get().weights;
  openSheet(`
    <h2>Log bodyweight</h2>
    <p class="sub">Weigh in the morning, after the toilet, before food — same conditions each time.</p>
    <label class="label">Weight (kg)</label>
    <input class="input" type="number" inputmode="decimal" step="0.1" id="w-kg" value="${ws[today()] ?? ''}" placeholder="75.0">
    <button class="btn btn-primary block" data-act="save">Save</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    save: () => {
      const kg = sheetNum('w-kg', 0);
      if (kg <= 0){ toast('Enter a weight'); return; }
      store.update(s => { s.weights[today()] = kg; });
      closeSheet(); toast('Logged ✓'); render();
    },
    close: closeSheet,
  });
}

/* ---------------- events ---------------- */
async function pickPhotos(which){
  const inp = document.getElementById(which === 'cam' ? 'file-cam' : 'file-lib');
  inp.value = '';
  inp.onchange = async () => {
    for (const f of [...inp.files]){
      try{ photos.push(await fileToImage(f)); }
      catch(e){ toast(e.message); }
    }
    render();
  };
  inp.click();
}

function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; viewDay = null; render(); },
    back: () => { viewDay = null; render(); },
    openday: d => { viewDay = d.d; render(); },
    targets: openTargets,
    logweight: openWeight,
    applytarget: () => {
      const kcal = bulkTarget();
      const p = Math.round(store.get().profile.kg * 2.1);
      const f = Math.round(kcal * 0.28 / 9);
      const c = Math.round((kcal - p*4 - f*9) / 4);
      store.update(s => { s.targets = { kcal, p, c, f }; });
      haptic(); toast(`Target set to ${num(kcal)} kcal`); render();
    },
    showlog: () => { adding = false; render(); },
    showadd: () => { adding = true; render(); setTimeout(() => document.getElementById('fuel-desc')?.focus(), 80); },
    meal: d => { mealSel = d.v; render(); },
    cam: () => pickPhotos('cam'),
    lib: () => pickPhotos('lib'),
    rmphoto: d => { photos.splice(+d.i, 1); render(); },
    analyse,
    suggest,
    toggle: d => {
      const el = document.getElementById('d-' + d.id);
      if (el) el.hidden = !el.hidden;
    },
    del: d => {
      store.update(s => {
        s.days[d.day] = (s.days[d.day]||[]).filter(e => e.id !== d.id);
        if (!s.days[d.day].length) delete s.days[d.day];
      });
      haptic(); render();
    },
  });
}
