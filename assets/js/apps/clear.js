/* ============================================================
   Clear — nicotine taper.

   Ported from the original Zyn tracker, keeping the model that was
   already working: a daily mg budget that steps down a fixed percentage
   each week. Percentage rather than a flat amount, because the last
   few milligrams are the hardest and a flat step makes the end brutal.

   You've already done the hard part — vapes are gone. This is about
   walking the pouches down without white-knuckling it.
   ============================================================ */

import { Slice, today, dayKey, keyToDate, daysBetween, shiftDay, lastNDays, uid, fmtTime, fmtDayShort } from '../core/store.js';
import {
  esc, num, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic, barChart,
} from '../core/ui.js';

const store = new Slice('clear', {
  logs: [],                      // { id, t, mg, tag, reused }
  strengths: [6, 9, 11, 17],
  defaultMg: 9,
  packetSize: 20,                // pouches in a packet
  added17: false,                // see ensureStrengths()
  baseBudget: 60,                // mg/day at plan start
  weeklyDrop: 0.10,              // 10% down each week
  floor: 0,
  planStart: today(),
});

const TAGS = ['waking','coffee','after food','work','driving','stress','boredom','social','drinking','wind-down'];

let tab = 'today';
let root = null;
let tickTimer = null;

/* Defaults only apply to a fresh install — an existing `strengths` array
   survives the merge in Slice.load(), so adding 17mg to the defaults
   alone would never reach a phone that already has the app. Do it once,
   and record that it happened so removing 17mg later actually sticks. */
function ensureStrengths(){
  const s = store.get();
  if (s.added17) return;
  store.update(st => {
    if (!st.strengths.includes(17)) st.strengths = [...st.strengths, 17].sort((a,b) => a-b);
    st.added17 = true;
  });
}

/* The first version of pack tracking assumed one packet in use at a
   time and counted whole tins. That was the wrong model — several
   packets live in different places at once — so it became per-pouch
   fresh/reused instead. Carry the old setting across and drop the
   now-meaningless tin markers. */
function migratePackets(){
  const s = store.get();
  if (s.packetSize !== undefined && !s.logs.some(l => 'newTin' in l)) return;
  store.update(st => {
    if (st.packetSize === undefined) st.packetSize = st.tinSize ?? 20;
    delete st.tinSize;
    st.logs.forEach(l => { delete l.newTin; });
  });
}

/* ---------------- taper maths ---------------- */
function budgetFor(day){
  const s = store.get();
  const weeks = Math.max(0, Math.floor(daysBetween(s.planStart, day) / 7));
  const raw = s.baseBudget * Math.pow(1 - s.weeklyDrop, weeks);
  return Math.max(s.floor, Math.round(raw));
}

const logsOn = day => store.get().logs.filter(l => dayKey(l.t) === day);

/* Reusing a pouch delivers no NEW nicotine — you're finishing the mg you
   already counted when you first took it out. So only fresh pouches add
   to the daily total, otherwise a habit that reduces consumption would
   show up as an increase. */
const mgOn = day => logsOn(day).filter(l => !l.reused).reduce((n,l) => n + l.mg, 0);
const lastLog = () => [...store.get().logs].sort((a,b) => a.t - b.t).at(-1);

function gapText(){
  const l = lastLog();
  if (!l) return null;
  // Clamp: a clock change or an edited entry can put the last log
  // slightly ahead of now, and "-107m ago" reads as a bug.
  const mins = Math.max(0, Math.floor((Date.now() - l.t) / 60000));
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

/* ---------------- pouch consumption ----------------
   A log entry is a SESSION, not necessarily a new pouch. Taking one out
   and putting it back for later is one pouch across two sessions, so
   only entries marked fresh count as physical consumption.

   Packets aren't tracked individually — several are open in different
   places at once, so a sequential "current packet" would be fiction.
   Packets are derived from pouches instead, which is honest and needs
   no extra input. */

const isFresh = l => !l.reused;

/** Sessions and pouches over the last n days, plus the derived rates. */
function useStats(n = 30){
  const cutoff = keyToDate(shiftDay(today(), -(n-1))).getTime();
  const logs = store.get().logs.filter(l => l.t >= cutoff);
  const sessions = logs.length;
  const pouches = logs.filter(isFresh).length;
  const reused = sessions - pouches;

  const activeDays = new Set(logs.map(l => dayKey(l.t))).size;
  const size = store.get().packetSize || 20;

  return {
    sessions, pouches, reused, activeDays, size,
    perSession: pouches ? Math.round(sessions / pouches * 100) / 100 : null,
    reusePct:   sessions ? Math.round(reused / sessions * 100) : 0,
    perDay:     activeDays ? Math.round(pouches / activeDays * 10) / 10 : null,
    packetsPerWeek: activeDays
      ? Math.round((pouches / activeDays) * 7 / size * 100) / 100
      : null,
    packetDays: (activeDays && pouches)
      ? Math.round(size / (pouches / activeDays) * 10) / 10
      : null,
  };
}

const todayPouches = () => logsOn(today()).filter(isFresh).length;

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
  ensureStrengths();
  migratePackets();
  const t = today();
  const used = mgOn(t), b = budgetFor(t);
  return {
    headline: `${num(used)} / ${num(b)} mg`,
    detail: `${todayPouches()} pouch${todayPouches()===1?'':'es'} today · week ${weeksIn()} of the taper`,
    badge: used > b ? 'Over' : `${num(Math.max(0,b-used))} left`,
  };
}

/* ---------------- mount ---------------- */
export async function mount(el){
  root = el;
  await store.load();
  ensureStrengths();
  migratePackets();
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

  <div class="seg sticky" style="margin:16px 0">
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
    ${ls.length ? `<div class="hero-cap" style="margin-top:4px;opacity:.8">
      ${todayPouches()} fresh pouch${todayPouches()===1?'':'es'}${ls.length - todayPouches() > 0
        ? ` · ${ls.length - todayPouches()} reused` : ''}
    </div>` : ''}
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
      <div class="rowcard" ${l.reused ? 'style="opacity:.82"' : ''}>
        <div class="grow">
          <b>${l.mg}mg</b>
          <span class="sub">${esc(fmtTime(l.t))} · ${l.reused ? '♻️ same pouch again' : 'fresh pouch'}${l.tag ? ' · ' + esc(l.tag) : ''}</span>
        </div>
        <button class="btn btn-sm ${l.reused ? 'btn-soft' : 'btn-plain'}" data-act="reuse" data-id="${l.id}"
                title="${l.reused ? 'Mark as a fresh pouch' : 'Mark as reusing an earlier pouch'}">♻️</button>
        <button class="btn btn-sm btn-plain" data-act="tag" data-id="${l.id}">${l.tag ? 'Retag' : 'Tag'}</button>
        <button class="btn btn-sm" style="color:var(--faint);padding:6px 8px" data-act="rm" data-id="${l.id}">✕</button>
      </div>`).join('')}
    <div class="tiny muted" style="margin-top:4px">
      Tap ♻️ when you're picking a pouch back up rather than opening a new one — only fresh ones
      count toward how many you actually get through.
    </div></div>`}`;
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

  ${tinStatsHTML()}

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

/* What you actually get through, as opposed to how often you reach for
   one. "Two packets a week" is a more concrete lever than "38mg a day". */
function tinStatsHTML(){
  const st = useStats(30);
  if (!st.sessions){
    return `<div class="card in in-3" style="margin-top:14px">
      <div class="card-title">📦 Pouches used</div>
      <div class="card-note" style="margin-top:5px">
        Log a few and this fills in — pouches actually used, how often you reuse one, and how many
        packets a week that works out to.
      </div>
    </div>`;
  }
  return `
  <div class="card in in-3" style="margin-top:14px">
    <div class="card-title">📦 Pouches used</div>
    <div class="card-note" style="margin:4px 0 14px">Last 30 days. Only fresh pouches count — reuses aren't new ones.</div>
    <div class="grid2" style="gap:10px">
      ${stat(num(st.pouches), 'Pouches used', 'var(--accent-1)')}
      ${stat(num(st.sessions), 'Times used')}
      ${stat(st.perDay !== null ? st.perDay : '—', 'Pouches per day')}
      ${stat(st.packetsPerWeek !== null ? st.packetsPerWeek + '<small>/wk</small>' : '—', 'Packets per week')}
    </div>
    ${st.reused ? `<div class="tiny" style="margin-top:12px;color:var(--accent-1);line-height:1.55">
      You reused a pouch ${st.reused} time${st.reused===1?'':'s'} — ${st.reusePct}% of the time,
      about ${st.perSession} sessions per pouch. That's ${st.reused} pouch${st.reused===1?'':'es'} you didn't open.
    </div>` : `<div class="tiny muted" style="margin-top:12px;line-height:1.55">
      No reuses logged yet. Tap ♻️ on a log entry when you pick an earlier pouch back up.
    </div>`}
    ${st.packetDays !== null ? `<div class="tiny muted" style="margin-top:8px;line-height:1.55">
      A ${st.size}-pouch packet lasts you about ${st.packetDays} days — roughly
      ${Math.round(st.packetsPerWeek * 52)} packets a year at this rate.
    </div>` : ''}
  </div>`;
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

    <label class="label" style="margin-top:16px">Pouches per packet</label>
    <input class="input" type="number" inputmode="numeric" id="p-tin" value="${s.packetSize}">
    <div class="tiny muted" style="margin-top:6px">Most ZYN packets hold 20. Only used to convert pouches into packets per week.</div>

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
        st.packetSize = Math.max(1, sheetNum('p-tin', 20));
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
    reuse: d => {
      let on = false;
      store.update(s => {
        const l = s.logs.find(x => x.id === d.id);
        if (l){ l.reused = !l.reused; on = !!l.reused; }
      });
      haptic();
      toast(on ? "Reused — doesn't add to today's mg ♻️" : 'Marked as a fresh pouch');
      render();
    },
    rm: d => {
      store.update(s => { s.logs = s.logs.filter(l => l.id !== d.id); });
      render();
    },
    plan: openPlan,
  });
}
