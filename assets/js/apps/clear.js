/* ============================================================
   Clear — nicotine taper.

   Ported from the original Zyn tracker, keeping the model that was
   already working: a daily mg budget that steps down a fixed percentage
   each week. Percentage rather than a flat amount, because the last
   few milligrams are the hardest and a flat step makes the end brutal.

   You've already done the hard part — vapes are gone. This is about
   walking the pouches down without white-knuckling it.
   ============================================================ */

import { Slice, today, dayKey, keyToDate, daysBetween, lastNDays, uid, fmtTime, fmtDayShort } from '../core/store.js';
import {
  esc, num, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic, barChart,
} from '../core/ui.js';

const store = new Slice('clear', {
  logs: [],                      // { id, t, mg, tag }
  strengths: [6, 9, 11],
  defaultMg: 9,
  baseBudget: 60,                // mg/day at plan start
  weeklyDrop: 0.10,              // 10% down each week
  floor: 0,
  planStart: today(),
});

const TAGS = ['waking','coffee','after food','work','driving','stress','boredom','social','drinking','wind-down'];

let tab = 'today';
let root = null;
let tickTimer = null;

/* ---------------- taper maths ---------------- */
function budgetFor(day){
  const s = store.get();
  const weeks = Math.max(0, Math.floor(daysBetween(s.planStart, day) / 7));
  const raw = s.baseBudget * Math.pow(1 - s.weeklyDrop, weeks);
  return Math.max(s.floor, Math.round(raw));
}

const logsOn = day => store.get().logs.filter(l => dayKey(l.t) === day);
const mgOn = day => logsOn(day).reduce((n,l) => n + l.mg, 0);
const lastLog = () => [...store.get().logs].sort((a,b) => a.t - b.t).at(-1);

function gapText(){
  const l = lastLog();
  if (!l) return null;
  const mins = Math.floor((Date.now() - l.t) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}

function streakUnder(){
  let n = 0, d = today();
  // Today only counts if it's already under; otherwise start yesterday.
  if (mgOn(d) > budgetFor(d)) return 0;
  while (logsOn(d).length && mgOn(d) <= budgetFor(d)){
    n++;
    d = dayKey(new Date(keyToDate(d).getTime() - 86400000));
  }
  return n;
}

const weeksIn = () => Math.floor(daysBetween(store.get().planStart, today()) / 7) + 1;

/* Projected date the budget reaches zero (or the floor). */
function quitDate(){
  const s = store.get();
  if (s.weeklyDrop <= 0) return null;
  // budget < 1mg is functionally done
  const weeks = Math.ceil(Math.log(1 / s.baseBudget) / Math.log(1 - s.weeklyDrop));
  if (!Number.isFinite(weeks) || weeks < 0) return null;
  const d = keyToDate(s.planStart);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  const t = today();
  const used = mgOn(t), b = budgetFor(t);
  return {
    headline: `${num(used)} / ${num(b)} mg`,
    detail: `${logsOn(t).length} pouches today · week ${weeksIn()} of the taper`,
    badge: used > b ? 'Over' : `${num(Math.max(0,b-used))} left`,
  };
}

/* ---------------- mount ---------------- */
export async function mount(el){
  root = el;
  await store.load();
  render();
  clearInterval(tickTimer);
  // The "since last pouch" clock is the most motivating number here,
  // so keep it live rather than frozen at render time.
  tickTimer = setInterval(() => {
    const el2 = document.getElementById('clear-gap');
    if (el2) el2.textContent = gapText() || '—';
    else clearInterval(tickTimer);
  }, 30000);
}

function render(){
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Nicotine · Clear</div>
        <h1 class="page-h1">${tab==='today' ? 'Today' : tab==='trend' ? 'Progress' : 'Plan'}</h1>
      </div>
      <button class="chip" data-act="plan">⚙</button>
    </div>
  </header>

  <div class="seg" style="margin:16px 0">
    ${[['today','Today'],['trend','Progress'],['why','Plan']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='today' ? todayHTML() : tab==='trend' ? trendHTML() : planHTML()}`;

  if (tab === 'trend') drawTrend();
  bind();
}

/* ---------------- today ---------------- */
function todayHTML(){
  const t = today();
  const used = mgOn(t), b = budgetFor(t);
  const p = b > 0 ? Math.min(100, used/b*100) : 100;
  const ls = [...logsOn(t)].sort((a,b2) => b2.t - a.t);
  const s = store.get();

  return `
  <div class="hero in" ${used > b ? 'style="--accent-grad:linear-gradient(118deg,#D97706 6%,#DC2626 94%)"' : ''}>
    <div class="spread" style="align-items:flex-start">
      <div><div class="hero-num">${num(used)}<span style="font-size:24px">mg</span></div>
        <div class="hero-cap">of ${num(b)}mg today</div></div>
      <div><div class="hero-side">${ls.length}</div>
        <div class="hero-cap" style="text-align:right">pouches</div></div>
    </div>
    <div class="bar"><i style="width:${p}%"></i></div>
    <div class="hero-cap" style="margin-top:10px">
      ${used > b ? `${num(used-b)}mg over — tomorrow resets` : `${num(b-used)}mg left`}
      · last one <b id="clear-gap">${gapText() || '—'}</b> ago
    </div>
  </div>

  <div class="sec">Log one</div>
  <div class="chips in">
    ${s.strengths.map(mg => `<button class="chip" data-act="log" data-mg="${mg}"
      style="font-size:16px;font-weight:700;padding:14px 22px">${mg}mg</button>`).join('')}
    <button class="chip" data-act="custom" style="padding:14px 18px">Other…</button>
  </div>

  <div class="sec">Today's log</div>
  ${!ls.length ? empty('🌱','Nothing yet today.<br>Every hour you delay the first one makes the rest easier.') :
    `<div class="stack" style="gap:8px">${ls.map(l => `
      <div class="rowcard">
        <div class="grow">
          <b>${l.mg}mg</b>
          <span class="sub">${esc(fmtTime(l.t))}${l.tag ? ' · ' + esc(l.tag) : ''}</span>
        </div>
        <button class="btn btn-sm btn-plain" data-act="tag" data-id="${l.id}">${l.tag ? 'Retag' : 'Tag'}</button>
        <button class="btn btn-sm" style="color:var(--faint);padding:6px 8px" data-act="rm" data-id="${l.id}">✕</button>
      </div>`).join('')}</div>`}`;
}

/* ---------------- progress ---------------- */
function trendHTML(){
  const days = lastNDays(21).filter(d => logsOn(d).length || d >= store.get().planStart);
  const logged = lastNDays(30).filter(d => logsOn(d).length);
  const avg7 = (() => {
    const ds = lastNDays(7).filter(d => logsOn(d).length);
    return ds.length ? Math.round(ds.reduce((n,d) => n + mgOn(d), 0) / ds.length) : null;
  })();
  const first = store.get().logs.length
    ? Math.round(mgOn(dayKey(Math.min(...store.get().logs.map(l => l.t))))) : null;
  const qd = quitDate();

  // Which situations actually drive use — the useful bit of tagging.
  const tagCounts = {};
  store.get().logs.filter(l => l.tag).forEach(l => { tagCounts[l.tag] = (tagCounts[l.tag]||0) + 1; });
  const topTags = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,5);

  return `
  <div class="grid2 in">
    ${stat(avg7 !== null ? num(avg7)+'<small>mg</small>' : '—', '7-day average')}
    ${stat(num(budgetFor(today()))+'<small>mg</small>', "Today's budget", 'var(--accent-1)')}
    ${stat(num(streakUnder())+'<small> days</small>', 'Under budget streak', 'var(--good)')}
    ${stat(num(weeksIn()), 'Week of taper')}
  </div>

  <div class="card in in-2" style="margin-top:14px">
    <div class="card-title">Last 3 weeks</div>
    <div class="card-note" style="margin-bottom:12px">Bars are daily mg. The dashed line is today's budget.</div>
    <canvas id="clear-chart" style="width:100%;height:170px"></canvas>
  </div>

  ${qd ? `<div class="card in in-3" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
    <div class="card-title">On track to be done</div>
    <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:24px;margin-top:6px">
      ${esc(qd.toLocaleDateString('en-AU',{ month:'long', year:'numeric' }))}
    </div>
    <div class="card-note" style="margin-top:4px">
      At ${Math.round(store.get().weeklyDrop*100)}% down a week from ${store.get().baseBudget}mg. Not a deadline — a direction.
    </div>
  </div>` : ''}

  ${topTags.length ? `
  <div class="card in" style="margin-top:14px">
    <div class="card-title">When you reach for one</div>
    <div class="card-note" style="margin:4px 0 12px">The pattern matters more than the count — these are the moments to plan around.</div>
    ${topTags.map(([t,n]) => {
      const max = topTags[0][1];
      return `<div style="margin-bottom:10px">
        <div class="spread" style="margin-bottom:5px">
          <span style="font-size:14px;font-weight:600">${esc(t)}</span>
          <span class="tiny muted mono">${n}</span>
        </div>
        <div class="meter-track" style="background:var(--bg-sunk)">
          <div class="meter-fill" style="width:${n/max*100}%;background:var(--accent-1)"></div>
        </div>
      </div>`;
    }).join('')}
  </div>` : ''}`;
}

function drawTrend(){
  const days = lastNDays(21);
  const b = budgetFor(today());
  requestAnimationFrame(() => {
    barChart(document.getElementById('clear-chart'), {
      values: days.map(d => mgOn(d)),
      labels: days.map((d,i) => i%4===0 ? d.slice(8) : ''),
      target: b,
      colorFor: (v,i) => {
        if (!v) return '#EDEFF5';
        return v <= budgetFor(days[i])
          ? getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim()
          : '#F0A868';
      },
    });
  });
}

/* ---------------- plan ---------------- */
function planHTML(){
  const s = store.get();
  return `
  <div class="card in">
    <div class="card-title">How the taper works</div>
    <p class="card-note" style="margin-top:8px;line-height:1.65">
      Your daily budget drops <b>${Math.round(s.weeklyDrop*100)}%</b> every week, starting from
      <b>${s.baseBudget}mg</b>. A percentage rather than a fixed amount, so the steps get gentler as the
      numbers get smaller — the last few milligrams are the hardest and deserve the most room.
    </p>
    <div class="hr"></div>
    <div class="tiny muted" style="line-height:1.7">
      Going over on a given day isn't failure — the budget resets tomorrow and the trend is what counts.
      Tag your pouches for a week or two and the pattern behind them becomes obvious, which is
      what actually lets you plan around the hard moments.
    </div>
  </div>

  <div class="sec">The next few weeks</div>
  <div class="card in">
    ${Array.from({length:8}, (_,i) => {
      const d = new Date(keyToDate(s.planStart)); d.setDate(d.getDate() + i*7);
      const wk = i + 1;
      const isNow = wk === weeksIn();
      return `<div class="spread" style="padding:10px 0;${i<7?'border-bottom:1px solid var(--line-soft)':''}">
        <span style="font-size:14px;${isNow?'font-weight:700;color:var(--accent-1)':''}">
          Week ${wk}${isNow ? ' · now' : ''}</span>
        <span class="mono" style="font-size:14.5px;${isNow?'font-weight:700;color:var(--accent-1)':''}">
          ${num(Math.max(s.floor, Math.round(s.baseBudget * Math.pow(1-s.weeklyDrop, i))))}mg/day</span>
      </div>`;
    }).join('')}
  </div>

  <button class="btn btn-plain block" style="margin-top:16px" data-act="plan">Adjust the plan</button>`;
}

/* ---------------- actions ---------------- */
function logPouch(mg){
  store.update(s => {
    s.logs.push({ id:uid(), t:Date.now(), mg, tag:null });
    if (!s.strengths.includes(mg)) s.strengths = [...s.strengths, mg].sort((a,b) => a-b);
  });
  haptic();
  const t = today();
  const over = mgOn(t) > budgetFor(t);
  toast(over ? `${mg}mg logged — over budget now` : `${mg}mg logged ✓`);
  render();
}

function openTag(id){
  const l = store.get().logs.find(x => x.id === id);
  if (!l) return;
  openSheet(`
    <h2>What prompted it?</h2>
    <p class="sub">Two weeks of this and the pattern gets obvious.</p>
    <div class="chips">
      ${TAGS.map(t => `<button class="chip ${l.tag===t?'on':''}" data-act="pick" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>
    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    pick: d => {
      store.update(s => {
        const x = s.logs.find(y => y.id === id);
        x.tag = x.tag === d.t ? null : d.t;
      });
      closeSheet(); render();
    },
    close: closeSheet,
  });
}

function openCustom(){
  openSheet(`
    <h2>Other strength</h2>
    <p class="sub">It'll be added to your quick buttons.</p>
    <label class="label">Milligrams</label>
    <input class="input" type="number" inputmode="decimal" step="0.5" id="c-mg" placeholder="e.g. 14"
           style="font-size:22px;font-weight:700;text-align:center;padding:16px">
    <button class="btn btn-primary block" style="margin-top:16px" data-act="save">Log it</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  setTimeout(() => document.getElementById('c-mg')?.focus(), 120);
  bindActions(document.querySelector('.sheet'), {
    save: () => {
      const mg = sheetNum('c-mg', 0);
      if (mg <= 0){ toast('How many mg?'); return; }
      closeSheet(); logPouch(mg);
    },
    close: closeSheet,
  });
}

function openPlan(){
  const s = store.get();
  openSheet(`
    <h2>Taper plan</h2>
    <p class="sub">Set it once. Aggressive plans get abandoned — pick something you'd bet on.</p>

    <label class="label">Starting daily budget (mg)</label>
    <input class="input" type="number" inputmode="numeric" id="p-base" value="${s.baseBudget}">
    <div class="tiny muted" style="margin-top:6px">Set this to roughly what you use now, not what you wish you used.</div>

    <label class="label" style="margin-top:16px">Weekly reduction</label>
    <div class="chips">
      ${[0.05,0.10,0.15,0.20].map(v => `<button class="chip ${Math.abs(s.weeklyDrop-v)<0.001?'on':''}"
        data-act="drop" data-v="${v}">${Math.round(v*100)}%</button>`).join('')}
    </div>
    <div class="tiny muted" style="margin-top:8px">10% a week is the sweet spot — noticeable but sustainable.</div>

    <label class="label" style="margin-top:16px">Plan started</label>
    <input class="input" type="date" id="p-start" value="${s.planStart}" max="${today()}">

    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">Save plan</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  let drop = s.weeklyDrop;
  bindActions(document.querySelector('.sheet'), {
    drop: (d, el) => {
      drop = +d.v;
      el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    },
    save: () => {
      store.update(st => {
        st.baseBudget = sheetNum('p-base', 60);
        st.weeklyDrop = drop;
        st.planStart = sheetVal('p-start') || today();
      });
      closeSheet(); toast('Plan saved'); render();
    },
    close: closeSheet,
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    log: d => logPouch(+d.mg),
    custom: openCustom,
    tag: d => openTag(d.id),
    rm: d => {
      store.update(s => { s.logs = s.logs.filter(l => l.id !== d.id); });
      render();
    },
    plan: openPlan,
  });
}
