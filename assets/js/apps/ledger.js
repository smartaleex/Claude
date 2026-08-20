/* ============================================================
   Ledger — money, and specifically: can I buy this place?

   Two halves.
   1. Ordinary budget tracking: income, recurring costs, spending.
   2. A property scenario modeller, because "what does the mortgage
      plus strata actually do to my month" is the live question.

   All calculations are local and deterministic — this is arithmetic,
   not a job for a language model. AI is used only to talk through a
   scenario once the numbers already exist.
   ============================================================ */

import { Slice, today, dayKey, uid, fmtDayShort, lastNDays } from '../core/store.js';
import { ask } from '../core/ai.js';
import {
  esc, num, money, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic, barChart,
} from '../core/ui.js';

const store = new Slice('ledger', {
  income: { amount: 0, freq: 'month' },
  recurring: [],     // { id, name, amount, freq, kind:'need'|'want'|'save' }
  spends: [],        // { id, day, amount, cat, note }
  savings: 0,
  scenarios: [],     // saved property scenarios
  cats: ['Groceries','Eating out','Transport','Gym','Social','Shopping','Health','Other'],
});

let tab = 'now';
let root = null;

/* ---------------- money maths ----------------
   Weekly to monthly is 52/12 (4.333), NOT x4. A year has 52 weeks, not
   48, so $400/week is $1,733/month rather than $1,600 — budget the
   naive figure and you're $1,600 short by December, because four months
   a year contain five pay weeks. Same reasoning for fortnightly. */
const PER_MONTH = { week: 52/12, fortnight: 26/12, month: 1, year: 1/12 };
const toMonthly = (amt, freq) => amt * (PER_MONTH[freq] ?? 1);

/** Human-readable working, so the conversion doesn't look like a bug. */
const conversionNote = (amt, freq) => {
  if (freq === 'month') return '';
  if (freq === 'week')      return `${money(amt)} × 52 ÷ 12`;
  if (freq === 'fortnight') return `${money(amt)} × 26 ÷ 12`;
  if (freq === 'year')      return `${money(amt)} ÷ 12`;
  return '';
};

const monthlyIncome = () => toMonthly(store.get().income.amount, store.get().income.freq);
const monthlyFixed = () => store.get().recurring.reduce((n,r) => n + toMonthly(r.amount, r.freq), 0);

const thisMonthKey = () => today().slice(0,7);
const spendThisMonth = () => store.get().spends
  .filter(s => s.day.startsWith(thisMonthKey()))
  .reduce((n,s) => n + s.amount, 0);

const freeCash = () => monthlyIncome() - monthlyFixed();
const leftThisMonth = () => freeCash() - spendThisMonth();

/* ---------------- mortgage maths ----------------
   Standard amortisation. r is the MONTHLY rate. */
export function monthlyRepayment(principal, annualRatePct, years){
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

/** NSW transfer duty, residential, current general rates. Approximate —
    it moves with policy, and first-home concessions can wipe it out. */
export function stampDutyNSW(price){
  const bands = [
    [17000,    0,      1.25],
    [36000,    212,    1.50],
    [97000,    497,    1.75],
    [364000,   1564,   3.50],
    [1212000,  10909,  4.50],
    [3636000,  49027,  5.50],
    [Infinity, 182390, 7.00],
  ];
  for (let i = 0; i < bands.length; i++){
    if (price <= bands[i][0]){
      const lower = i === 0 ? 0 : bands[i-1][0];
      return bands[i][1] + (price - lower) * bands[i][2] / 100;
    }
  }
  return price * 0.07;
}

export function modelScenario(sc){
  const deposit  = sc.deposit || 0;
  const price    = sc.price || 0;
  const loan     = Math.max(0, price - deposit);
  const lvr      = price > 0 ? loan / price * 100 : 0;
  const duty     = sc.firstHome ? 0 : stampDutyNSW(price);
  // LMI is charged above 80% LVR; ~2% of the loan is a realistic ballpark.
  const lmi      = lvr > 80 ? loan * 0.02 : 0;
  const upfront  = deposit + duty + lmi + (sc.otherCosts || 0);

  const repay    = monthlyRepayment(loan, sc.rate ?? 6.0, sc.years ?? 30);
  // Strata is quoted quarterly by default in NSW; normalise to monthly.
  const strataM  = (sc.strata || 0) * (sc.strataFreq === 'year' ? 1/12 : sc.strataFreq === 'month' ? 1 : 1/3);
  const councilM = (sc.council || 0) / 12;
  const insureM  = (sc.insurance || 0) / 12;
  const housing  = repay + strataM + councilM + insureM;

  const income   = monthlyIncome();
  const fixedNow = monthlyFixed();
  const afterAll = income - fixedNow - housing;
  const ratio    = income > 0 ? housing / income * 100 : 0;

  // A +3% buffer is roughly what APRA requires lenders to test against.
  const stressRepay = monthlyRepayment(loan, (sc.rate ?? 6.0) + 3, sc.years ?? 30);
  const stressLeft  = income - fixedNow - (stressRepay + strataM + councilM + insureM);

  return {
    loan, lvr, duty, lmi, upfront, repay, strataM, councilM, insureM,
    housing, afterAll, ratio, stressRepay, stressLeft,
    verdict: ratio > 45 ? 'stretched' : ratio > 33 ? 'tight' : 'comfortable',
  };
}

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  const s = store.get();
  if (!s.income.amount) return { headline:'Not set up', detail:'Add your income to get started' };
  const left = leftThisMonth();
  return {
    headline: money(left) + ' left',
    detail: `${money(spendThisMonth())} spent this month · ${money(monthlyFixed())} fixed`,
    badge: left < 0 ? 'Over' : null,
  };
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
        <div class="eyebrow">Money · Ledger</div>
        <h1 class="page-h1">${tab==='now' ? 'This month' : tab==='fixed' ? 'Fixed costs' : 'The house'}</h1>
      </div>
      <button class="chip" data-act="income">⚙</button>
    </div>
  </header>

  <div class="seg" style="margin:16px 0">
    ${[['now','Month'],['fixed','Fixed'],['house','House']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='now' ? nowHTML() : tab==='fixed' ? fixedHTML() : houseHTML()}`;

  if (tab === 'now') drawSpend();
  bind();
}

/* ---------------- month view ---------------- */
function nowHTML(){
  const s = store.get();
  if (!s.income.amount){
    return `<div class="card in">
      <div class="card-title">Start here</div>
      <p class="card-note" style="margin:8px 0 14px">
        Add what you earn and what goes out automatically. Everything else builds on those two numbers.
      </p>
      <button class="btn btn-primary block" data-act="income">Add your income</button>
    </div>`;
  }

  const inc = monthlyIncome(), fixed = monthlyFixed();
  const spent = spendThisMonth(), free = freeCash(), left = leftThisMonth();
  const p = free > 0 ? Math.min(100, spent/free*100) : 100;

  const now = new Date();
  const daysIn = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const dayOf = now.getDate();
  const pace = spent / dayOf * daysIn;

  return `
  <div class="hero in">
    <div class="spread" style="align-items:flex-start">
      <div><div class="hero-num">${money(Math.max(0,left))}</div>
        <div class="hero-cap">left of ${money(free)} spending money</div></div>
      <div><div class="hero-side">${Math.round(p)}%</div>
        <div class="hero-cap" style="text-align:right">used</div></div>
    </div>
    <div class="bar"><i style="width:${p}%"></i></div>
  </div>

  <button class="btn btn-primary block in in-2" style="margin-top:14px" data-act="addspend">+ Log a spend</button>

  <div class="grid2 in in-2" style="margin-top:14px">
    ${stat(money(inc), 'Income / month')}
    ${stat(money(fixed), 'Fixed costs')}
    ${stat(money(spent), 'Spent so far')}
    ${stat(money(pace), 'On pace for', pace > free ? 'var(--bad)' : 'var(--good)')}
  </div>

  ${pace > free && free > 0 ? `
  <div class="card in in-3" style="margin-top:14px;background:var(--warn-tint);border-color:transparent">
    <div class="card-title" style="color:var(--warn)">Running hot</div>
    <div class="card-note" style="margin-top:4px">
      At this rate you'll finish ${money(pace-free)} over. That's ${money((pace-free)/(daysIn-dayOf||1))} a day to claw back.
    </div>
  </div>` : ''}

  <div class="card in in-3" style="margin-top:14px">
    <div class="card-title">Last 14 days</div>
    <canvas id="led-chart" style="width:100%;height:150px;margin-top:12px"></canvas>
  </div>

  <div class="sec">Recent</div>
  ${recentHTML()}`;
}

function recentHTML(){
  const list = [...store.get().spends].sort((a,b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id)).slice(0,25);
  if (!list.length) return empty('🧾', 'Nothing logged yet this month.');
  return `<div class="stack" style="gap:8px">${list.map(s => `
    <div class="rowcard">
      <div class="grow"><b>${esc(s.cat)}</b>
        <span class="sub">${esc(fmtDayShort(s.day))}${s.note ? ' · ' + esc(s.note) : ''}</span></div>
      <span style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px">${money(s.amount)}</span>
      <button class="btn btn-sm" style="color:var(--faint);padding:6px 8px" data-act="rmspend" data-id="${s.id}">✕</button>
    </div>`).join('')}</div>`;
}

function drawSpend(){
  const days = lastNDays(14);
  const byDay = days.map(d => store.get().spends.filter(s => s.day === d).reduce((n,s) => n + s.amount, 0));
  const daily = freeCash() / 30;
  requestAnimationFrame(() => {
    barChart(document.getElementById('led-chart'), {
      values: byDay,
      labels: days.map((d,i) => i%3===0 ? d.slice(8) : ''),
      target: daily > 0 ? daily : null,
      colorFor: v => v > daily ? '#DC2626' : getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim(),
    });
  });
}

/* ---------------- fixed costs ---------------- */
function fixedHTML(){
  const rs = store.get().recurring;
  const groups = { need:'Needs', want:'Wants', save:'Savings' };
  const total = monthlyFixed();
  const hasWeekly = rs.some(r => r.freq === 'week' || r.freq === 'fortnight');

  return `
  <div class="card in">
    <div class="spread">
      <div><div class="card-note">Total fixed, per month</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:30px;margin-top:2px">${money(total)}</div></div>
      <button class="btn btn-soft btn-sm" data-act="addfixed">+ Add</button>
    </div>
    ${hasWeekly ? `<div class="tiny muted" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft);line-height:1.55">
      Weekly costs are converted at <b>× 52 ÷ 12</b>, not × 4. A year is 52 weeks, so four months
      carry a fifth payment — ${money(400)}/week is ${money(toMonthly(400,'week'))}/month, not ${money(1600)}.
      Budgeting the round number leaves you ${money(1600)} short by December.
    </div>` : ''}
  </div>

  ${!rs.length ? empty('📋','Nothing fixed yet.<br>Add rent, subscriptions, insurance — anything that leaves without you deciding.') :
    Object.entries(groups).map(([k,label]) => {
      const items = rs.filter(r => r.kind === k);
      if (!items.length) return '';
      const sub = items.reduce((n,r) => n + toMonthly(r.amount, r.freq), 0);
      return `<div class="sec">${label} · ${money(sub)}/mo</div>
      <div class="stack" style="gap:8px">${items.map(r => {
        const note = conversionNote(r.amount, r.freq);
        return `<div class="rowcard">
          <div class="grow"><b>${esc(r.name)}</b>
            <span class="sub">${money(r.amount)} / ${esc(r.freq)} → <b>${money(toMonthly(r.amount,r.freq))}</b> a month</span>
            ${note ? `<span class="sub" style="font-size:11.5px;opacity:.75">${note}</span>` : ''}</div>
          <button class="btn btn-sm" style="color:var(--faint);padding:6px 8px" data-act="rmfixed" data-id="${r.id}">✕</button>
        </div>`;
      }).join('')}</div>`;
    }).join('')}`;
}

/* ---------------- house scenarios ---------------- */
function houseHTML(){
  const scs = store.get().scenarios;
  return `
  <div class="card in" style="background:var(--accent-tint);border-color:transparent">
    <div class="card-title">Property scenarios</div>
    <p class="card-note" style="margin-top:6px">
      Model a place properly: repayments, strata, rates, stamp duty and what's actually left over each month —
      plus what happens if rates go up 3%.
    </p>
    <button class="btn btn-primary block" style="margin-top:14px" data-act="addsc">+ New scenario</button>
  </div>

  ${!scs.length ? empty('🏠','No scenarios yet.<br>Add a place you\'re considering and see what it does to your month.') :
    `<div class="stack" style="margin-top:14px;gap:10px">${scs.map(sc => {
      const m = modelScenario(sc);
      const tone = m.verdict === 'comfortable' ? 'good' : m.verdict === 'tight' ? 'warn' : 'bad';
      return `<button class="card in" data-act="opensc" data-id="${sc.id}" style="width:100%;text-align:left">
        <div class="spread">
          <div class="grow">
            <b style="font-size:15.5px">${esc(sc.name)}</b>
            <div class="tiny muted" style="margin-top:2px">${money(sc.price)} · ${money(sc.deposit)} deposit · ${round(m.lvr,0)}% LVR</div>
          </div>
          <span class="badge ${tone}">${m.verdict}</span>
        </div>
        <div class="hr" style="margin:12px 0"></div>
        <div class="grid3" style="gap:8px">
          <div><div class="tiny muted">Repayment</div><b class="mono" style="font-size:15px">${money(m.repay)}</b></div>
          <div><div class="tiny muted">All housing</div><b class="mono" style="font-size:15px">${money(m.housing)}</b></div>
          <div><div class="tiny muted">Left over</div>
            <b class="mono" style="font-size:15px;color:${m.afterAll<0?'var(--bad)':'var(--good)'}">${money(m.afterAll)}</b></div>
        </div>
      </button>`;
    }).join('')}</div>`}`;
}

function openScenario(id){
  const sc = store.get().scenarios.find(x => x.id === id);
  if (!sc) return;
  const m = modelScenario(sc);
  const tone = m.verdict === 'comfortable' ? 'good' : m.verdict === 'tight' ? 'warn' : 'bad';

  openSheet(`
    <h2>${esc(sc.name)}</h2>
    <p class="sub">${money(sc.price)} at ${sc.rate}% over ${sc.years} years</p>

    <div class="card tight" style="box-shadow:none;background:var(--surface-2);margin-bottom:14px">
      <div class="spread"><span class="card-note">Verdict</span><span class="badge ${tone}">${m.verdict}</span></div>
      <div class="tiny muted" style="margin-top:8px;line-height:1.6">
        Housing eats <b>${round(m.ratio,0)}%</b> of your income.
        Under 33% is comfortable, over 45% means most decisions get made for you.
      </div>
    </div>

    <label class="label">Upfront</label>
    ${rowLine('Deposit', money(sc.deposit))}
    ${rowLine('Stamp duty' + (sc.firstHome ? ' (exempt)' : ''), money(m.duty))}
    ${m.lmi ? rowLine('LMI (LVR over 80%)', money(m.lmi)) : ''}
    ${sc.otherCosts ? rowLine('Legal, inspections, other', money(sc.otherCosts)) : ''}
    ${rowLine('<b>Cash needed</b>', '<b>' + money(m.upfront) + '</b>')}

    <label class="label" style="margin-top:18px">Every month</label>
    ${rowLine('Mortgage', money(m.repay))}
    ${m.strataM ? rowLine('Strata', money(m.strataM)) : ''}
    ${m.councilM ? rowLine('Council rates', money(m.councilM)) : ''}
    ${m.insureM ? rowLine('Insurance', money(m.insureM)) : ''}
    ${rowLine('<b>Total housing</b>', '<b>' + money(m.housing) + '</b>')}
    ${rowLine('Your other fixed costs', money(monthlyFixed()))}
    ${rowLine('<b>Left to live on</b>',
      `<b style="color:${m.afterAll<0?'var(--bad)':'var(--good)'}">${money(m.afterAll)}</b>`)}

    <div class="card tight" style="box-shadow:none;background:${m.stressLeft<0?'var(--bad-tint)':'var(--surface-2)'};margin-top:16px">
      <div class="card-title" style="font-size:14.5px">If rates rise 3%</div>
      <div class="tiny" style="margin-top:6px;line-height:1.6;color:${m.stressLeft<0?'var(--bad)':'var(--muted)'}">
        Repayment goes to <b>${money(m.stressRepay)}</b>, leaving <b>${money(m.stressLeft)}</b> a month.
        ${m.stressLeft < 0
          ? 'That does not work — you would be going backwards. This is the test lenders apply, and it is the one that matters.'
          : 'You would still be above water, which is the point of the test.'}
      </div>
    </div>

    <button class="btn btn-plain block" style="margin-top:16px" data-act="talk">✨ Talk through this scenario</button>
    <div id="sc-ai"></div>
    <button class="btn btn-plain block" style="margin-top:8px" data-act="edit">Edit</button>
    <button class="btn btn-ghost block" data-act="rm" style="color:var(--bad)">Delete scenario</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    edit: () => { closeSheet(); setTimeout(() => editScenario(sc), 200); },
    rm: () => {
      store.update(s => { s.scenarios = s.scenarios.filter(x => x.id !== id); });
      closeSheet(); toast('Deleted'); render();
    },
    talk: async (d, btn) => {
      btn.disabled = true; btn.innerHTML = `<span class="spin dark"></span> Thinking…`;
      try{
        const res = await ask({
          prompt: `You are a straight-talking Australian mortgage adviser. Assess this purchase for someone buying in Sydney.

Property: ${sc.name}, ${money(sc.price)}
Deposit: ${money(sc.deposit)} (LVR ${round(m.lvr,1)}%)
Loan: ${money(m.loan)} at ${sc.rate}% over ${sc.years} years
Monthly repayment: ${money(m.repay)}
Strata: ${money(m.strataM)}/mo, council ${money(m.councilM)}/mo, insurance ${money(m.insureM)}/mo
Total housing: ${money(m.housing)}/mo = ${round(m.ratio,1)}% of gross income
Monthly income: ${money(monthlyIncome())}
Other fixed commitments: ${money(monthlyFixed())}/mo
Left over after everything: ${money(m.afterAll)}/mo
At +3% rates: repayment ${money(m.stressRepay)}, leaving ${money(m.stressLeft)}/mo
${m.lmi ? `LMI payable: ${money(m.lmi)}` : 'No LMI (LVR at or under 80%)'}

Be honest and specific. Don't hedge everything. Respond with ONLY this JSON:
{"verdict":"one blunt sentence","points":["3-5 specific observations about THIS deal, using the actual numbers"],"watch":["2-3 things that would change the answer"]}`,
          offline: () => ({
            verdict: m.verdict === 'comfortable'
              ? 'The numbers work on paper, with room to move.'
              : m.verdict === 'tight'
              ? 'It fits, but there is not much slack in it.'
              : 'This is a stretch — housing is taking too big a share.',
            points: [
              `Housing takes ${round(m.ratio,0)}% of income. Under 33% is comfortable, over 45% is stressed.`,
              `You need ${money(m.upfront)} in cash before you get the keys, not just the deposit.`,
              m.lmi ? `LVR above 80% adds ${money(m.lmi)} of LMI — money you never see again.` : 'LVR at or under 80%, so no LMI. That is the right side of the line.',
              `At +3% rates you'd be left with ${money(m.stressLeft)} a month.`,
            ],
            watch: ['Strata can rise sharply after a special levy.','Check the sinking fund before committing.','Rate movements over the first five years.'],
          }),
        });
        const a = res.data;
        document.getElementById('sc-ai').innerHTML = `
          <div class="card tight" style="box-shadow:none;background:var(--surface-2);margin-top:12px">
            <b style="font-size:15px">${esc(a.verdict)}</b>
            <ul style="margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.7;color:var(--ink-2)">
              ${(a.points||[]).map(p => `<li>${esc(p)}</li>`).join('')}
            </ul>
            ${(a.watch||[]).length ? `<div class="hr"></div>
              <div class="label">Watch</div>
              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:var(--muted)">
                ${a.watch.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
          </div>`;
      }catch(e){ toast(e.message || 'Could not reach AI'); }
      finally{ btn.disabled = false; btn.textContent = '✨ Talk through this scenario'; }
    },
  });
}

const rowLine = (l, v) => `<div class="spread" style="padding:8px 0;border-bottom:1px solid var(--line-soft)">
  <span class="card-note">${l}</span><span class="mono" style="font-size:14.5px">${v}</span></div>`;

function editScenario(sc){
  const isNew = !sc;
  const d = sc || { name:'', price:900000, deposit:180000, rate:6.0, years:30,
                    strata:1200, strataFreq:'quarter', council:1600, insurance:800,
                    otherCosts:3000, firstHome:false };
  openSheet(`
    <h2>${isNew ? 'New scenario' : 'Edit scenario'}</h2>
    <p class="sub">Rough numbers are fine — you can refine as you learn more.</p>

    <label class="label">Name</label>
    <input class="input" id="sc-name" value="${esc(d.name)}" placeholder="e.g. 2BR Marrickville">

    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Price</label><input class="input" type="number" inputmode="numeric" id="sc-price" value="${d.price}"></div>
      <div><label class="label">Deposit</label><input class="input" type="number" inputmode="numeric" id="sc-dep" value="${d.deposit}"></div>
      <div><label class="label">Rate %</label><input class="input" type="number" inputmode="decimal" step="0.05" id="sc-rate" value="${d.rate}"></div>
      <div><label class="label">Term (years)</label><input class="input" type="number" inputmode="numeric" id="sc-years" value="${d.years}"></div>
    </div>

    <label class="label" style="margin-top:16px">Strata</label>
    <div class="grid2">
      <input class="input" type="number" inputmode="numeric" id="sc-strata" value="${d.strata}">
      <select class="select" id="sc-sfreq">
        ${[['quarter','per quarter'],['month','per month'],['year','per year']].map(([v,l]) =>
          `<option value="${v}" ${d.strataFreq===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>

    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Council / yr</label><input class="input" type="number" inputmode="numeric" id="sc-council" value="${d.council}"></div>
      <div><label class="label">Insurance / yr</label><input class="input" type="number" inputmode="numeric" id="sc-ins" value="${d.insurance}"></div>
    </div>

    <label class="label" style="margin-top:16px">Legal, inspections, other upfront</label>
    <input class="input" type="number" inputmode="numeric" id="sc-other" value="${d.otherCosts}">

    <label class="row" style="margin-top:16px;gap:10px;align-items:center">
      <input type="checkbox" id="sc-fh" ${d.firstHome?'checked':''} style="width:20px;height:20px">
      <span style="font-size:14.5px">First home buyer — no stamp duty</span>
    </label>

    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">${isNew?'Create':'Save'}</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    save: () => {
      const name = sheetVal('sc-name').trim();
      if (!name){ toast('Give it a name'); return; }
      const obj = {
        id: sc?.id || uid(), name,
        price: sheetNum('sc-price'), deposit: sheetNum('sc-dep'),
        rate: sheetNum('sc-rate', 6), years: sheetNum('sc-years', 30),
        strata: sheetNum('sc-strata'), strataFreq: sheetVal('sc-sfreq'),
        council: sheetNum('sc-council'), insurance: sheetNum('sc-ins'),
        otherCosts: sheetNum('sc-other'),
        firstHome: document.getElementById('sc-fh').checked,
      };
      store.update(s => {
        const i = s.scenarios.findIndex(x => x.id === obj.id);
        if (i >= 0) s.scenarios[i] = obj; else s.scenarios.push(obj);
      });
      closeSheet(); toast(isNew ? 'Scenario added' : 'Saved'); render();
    },
    close: closeSheet,
  });
}

/* ---------------- other sheets ---------------- */
function openIncome(){
  const inc = store.get().income;
  openSheet(`
    <h2>Income</h2>
    <p class="sub">Take-home, after tax — the number that actually lands in your account.</p>
    <div class="grid2">
      <div><label class="label">Amount</label>
        <input class="input" type="number" inputmode="decimal" id="in-amt" value="${inc.amount||''}" placeholder="0"></div>
      <div><label class="label">How often</label>
        <select class="select" id="in-freq">
          ${[['week','Weekly'],['fortnight','Fortnightly'],['month','Monthly'],['year','Yearly']].map(([v,l]) =>
            `<option value="${v}" ${inc.freq===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
    </div>
    <button class="btn btn-primary block" style="margin-top:16px" data-act="save">Save</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    save: () => {
      store.update(s => { s.income = { amount: sheetNum('in-amt'), freq: sheetVal('in-freq') }; });
      closeSheet(); toast('Saved'); render();
    },
    close: closeSheet,
  });
}

function openAddFixed(){
  openSheet(`
    <h2>Fixed cost</h2>
    <p class="sub">Anything that leaves your account without you deciding each time.</p>
    <label class="label">What is it</label>
    <input class="input" id="f-name" placeholder="Rent, gym, Spotify…">
    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Amount</label><input class="input" type="number" inputmode="decimal" id="f-amt"></div>
      <div><label class="label">How often</label>
        <select class="select" id="f-freq">
          ${[['week','Weekly'],['fortnight','Fortnightly'],['month','Monthly'],['year','Yearly']].map(([v,l]) =>
            `<option value="${v}" ${v==='month'?'selected':''}>${l}</option>`).join('')}
        </select></div>
    </div>
    <label class="label" style="margin-top:16px">Type</label>
    <div class="chips" id="f-kind">
      ${[['need','Need'],['want','Want'],['save','Savings']].map(([v,l],i) =>
        `<button class="chip ${i===0?'on':''}" data-act="kind" data-v="${v}">${l}</button>`).join('')}
    </div>
    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">Add</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  let kind = 'need';
  bindActions(document.querySelector('.sheet'), {
    kind: (d, el) => {
      kind = d.v;
      el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    },
    save: () => {
      const name = sheetVal('f-name').trim();
      const amt = sheetNum('f-amt');
      if (!name || amt <= 0){ toast('Name and amount, please'); return; }
      store.update(s => s.recurring.push({ id:uid(), name, amount:amt, freq:sheetVal('f-freq'), kind }));
      closeSheet(); toast('Added'); render();
    },
    close: closeSheet,
  });
}

function openAddSpend(){
  const cats = store.get().cats;
  openSheet(`
    <h2>Log a spend</h2>
    <p class="sub">Quick and rough beats accurate and never.</p>
    <label class="label">Amount</label>
    <input class="input" type="number" inputmode="decimal" id="sp-amt" placeholder="0" style="font-size:22px;font-weight:700;text-align:center;padding:16px">
    <label class="label" style="margin-top:16px">Category</label>
    <div class="chips" id="sp-cats">
      ${cats.map((c,i) => `<button class="chip ${i===0?'on':''}" data-act="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <label class="label" style="margin-top:16px">Note (optional)</label>
    <input class="input" id="sp-note" placeholder="What was it?">
    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">Log it</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  let cat = cats[0];
  setTimeout(() => document.getElementById('sp-amt')?.focus(), 120);
  bindActions(document.querySelector('.sheet'), {
    cat: (d, el) => {
      cat = d.v;
      el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    },
    save: () => {
      const amt = sheetNum('sp-amt');
      if (amt <= 0){ toast('How much?'); return; }
      store.update(s => s.spends.push({ id:uid(), day:today(), amount:amt, cat, note:sheetVal('sp-note').trim() }));
      closeSheet(); haptic(); toast('Logged ✓'); render();
    },
    close: closeSheet,
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    income: openIncome,
    addfixed: openAddFixed,
    addspend: openAddSpend,
    addsc: () => editScenario(null),
    opensc: d => openScenario(d.id),
    rmfixed: d => {
      store.update(s => { s.recurring = s.recurring.filter(r => r.id !== d.id); });
      render();
    },
    rmspend: d => {
      store.update(s => { s.spends = s.spends.filter(x => x.id !== d.id); });
      render();
    },
  });
}
