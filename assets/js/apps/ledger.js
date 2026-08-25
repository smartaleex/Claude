/* ============================================================
   Ledger — money, and specifically: can I buy this place?

   Deliberately NOT a transaction logger. The question worth answering
   each month is "what should move where", not "what did I spend on
   coffee". So it models income, fixed costs and savings goals, then
   produces a transfer plan you can action in your banking app.

   All arithmetic is local and deterministic. AI is used only where a
   number genuinely has to be looked up — stamp duty and the government
   fees that go with it, which vary by state, price and buyer status.
   ============================================================ */

import { Slice, today, uid, fmtDayShort } from '../core/store.js';
import { ask } from '../core/ai.js';
import {
  esc, num, money, round, toast, openSheet, closeSheet, sheetVal, sheetNum,
  bindActions, empty, stat, haptic,
} from '../core/ui.js';

const DEFAULT_BANKS = ['CommBank', 'Up', 'NAB', 'UBank', 'ING'];
const DEFAULT_CATEGORIES = [
  'Housing', 'Utilities', 'Groceries', 'Transport', 'Health & fitness',
  'Subscriptions', 'Insurance', 'Debt', 'Social', 'Other',
];

const store = new Slice('ledger', {
  incomes: [],       // { id, name, amount, freq, bank }
  recurring: [],     // { id, name, amount, freq, kind, category, bank }
  goals: [],         // { id, name, target, saved, monthly, bank, note }
  scenarios: [],
  banks: DEFAULT_BANKS,
  categories: DEFAULT_CATEGORIES,
  income: { amount: 0, freq: 'month' },   // legacy single income, migrated
  spends: [],
  cats: [],
});

let tab = 'plan';
let root = null;

/* ---------------- money maths ----------------
   Weekly to monthly is 52/12 (4.333), NOT x4. A year has 52 weeks, not
   48, so $400/week is $1,733/month rather than $1,600 — budget the
   naive figure and you're $1,600 short by December. */
const PER_MONTH = { week: 52/12, fortnight: 26/12, month: 1, quarter: 1/3, year: 1/12 };
const toMonthly = (amt, freq) => (amt || 0) * (PER_MONTH[freq] ?? 1);

const FREQ_LABEL = { week:'week', fortnight:'fortnight', month:'month', quarter:'quarter', year:'year' };

/** Human-readable working, so the conversion doesn't look like a bug. */
const conversionNote = (amt, freq) => {
  if (freq === 'month') return '';
  if (freq === 'week')      return `${money(amt)} × 52 ÷ 12`;
  if (freq === 'fortnight') return `${money(amt)} × 26 ÷ 12`;
  if (freq === 'quarter')   return `${money(amt)} ÷ 3`;
  if (freq === 'year')      return `${money(amt)} ÷ 12`;
  return '';
};

/* One-time migration off the old single-income field. */
function migrate(){
  const s = store.get();
  if (s.income?.amount > 0 && !s.incomes.length){
    store.update(st => {
      st.incomes.push({ id:uid(), name:'Salary', amount:st.income.amount, freq:st.income.freq, bank:st.banks[0] });
      st.income = { amount:0, freq:'month' };
    });
  }
  if (!s.banks?.length)      store.update(st => { st.banks = [...DEFAULT_BANKS]; });
  if (!s.categories?.length) store.update(st => { st.categories = [...DEFAULT_CATEGORIES]; });
}

const monthlyIncome = () => store.get().incomes.reduce((n,i) => n + toMonthly(i.amount, i.freq), 0);
const monthlyFixed  = () => store.get().recurring.reduce((n,r) => n + toMonthly(r.amount, r.freq), 0);
const monthlyGoals  = () => store.get().goals.reduce((n,g) => n + (g.monthly || 0), 0);
const leftover      = () => monthlyIncome() - monthlyFixed() - monthlyGoals();

/* ---------------- mortgage maths ---------------- */
export function monthlyRepayment(principal, annualRatePct, years){
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

/** NSW transfer duty, residential, general rates. Indexed annually, so
    the AI lookup is the better path when it's available. */
export function stampDutyNSW(price){
  const bands = [
    [17000, 0, 1.25], [36000, 212, 1.50], [97000, 497, 1.75],
    [364000, 1564, 3.50], [1212000, 10909, 4.50],
    [3636000, 49027, 5.50], [Infinity, 182390, 7.00],
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
  const price   = sc.price || 0;
  const deposit = (sc.deposit || 0) + (sc.gift || 0);
  const loan    = Math.max(0, price - deposit);
  const lvr     = price > 0 ? loan / price * 100 : 0;

  // A looked-up duty wins over the built-in table when we have one.
  const duty = sc.dutyOverride != null ? sc.dutyOverride
             : sc.firstHome ? 0 : stampDutyNSW(price);
  const lmi  = lvr > 80 ? loan * 0.02 : 0;

  const govFees = (sc.transferFee || 0) + (sc.mortgageReg || 0);
  const buyCosts = (sc.legal || 0) + (sc.inspection || 0) + (sc.loanFee || 0) + (sc.moving || 0);
  const upfront = deposit + duty + lmi + govFees + buyCosts;

  const repay    = monthlyRepayment(loan, sc.rate ?? 6.0, sc.years ?? 30);
  const strataM  = toMonthly(sc.strata, sc.strataFreq || 'quarter');
  const councilM = toMonthly(sc.council, sc.councilFreq || 'year');
  const waterM   = toMonthly(sc.water, 'year');
  const insureM  = toMonthly(sc.insurance, 'year');
  const maintM   = toMonthly(sc.maintenance, 'year');
  const housing  = repay + strataM + councilM + waterM + insureM + maintM;

  const income   = monthlyIncome();
  const fixedNow = monthlyFixed();
  const afterAll = income - fixedNow - housing;
  const ratio    = income > 0 ? housing / income * 100 : 0;

  // +3% is roughly the serviceability buffer lenders must test against.
  const stressRepay = monthlyRepayment(loan, (sc.rate ?? 6.0) + 3, sc.years ?? 30);
  const stressLeft  = income - fixedNow - (stressRepay + strataM + councilM + waterM + insureM + maintM);

  return {
    loan, lvr, duty, lmi, govFees, buyCosts, upfront, deposit,
    repay, strataM, councilM, waterM, insureM, maintM, housing,
    afterAll, ratio, stressRepay, stressLeft,
    verdict: ratio > 45 ? 'stretched' : ratio > 33 ? 'tight' : 'comfortable',
  };
}

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  migrate();
  if (!store.get().incomes.length) return { headline:'Not set up', detail:'Add your income to get started' };
  const left = leftover();
  return {
    headline: money(left) + ' spare',
    detail: `${money(monthlyFixed())} fixed · ${money(monthlyGoals())} to goals`,
    badge: left < 0 ? 'Over' : null,
  };
}

/* ---------------- mount ---------------- */
export async function mount(el){
  root = el;
  await store.load();
  migrate();
  render();
}

function render(){
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Money · Ledger</div>
        <h1 class="page-h1">${
          tab==='plan' ? 'The plan' : tab==='fixed' ? 'Fixed costs' :
          tab==='goals' ? 'Goals' : 'The house'}</h1>
      </div>
      <button class="chip" data-act="settings">⚙</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:16px 0">
    ${[['plan','Plan'],['fixed','Fixed'],['goals','Goals'],['house','House']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='plan' ? planHTML() : tab==='fixed' ? fixedHTML()
   : tab==='goals' ? goalsHTML() : houseHTML()}`;

  bind();
}

/* ---------------- plan (the money flow) ---------------- */
function planHTML(){
  const s = store.get();
  if (!s.incomes.length){
    return `<div class="card in">
      <div class="card-title">Start here</div>
      <p class="card-note" style="margin:8px 0 14px">
        Add what comes in and what goes out automatically. This app doesn't want every coffee —
        it works out what should move where each month.
      </p>
      <button class="btn btn-primary block" data-act="addincome">Add an income source</button>
    </div>`;
  }

  const inc = monthlyIncome(), fixed = monthlyFixed(), goalsM = monthlyGoals();
  const left = leftover();
  const pct = x => inc > 0 ? Math.max(0, Math.min(100, x / inc * 100)) : 0;

  return `
  <div class="hero in">
    <div class="spread" style="align-items:flex-start">
      <div><div class="hero-num">${money(Math.max(0,left))}</div>
        <div class="hero-cap">spare each month, after everything</div></div>
    </div>
    <div class="bar" style="display:flex;gap:2px;background:rgba(255,255,255,.2)">
      <i style="width:${pct(fixed)}%;background:rgba(255,255,255,.95);border-radius:99px 0 0 99px"></i>
      <i style="width:${pct(goalsM)}%;background:rgba(255,255,255,.62);border-radius:0"></i>
      <i style="width:${pct(Math.max(0,left))}%;background:rgba(255,255,255,.32);border-radius:0 99px 99px 0"></i>
    </div>
    <div class="hero-cap" style="margin-top:9px;font-size:12.5px">
      ${money(fixed)} fixed · ${money(goalsM)} to goals · ${money(Math.max(0,left))} spare
    </div>
  </div>

  ${left < 0 ? `
  <div class="card in in-2" style="margin-top:14px;background:var(--bad-tint);border-color:transparent">
    <div class="card-title" style="color:var(--bad)">You're over by ${money(-left)}</div>
    <div class="card-note" style="margin-top:4px">
      Fixed costs plus goal contributions exceed what comes in. Ease off a goal or trim a fixed cost.
    </div>
  </div>` : ''}

  <div class="sec">Money in</div>
  <div class="stack" style="gap:8px">
    ${s.incomes.map(i => {
      const note = conversionNote(i.amount, i.freq);
      return `<button class="rowcard" data-act="editincome" data-id="${i.id}" style="width:100%;text-align:left">
        <div class="grow"><b>${esc(i.name)}</b>
          <span class="sub">${money(i.amount)} / ${esc(FREQ_LABEL[i.freq]||i.freq)}${i.bank ? ' → ' + esc(i.bank) : ''}</span>
          ${note ? `<span class="sub" style="font-size:11.5px;opacity:.75">${note}</span>` : ''}</div>
        <span class="mono" style="font-weight:700">${money(toMonthly(i.amount,i.freq))}</span>
        <span class="caret">›</span>
      </button>`;
    }).join('')}
    <button class="btn btn-plain btn-sm block" data-act="addincome">+ Add income</button>
  </div>

  ${transferPlanHTML()}

  <div class="sec">Where it goes</div>
  <div class="card in">
    ${rowLine('Income', money(inc))}
    ${rowLine('Fixed costs', '−' + money(fixed))}
    ${rowLine('Savings goals', '−' + money(goalsM))}
    ${rowLine('<b>Spare to spend</b>',
      `<b style="color:${left<0?'var(--bad)':'var(--good)'}">${money(left)}</b>`)}
    <div class="tiny muted" style="margin-top:12px;line-height:1.55">
      That spare figure is your actual weekly spending money — about
      <b>${money(Math.max(0,left) / 4.333)}</b> a week — without touching goals.
    </div>
  </div>`;
}

/* The point of the app: what to actually move on payday. */
function transferPlanHTML(){
  const s = store.get();
  const funded = s.goals.filter(g => (g.monthly || 0) > 0);
  if (!funded.length){
    return `<div class="sec">Transfer plan</div>
    <div class="card in">
      <div class="card-note">
        Set a monthly amount on a savings goal and this becomes a list of transfers to action
        on payday — how much, and into which account.
      </div>
      <button class="btn btn-soft btn-sm block" style="margin-top:12px" data-act="gotogoals">Set up a goal</button>
    </div>`;
  }
  // Group by destination bank so it maps to actual transfers you'd make.
  const byBank = {};
  funded.forEach(g => { (byBank[g.bank || 'Unassigned'] ||= []).push(g); });

  return `
  <div class="sec">Transfer plan · every month</div>
  <div class="card in">
    <div class="card-note" style="margin-bottom:12px">Move these on payday and the rest is yours to spend.</div>
    ${Object.entries(byBank).map(([bank, gs]) => {
      const total = gs.reduce((n,g) => n + g.monthly, 0);
      return `<div style="padding:11px 0;border-bottom:1px solid var(--line-soft)">
        <div class="spread">
          <b style="font-size:14.5px">→ ${esc(bank)}</b>
          <span class="mono" style="font-weight:800;color:var(--accent-1)">${money(total)}</span>
        </div>
        ${gs.map(g => `<div class="spread tiny muted" style="margin-top:4px">
          <span>${esc(g.name)}</span><span class="mono">${money(g.monthly)}</span></div>`).join('')}
      </div>`;
    }).join('')}
    <div class="spread" style="padding-top:12px">
      <b>Total to move</b>
      <b class="mono">${money(monthlyGoals())}</b>
    </div>
  </div>`;
}

const rowLine = (l, v) => `<div class="spread" style="padding:8px 0;border-bottom:1px solid var(--line-soft)">
  <span class="card-note">${l}</span><span class="mono" style="font-size:14.5px">${v}</span></div>`;

/* ---------------- fixed costs ---------------- */
function fixedHTML(){
  const s = store.get();
  const rs = s.recurring;
  const total = monthlyFixed();
  const hasWeekly = rs.some(r => r.freq === 'week' || r.freq === 'fortnight');

  // Group by category — that's the lens that shows where money leaks.
  const byCat = {};
  rs.forEach(r => { (byCat[r.category || 'Other'] ||= []).push(r); });
  const cats = Object.entries(byCat)
    .sort((a,b) => b[1].reduce((n,r)=>n+toMonthly(r.amount,r.freq),0)
                 - a[1].reduce((n,r)=>n+toMonthly(r.amount,r.freq),0));

  return `
  <div class="card in">
    <div class="spread">
      <div><div class="card-note">Total fixed, per month</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:30px;margin-top:2px">${money(total)}</div></div>
      <button class="btn btn-soft btn-sm" data-act="addfixed">+ Add</button>
    </div>
    ${hasWeekly ? `<div class="tiny muted" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft);line-height:1.55">
      Weekly costs convert at <b>× 52 ÷ 12</b>, not × 4 — a year is 52 weeks, so four months carry a
      fifth payment. ${money(400)}/week is ${money(toMonthly(400,'week'))}/month.
    </div>` : ''}
  </div>

  ${!rs.length ? empty('📋','Nothing fixed yet.<br>Add rent, subscriptions, insurance — anything that leaves without you deciding.') :
    cats.map(([cat, items]) => {
      const sub = items.reduce((n,r) => n + toMonthly(r.amount, r.freq), 0);
      return `<div class="sec">${esc(cat)} · ${money(sub)}/mo</div>
      <div class="stack" style="gap:8px">${items.map(r => {
        const note = conversionNote(r.amount, r.freq);
        return `<button class="rowcard" data-act="editfixed" data-id="${r.id}" style="width:100%;text-align:left">
          <div class="grow">
            <div class="spread" style="align-items:baseline">
              <b>${esc(r.name)}</b>
              ${r.bank ? `<span class="badge neutral">${esc(r.bank)}</span>` : ''}
            </div>
            <span class="sub">${money(r.amount)} / ${esc(FREQ_LABEL[r.freq]||r.freq)} → <b>${money(toMonthly(r.amount,r.freq))}</b> a month</span>
            ${note ? `<span class="sub" style="font-size:11.5px;opacity:.75">${note}</span>` : ''}
          </div>
          <span class="caret">›</span>
        </button>`;
      }).join('')}</div>`;
    }).join('')}

  ${rs.length ? `<div class="sec">By account</div>
  <div class="card in">
    ${Object.entries(rs.reduce((acc,r) => {
        acc[r.bank || 'Unassigned'] = (acc[r.bank || 'Unassigned'] || 0) + toMonthly(r.amount, r.freq);
        return acc;
      }, {})).sort((a,b) => b[1]-a[1]).map(([bank, amt]) =>
        rowLine(esc(bank), money(amt))).join('')}
    <div class="tiny muted" style="margin-top:10px">
      Useful for checking each account holds enough to cover what's drawn from it.
    </div>
  </div>` : ''}`;
}

/* ---------------- goals ---------------- */
function goalsHTML(){
  const gs = store.get().goals;
  if (!gs.length){
    return `<div class="card in">
      <div class="card-title">Savings goals</div>
      <p class="card-note" style="margin:8px 0 14px">
        A house deposit, a buffer, a trip. Set a target and a monthly amount, and the Plan tab
        turns it into a list of transfers.
      </p>
      <button class="btn btn-primary block" data-act="addgoal">Add a goal</button>
    </div>`;
  }
  return `
  <button class="btn btn-primary block in" data-act="addgoal">+ New goal</button>
  <div class="stack" style="margin-top:14px;gap:10px">
    ${gs.map(g => {
      const pct = g.target > 0 ? Math.min(100, (g.saved||0) / g.target * 100) : 0;
      const remain = Math.max(0, g.target - (g.saved||0));
      const months = g.monthly > 0 ? Math.ceil(remain / g.monthly) : null;
      return `<button class="card in" data-act="editgoal" data-id="${g.id}" style="width:100%;text-align:left">
        <div class="spread" style="align-items:baseline">
          <b style="font-size:15.5px">${esc(g.name)}</b>
          ${g.bank ? `<span class="badge accent">${esc(g.bank)}</span>` : ''}
        </div>
        <div class="spread" style="align-items:baseline;margin-top:6px">
          <span style="font-family:'Sora',sans-serif;font-weight:800;font-size:22px">${money(g.saved||0)}</span>
          <span class="tiny muted">of ${money(g.target)}</span>
        </div>
        <div class="meter-track" style="background:var(--bg-sunk);margin-top:8px">
          <div class="meter-fill" style="width:${pct}%;background:var(--accent-1)"></div>
        </div>
        <div class="spread tiny muted" style="margin-top:8px">
          <span>${g.monthly > 0 ? money(g.monthly) + '/month' : 'No monthly amount set'}</span>
          <span>${months !== null
            ? (months === 0 ? 'Done ✓' : `${months} month${months>1?'s':''} to go`)
            : remain > 0 ? money(remain) + ' to go' : 'Done ✓'}</span>
        </div>
      </button>`;
    }).join('')}
  </div>
  <div class="card in" style="margin-top:14px">
    ${rowLine('Committed monthly', money(monthlyGoals()))}
    ${rowLine('<b>Left to spend</b>',
      `<b style="color:${leftover()<0?'var(--bad)':'var(--good)'}">${money(leftover())}</b>`)}
  </div>`;
}

/* ---------------- house ---------------- */
function houseHTML(){
  const scs = store.get().scenarios;
  return `
  <div class="card in" style="background:var(--accent-tint);border-color:transparent">
    <div class="card-title">Property scenarios</div>
    <p class="card-note" style="margin-top:6px">
      Every cost of buying, not just the repayment: stamp duty, LMI, legals, inspections, strata,
      rates, insurance — plus what happens if rates rise 3%.
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
            <div class="tiny muted" style="margin-top:2px">${money(sc.price)} · ${money(m.deposit)} down · ${round(m.lvr,0)}% LVR</div>
          </div>
          <span class="badge ${tone}">${m.verdict}</span>
        </div>
        <div class="hr" style="margin:12px 0"></div>
        <div class="grid3" style="gap:8px">
          <div><div class="tiny muted">Cash needed</div><b class="mono" style="font-size:14px">${money(m.upfront)}</b></div>
          <div><div class="tiny muted">All housing</div><b class="mono" style="font-size:14px">${money(m.housing)}</b></div>
          <div><div class="tiny muted">Left over</div>
            <b class="mono" style="font-size:14px;color:${m.afterAll<0?'var(--bad)':'var(--good)'}">${money(m.afterAll)}</b></div>
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
    <p class="sub">${money(sc.price)} at ${sc.rate}% over ${sc.years} years${sc.suburb ? ' · ' + esc(sc.suburb) : ''}</p>

    <div class="card tight" style="box-shadow:none;background:var(--surface-2);margin-bottom:14px">
      <div class="spread"><span class="card-note">Verdict</span><span class="badge ${tone}">${m.verdict}</span></div>
      <div class="tiny muted" style="margin-top:8px;line-height:1.6">
        Housing eats <b>${round(m.ratio,0)}%</b> of your income.
        Under 33% is comfortable, over 45% means most decisions get made for you.
      </div>
    </div>

    <label class="label">Cash needed upfront</label>
    ${rowLine('Deposit', money(sc.deposit || 0))}
    ${sc.gift ? rowLine('Family contribution', money(sc.gift)) : ''}
    ${rowLine('Stamp duty' + (sc.firstHome ? ' (exempt)' : '') + (sc.dutyOverride != null ? ' ·&nbsp;looked&nbsp;up' : ''), money(m.duty))}
    ${m.lmi ? rowLine('LMI (LVR over 80%)', money(m.lmi)) : ''}
    ${m.govFees ? rowLine('Transfer & mortgage registration', money(m.govFees)) : ''}
    ${m.buyCosts ? rowLine('Legals, inspection, loan fee, moving', money(m.buyCosts)) : ''}
    ${rowLine('<b>Total cash needed</b>', '<b>' + money(m.upfront) + '</b>')}

    <label class="label" style="margin-top:18px">Every month</label>
    ${rowLine('Mortgage', money(m.repay))}
    ${m.strataM ? rowLine('Strata', money(m.strataM)) : ''}
    ${m.councilM ? rowLine('Council rates', money(m.councilM)) : ''}
    ${m.waterM ? rowLine('Water', money(m.waterM)) : ''}
    ${m.insureM ? rowLine('Insurance', money(m.insureM)) : ''}
    ${m.maintM ? rowLine('Maintenance allowance', money(m.maintM)) : ''}
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

    <button class="btn btn-plain block" style="margin-top:16px" data-act="lookup">✨ Look up stamp duty & fees</button>
    <button class="btn btn-plain block" style="margin-top:8px" data-act="talk">✨ Talk through this scenario</button>
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
    lookup: (d, btn) => lookupDuty(sc, btn),
    talk: (d, btn) => talkScenario(sc, m, btn),
  });
}

/* ---------------- AI: stamp duty lookup ----------------
   Duty tables are indexed annually and concessions change with policy,
   so this is one of the few numbers genuinely worth looking up rather
   than hardcoding. The result is stored as an override. */
async function lookupDuty(sc, btn){
  btn.disabled = true;
  btn.innerHTML = `<span class="spin dark"></span> Looking up…`;
  try{
    const res = await ask({
      prompt: `You are an Australian conveyancing cost calculator. Work out the government costs for this purchase using the CURRENT published rates for the state.

State: ${sc.state || 'NSW'}
Purchase price: $${sc.price}
Property type: ${sc.propertyType || 'apartment'}
First home buyer: ${sc.firstHome ? 'yes' : 'no'}
Will live in it (owner-occupier): ${sc.ownerOccupier === false ? 'no, investment' : 'yes'}
${sc.suburb ? `Suburb: ${sc.suburb}` : ''}

Give the transfer (stamp) duty after any first-home concession or exemption that applies at this price, plus the separate title transfer fee and mortgage registration fee. Amounts in whole dollars.

Respond with ONLY this JSON:
{"duty":0,"transferFee":0,"mortgageReg":0,"concession":"what concession applied, or 'none'","notes":"one or two sentences on anything price-sensitive or about to change"}`,
      offline: () => ({
        duty: sc.firstHome ? 0 : Math.round(stampDutyNSW(sc.price)),
        transferFee: 178, mortgageReg: 178,
        concession: sc.firstHome ? 'First home buyer exemption assumed' : 'none',
        notes: 'Calculated from the built-in NSW general rate table. Thresholds are indexed annually — check Revenue NSW before relying on it for an offer.',
      }),
    });
    const a = res.data;
    store.update(s => {
      const x = s.scenarios.find(y => y.id === sc.id);
      if (x){
        x.dutyOverride = a.duty;
        x.transferFee = a.transferFee ?? x.transferFee;
        x.mortgageReg = a.mortgageReg ?? x.mortgageReg;
        x.dutyNote = a.notes || '';
        x.dutySource = res.tier === 3 ? 'Built-in NSW table' : 'Looked up';
      }
    });
    toast(`Stamp duty: ${money(a.duty)}`);
    closeSheet();
    setTimeout(() => openScenario(sc.id), 220);
  }catch(e){
    toast(e.message || 'Could not look that up');
    btn.disabled = false;
    btn.textContent = '✨ Look up stamp duty & fees';
  }
}

async function talkScenario(sc, m, btn){
  btn.disabled = true;
  btn.innerHTML = `<span class="spin dark"></span> Thinking…`;
  try{
    const res = await ask({
      prompt: `You are a straight-talking Australian mortgage adviser. Assess this purchase.

Property: ${sc.name}${sc.suburb ? ', ' + sc.suburb : ''}, ${money(sc.price)}, ${sc.propertyType || 'apartment'}
Deposit: ${money(m.deposit)}${sc.gift ? ` (includes ${money(sc.gift)} family contribution)` : ''} — LVR ${round(m.lvr,1)}%
Loan: ${money(m.loan)} at ${sc.rate}% over ${sc.years} years
Monthly repayment: ${money(m.repay)}
Strata ${money(m.strataM)}/mo, council ${money(m.councilM)}/mo, water ${money(m.waterM)}/mo, insurance ${money(m.insureM)}/mo, maintenance ${money(m.maintM)}/mo
Total housing: ${money(m.housing)}/mo = ${round(m.ratio,1)}% of gross income
Monthly income: ${money(monthlyIncome())}
Other fixed commitments: ${money(monthlyFixed())}/mo
Left over: ${money(m.afterAll)}/mo
At +3% rates: repayment ${money(m.stressRepay)}, leaving ${money(m.stressLeft)}/mo
Cash needed at settlement: ${money(m.upfront)}
${m.lmi ? `LMI payable: ${money(m.lmi)}` : 'No LMI (LVR at or under 80%)'}

Be honest and specific, use the actual numbers, don't hedge everything.
Respond with ONLY this JSON:
{"verdict":"one blunt sentence","points":["3-5 specific observations about THIS deal"],"watch":["2-3 things that would change the answer"]}`,
      offline: () => ({
        verdict: m.verdict === 'comfortable' ? 'The numbers work on paper, with room to move.'
               : m.verdict === 'tight' ? 'It fits, but there is not much slack in it.'
               : 'This is a stretch — housing is taking too big a share.',
        points: [
          `Housing takes ${round(m.ratio,0)}% of income. Under 33% is comfortable, over 45% is stressed.`,
          `You need ${money(m.upfront)} in cash before you get the keys, not just the deposit.`,
          m.lmi ? `LVR above 80% adds ${money(m.lmi)} of LMI — money you never see again.`
                : 'LVR at or under 80%, so no LMI. That is the right side of the line.',
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
        ${(a.watch||[]).length ? `<div class="hr"></div><div class="label">Watch</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:var(--muted)">
            ${a.watch.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      </div>`;
  }catch(e){ toast(e.message || 'Could not reach AI'); }
  finally{ btn.disabled = false; btn.textContent = '✨ Talk through this scenario'; }
}

/* ---------------- scenario editor ---------------- */
function editScenario(sc){
  const isNew = !sc;
  const d = sc || {
    name:'', suburb:'', state:'NSW', propertyType:'apartment',
    price:900000, deposit:180000, gift:0, rate:6.0, years:30,
    firstHome:false, ownerOccupier:true,
    strata:1200, strataFreq:'quarter', council:1600, councilFreq:'year',
    water:800, insurance:600, maintenance:1500,
    legal:2000, inspection:600, loanFee:600, moving:1000,
    transferFee:178, mortgageReg:178,
  };
  const numField = (id, label, val, step) =>
    `<div><label class="label">${label}</label>
     <input class="input" type="number" inputmode="${step?'decimal':'numeric'}" ${step?`step="${step}"`:''} id="${id}" value="${val ?? 0}"></div>`;

  openSheet(`
    <h2>${isNew ? 'New scenario' : 'Edit scenario'}</h2>
    <p class="sub">Rough numbers are fine — refine as you learn more.</p>

    <label class="label">Name</label>
    <input class="input" id="sc-name" value="${esc(d.name)}" placeholder="e.g. 2BR Marrickville">
    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Suburb</label><input class="input" id="sc-suburb" value="${esc(d.suburb||'')}" placeholder="Optional"></div>
      <div><label class="label">State</label>
        <select class="select" id="sc-state">
          ${['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'].map(x =>
            `<option ${d.state===x?'selected':''}>${x}</option>`).join('')}
        </select></div>
    </div>

    <label class="label" style="margin-top:16px">Property type</label>
    <div class="chips" id="sc-type">
      ${['apartment','townhouse','house'].map(t =>
        `<button class="chip ${d.propertyType===t?'on':''}" data-act="ptype" data-v="${t}">${t}</button>`).join('')}
    </div>

    <div class="sec" style="margin-top:20px">The purchase</div>
    <div class="grid2">
      ${numField('sc-price','Price', d.price)}
      ${numField('sc-dep','Your deposit', d.deposit)}
      ${numField('sc-gift','Family contribution', d.gift)}
      ${numField('sc-rate','Rate %', d.rate, '0.05')}
      ${numField('sc-years','Term (years)', d.years)}
    </div>

    <label class="row" style="margin-top:14px;gap:10px;align-items:center">
      <input type="checkbox" id="sc-fh" ${d.firstHome?'checked':''} style="width:20px;height:20px">
      <span style="font-size:14.5px">First home buyer</span>
    </label>
    <label class="row" style="margin-top:10px;gap:10px;align-items:center">
      <input type="checkbox" id="sc-oo" ${d.ownerOccupier!==false?'checked':''} style="width:20px;height:20px">
      <span style="font-size:14.5px">I'll be living in it</span>
    </label>

    <div class="sec" style="margin-top:20px">Upfront costs</div>
    <div class="grid2">
      ${numField('sc-legal','Conveyancing', d.legal)}
      ${numField('sc-insp','Building & pest', d.inspection)}
      ${numField('sc-loanfee','Loan app fee', d.loanFee)}
      ${numField('sc-moving','Moving', d.moving)}
      ${numField('sc-transfer','Title transfer fee', d.transferFee)}
      ${numField('sc-mortreg','Mortgage registration', d.mortgageReg)}
    </div>
    <div class="tiny muted" style="margin-top:8px">
      Stamp duty is calculated automatically, or tap "Look up stamp duty" on the scenario for
      current rates and concessions.
    </div>

    <div class="sec" style="margin-top:20px">Ongoing costs</div>
    <label class="label">Strata</label>
    <div class="grid2">
      <input class="input" type="number" inputmode="numeric" id="sc-strata" value="${d.strata ?? 0}">
      <select class="select" id="sc-sfreq">
        ${[['quarter','per quarter'],['month','per month'],['year','per year']].map(([v,l]) =>
          `<option value="${v}" ${d.strataFreq===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="grid2" style="margin-top:12px">
      ${numField('sc-council','Council rates / yr', d.council)}
      ${numField('sc-water','Water / yr', d.water)}
      ${numField('sc-ins','Insurance / yr', d.insurance)}
      ${numField('sc-maint','Maintenance / yr', d.maintenance)}
    </div>
    <div class="tiny muted" style="margin-top:8px">
      A maintenance allowance of about 1% of the property value a year is the usual rule of thumb.
    </div>

    <button class="btn btn-primary block" style="margin-top:20px" data-act="save">${isNew?'Create':'Save'}</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  let ptype = d.propertyType;
  bindActions(document.querySelector('.sheet'), {
    ptype: (dd, el) => {
      ptype = dd.v;
      el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    },
    save: () => {
      const name = sheetVal('sc-name').trim();
      if (!name){ toast('Give it a name'); return; }
      const obj = {
        id: sc?.id || uid(), name,
        suburb: sheetVal('sc-suburb').trim(),
        state: sheetVal('sc-state'), propertyType: ptype,
        price: sheetNum('sc-price'), deposit: sheetNum('sc-dep'), gift: sheetNum('sc-gift'),
        rate: sheetNum('sc-rate', 6), years: sheetNum('sc-years', 30),
        firstHome: document.getElementById('sc-fh').checked,
        ownerOccupier: document.getElementById('sc-oo').checked,
        legal: sheetNum('sc-legal'), inspection: sheetNum('sc-insp'),
        loanFee: sheetNum('sc-loanfee'), moving: sheetNum('sc-moving'),
        transferFee: sheetNum('sc-transfer'), mortgageReg: sheetNum('sc-mortreg'),
        strata: sheetNum('sc-strata'), strataFreq: sheetVal('sc-sfreq'),
        council: sheetNum('sc-council'), councilFreq: 'year',
        water: sheetNum('sc-water'), insurance: sheetNum('sc-ins'),
        maintenance: sheetNum('sc-maint'),
        // A price or status change invalidates any looked-up duty.
        dutyOverride: (sc && sc.price === sheetNum('sc-price')
                        && sc.firstHome === document.getElementById('sc-fh').checked)
                      ? sc.dutyOverride : null,
        dutyNote: sc?.dutyNote, dutySource: sc?.dutySource,
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

/* ---------------- income / fixed / goal editors ---------------- */
const freqOptions = (sel, withQuarter) =>
  [['week','Weekly'],['fortnight','Fortnightly'],['month','Monthly'],
   ...(withQuarter ? [['quarter','Quarterly']] : []),['year','Yearly']]
  .map(([v,l]) => `<option value="${v}" ${sel===v?'selected':''}>${l}</option>`).join('');

const bankChips = (sel, act) => store.get().banks
  .map(b => `<button class="chip ${sel===b?'on':''}" data-act="${act}" data-v="${esc(b)}">${esc(b)}</button>`).join('');

function editIncome(inc){
  const isNew = !inc;
  const d = inc || { name:'', amount:0, freq:'month', bank:store.get().banks[0] };
  openSheet(`
    <h2>${isNew ? 'Add income' : 'Edit income'}</h2>
    <p class="sub">Take-home, after tax. Add a separate line for anything irregular — family help, side work.</p>
    <label class="label">What is it</label>
    <input class="input" id="i-name" value="${esc(d.name)}" placeholder="Salary, from Mum & Dad, freelance…">
    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Amount</label>
        <input class="input" type="number" inputmode="decimal" id="i-amt" value="${d.amount||''}" placeholder="0"></div>
      <div><label class="label">How often</label>
        <select class="select" id="i-freq">${freqOptions(d.freq)}</select></div>
    </div>
    <label class="label" style="margin-top:16px">Lands in</label>
    <div class="chips">${bankChips(d.bank,'bank')}</div>
    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">${isNew?'Add':'Save'}</button>
    ${!isNew ? `<button class="btn btn-ghost block" style="color:var(--bad)" data-act="rm">Delete</button>` : ''}
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  let bank = d.bank;
  bindActions(document.querySelector('.sheet'), {
    bank: (dd, el) => { bank = dd.v; el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c===el)); },
    save: () => {
      const name = sheetVal('i-name').trim(), amt = sheetNum('i-amt');
      if (!name || amt <= 0){ toast('Name and amount, please'); return; }
      const obj = { id: inc?.id || uid(), name, amount:amt, freq:sheetVal('i-freq'), bank };
      store.update(s => {
        const i = s.incomes.findIndex(x => x.id === obj.id);
        if (i >= 0) s.incomes[i] = obj; else s.incomes.push(obj);
      });
      closeSheet(); toast('Saved'); render();
    },
    rm: () => {
      store.update(s => { s.incomes = s.incomes.filter(x => x.id !== inc.id); });
      closeSheet(); toast('Deleted'); render();
    },
    close: closeSheet,
  });
}

function editFixed(r){
  const isNew = !r;
  const s0 = store.get();
  const d = r || { name:'', amount:0, freq:'month', kind:'need', category:s0.categories[0], bank:s0.banks[0] };
  openSheet(`
    <h2>${isNew ? 'Add fixed cost' : 'Edit fixed cost'}</h2>
    <p class="sub">Anything that leaves your account without you deciding each time.</p>
    <label class="label">What is it</label>
    <input class="input" id="f-name" value="${esc(d.name)}" placeholder="Rent, gym, Spotify…">
    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Amount</label>
        <input class="input" type="number" inputmode="decimal" id="f-amt" value="${d.amount||''}"></div>
      <div><label class="label">How often</label>
        <select class="select" id="f-freq">${freqOptions(d.freq, true)}</select></div>
    </div>

    <label class="label" style="margin-top:16px">Category</label>
    <div class="chips">${s0.categories.map(c =>
      `<button class="chip ${d.category===c?'on':''}" data-act="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>

    <label class="label" style="margin-top:16px">Comes out of</label>
    <div class="chips">${bankChips(d.bank,'bank')}</div>

    <label class="label" style="margin-top:16px">Type</label>
    <div class="chips">
      ${[['need','Need'],['want','Want'],['save','Savings']].map(([v,l]) =>
        `<button class="chip ${d.kind===v?'on':''}" data-act="kind" data-v="${v}">${l}</button>`).join('')}
    </div>

    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">${isNew?'Add':'Save'}</button>
    ${!isNew ? `<button class="btn btn-ghost block" style="color:var(--bad)" data-act="rm">Delete</button>` : ''}
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  let kind = d.kind, cat = d.category, bank = d.bank;
  const pick = (el) => el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c===el));
  bindActions(document.querySelector('.sheet'), {
    kind: (dd, el) => { kind = dd.v; pick(el); },
    cat:  (dd, el) => { cat  = dd.v; pick(el); },
    bank: (dd, el) => { bank = dd.v; pick(el); },
    save: () => {
      const name = sheetVal('f-name').trim(), amt = sheetNum('f-amt');
      if (!name || amt <= 0){ toast('Name and amount, please'); return; }
      const obj = { id: r?.id || uid(), name, amount:amt, freq:sheetVal('f-freq'), kind, category:cat, bank };
      store.update(s => {
        const i = s.recurring.findIndex(x => x.id === obj.id);
        if (i >= 0) s.recurring[i] = obj; else s.recurring.push(obj);
      });
      closeSheet(); toast('Saved'); render();
    },
    rm: () => {
      store.update(s => { s.recurring = s.recurring.filter(x => x.id !== r.id); });
      closeSheet(); toast('Deleted'); render();
    },
    close: closeSheet,
  });
}

function editGoal(g){
  const isNew = !g;
  const d = g || { name:'', target:0, saved:0, monthly:0, bank:store.get().banks[0], note:'' };
  openSheet(`
    <h2>${isNew ? 'New goal' : 'Edit goal'}</h2>
    <p class="sub">Where your leftover money should go, and how much each month.</p>
    <label class="label">Goal</label>
    <input class="input" id="g-name" value="${esc(d.name)}" placeholder="House deposit, emergency buffer…">
    <div class="grid2" style="margin-top:12px">
      <div><label class="label">Target</label>
        <input class="input" type="number" inputmode="numeric" id="g-target" value="${d.target||''}"></div>
      <div><label class="label">Saved so far</label>
        <input class="input" type="number" inputmode="numeric" id="g-saved" value="${d.saved||''}"></div>
    </div>
    <label class="label" style="margin-top:16px">Transfer each month</label>
    <input class="input" type="number" inputmode="numeric" id="g-monthly" value="${d.monthly||''}" placeholder="0">
    <div class="tiny muted" style="margin-top:6px">This is what appears in the transfer plan on the Plan tab.</div>

    <label class="label" style="margin-top:16px">Held in</label>
    <div class="chips">${bankChips(d.bank,'bank')}</div>

    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">${isNew?'Add':'Save'}</button>
    ${!isNew ? `<button class="btn btn-ghost block" style="color:var(--bad)" data-act="rm">Delete</button>` : ''}
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  let bank = d.bank;
  bindActions(document.querySelector('.sheet'), {
    bank: (dd, el) => { bank = dd.v; el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c===el)); },
    save: () => {
      const name = sheetVal('g-name').trim();
      if (!name){ toast('Name it'); return; }
      const obj = { id: g?.id || uid(), name, target:sheetNum('g-target'), saved:sheetNum('g-saved'),
                    monthly:sheetNum('g-monthly'), bank, note:'' };
      store.update(s => {
        const i = s.goals.findIndex(x => x.id === obj.id);
        if (i >= 0) s.goals[i] = obj; else s.goals.push(obj);
      });
      closeSheet(); toast('Saved'); render();
    },
    rm: () => {
      store.update(s => { s.goals = s.goals.filter(x => x.id !== g.id); });
      closeSheet(); toast('Deleted'); render();
    },
    close: closeSheet,
  });
}

/* ---------------- settings: banks & categories ---------------- */
function openSettings(){
  const s = store.get();
  openSheet(`
    <h2>Ledger settings</h2>
    <p class="sub">Your accounts and categories. Removing one leaves existing items untouched.</p>

    <label class="label">Bank accounts</label>
    <div class="chips">
      ${s.banks.map(b => `<button class="chip" data-act="rmbank" data-v="${esc(b)}">${esc(b)} ✕</button>`).join('')}
    </div>
    <div class="row" style="margin-top:10px;gap:8px">
      <input class="input grow" id="new-bank" placeholder="Add an account">
      <button class="btn btn-soft btn-sm" data-act="addbank">Add</button>
    </div>

    <label class="label" style="margin-top:20px">Categories</label>
    <div class="chips">
      ${s.categories.map(c => `<button class="chip" data-act="rmcat" data-v="${esc(c)}">${esc(c)} ✕</button>`).join('')}
    </div>
    <div class="row" style="margin-top:10px;gap:8px">
      <input class="input grow" id="new-cat" placeholder="Add a category">
      <button class="btn btn-soft btn-sm" data-act="addcat">Add</button>
    </div>

    <button class="btn btn-ghost block" style="margin-top:20px" data-act="close">Done</button>
  `);
  const reopen = () => { closeSheet(); setTimeout(openSettings, 160); };
  bindActions(document.querySelector('.sheet'), {
    addbank: () => {
      const v = sheetVal('new-bank').trim();
      if (!v) return;
      store.update(st => { if (!st.banks.includes(v)) st.banks.push(v); });
      reopen();
    },
    rmbank: d => { store.update(st => { st.banks = st.banks.filter(b => b !== d.v); }); reopen(); },
    addcat: () => {
      const v = sheetVal('new-cat').trim();
      if (!v) return;
      store.update(st => { if (!st.categories.includes(v)) st.categories.push(v); });
      reopen();
    },
    rmcat: d => { store.update(st => { st.categories = st.categories.filter(c => c !== d.v); }); reopen(); },
    close: () => { closeSheet(); render(); },
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    settings: openSettings,
    addincome: () => editIncome(null),
    editincome: d => editIncome(store.get().incomes.find(x => x.id === d.id)),
    addfixed: () => editFixed(null),
    editfixed: d => editFixed(store.get().recurring.find(x => x.id === d.id)),
    addgoal: () => editGoal(null),
    editgoal: d => editGoal(store.get().goals.find(x => x.id === d.id)),
    gotogoals: () => { tab = 'goals'; render(); },
    addsc: () => editScenario(null),
    opensc: d => openScenario(d.id),
  });
}
