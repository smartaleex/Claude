/* ============================================================
   Shout — the mates roster.

   The core idea: friendships don't fail from lack of care, they fail
   from lack of prompting. So every mate gets a cadence, and the app's
   only real job is to surface who has quietly gone too long.

   AI does the two things that are genuinely hard: writing the opening
   message when you can't find the words, and suggesting something to
   actually do rather than another vague "we should catch up".
   ============================================================ */

import { Slice, today, dayKey, daysBetween, uid, fmtDayShort, shiftDay } from '../core/store.js';
import { ask } from '../core/ai.js';
import {
  esc, toast, openSheet, closeSheet, sheetVal, sheetNum, bindActions,
  empty, stat, haptic, avatarStyle, initials, num,
} from '../core/ui.js';

const store = new Slice('shout', {
  mates: [],    // { id, name, cadence, lastSeen, note, tags:[] }
  plans: [],    // { id, mateIds, what, when, done }
});

let tab = 'roster';
let root = null;

/* Weighted toward the short end — the whole point is catching drift
   early, and "every few months" is long enough that a friendship can
   quietly lapse before the app says anything. */
const CADENCES = [
  { v:3,   l:'Every few days' },
  { v:7,   l:'Weekly' },
  { v:10,  l:'Every 10 days' },
  { v:14,  l:'Fortnightly' },
  { v:21,  l:'Every 3 weeks' },
  { v:30,  l:'Monthly' },
  { v:60,  l:'Every 2 months' },
  { v:90,  l:'Quarterly' },
];
const cadenceLabel = v => CADENCES.find(c => c.v === v)?.l
  || (v % 7 === 0 ? `Every ${v/7} weeks` : `Every ${v} days`);

/* How overdue is this mate, as a ratio of their own cadence?
   Ratio rather than raw days, so a weekly mate at 10 days ranks above
   a twice-a-year mate at 40. */
function overdueRatio(m){
  if (!m.lastSeen) return 2;
  return daysBetween(m.lastSeen, today()) / m.cadence;
}
const sinceDays = m => m.lastSeen ? daysBetween(m.lastSeen, today()) : null;

const sortedMates = () => [...store.get().mates].sort((a,b) => overdueRatio(b) - overdueRatio(a));
const overdue = () => sortedMates().filter(m => overdueRatio(m) >= 1);

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  const ms = store.get().mates;
  if (!ms.length) return { headline:'No mates yet', detail:'Add the people you want to keep close' };
  const od = overdue();
  return {
    headline: od.length ? `${od.length} to reach out to` : 'All good',
    detail: od.length ? `Longest: ${od[0].name}, ${sinceDays(od[0])} days` : `${ms.length} mates, nobody overdue`,
    badge: od.length ? String(od.length) : null,
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
        <div class="eyebrow">Mates · Shout</div>
        <h1 class="page-h1">${tab==='roster' ? 'The roster' : 'Plans'}</h1>
      </div>
      <button class="chip" data-act="addmate">+ Mate</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:16px 0">
    ${[['roster','Roster'],['plans','Plans']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='roster' ? rosterHTML() : plansHTML()}`;
  bind();
}

/* ---------------- roster ---------------- */
function rosterHTML(){
  const ms = sortedMates();
  if (!ms.length) return `
    <div class="card in">
      <div class="card-title">Who matters?</div>
      <p class="card-note" style="margin:8px 0 14px">
        Add the people you'd be gutted to drift from. Set how often you want to see them,
        and this will tell you when it's been too long.
      </p>
      <button class="btn btn-primary block" data-act="addmate">Add your first mate</button>
    </div>`;

  const od = ms.filter(m => overdueRatio(m) >= 1);
  const ok = ms.filter(m => overdueRatio(m) < 1);

  return `
  <div class="grid2 in" style="margin-bottom:16px">
    ${stat(num(ms.length), 'Mates')}
    ${stat(num(od.length), 'Overdue', od.length ? 'var(--warn)' : 'var(--good)')}
  </div>

  ${od.length ? `<div class="sec">Been too long</div>
  <div class="stack" style="gap:9px">${od.map(mateRow).join('')}</div>` : `
  <div class="card in" style="background:var(--good-tint);border-color:transparent">
    <div class="card-title" style="color:var(--good)">Nobody's drifting</div>
    <div class="card-note" style="margin-top:4px">Everyone's within their cadence. Rare and good.</div>
  </div>`}

  ${ok.length ? `<div class="sec">All good</div>
  <div class="stack" style="gap:9px">${ok.map(mateRow).join('')}</div>` : ''}`;
}

function mateRow(m){
  const days = sinceDays(m);
  const r = overdueRatio(m);
  const tone = r >= 1.6 ? 'bad' : r >= 1 ? 'warn' : 'good';
  return `
  <button class="rowcard" data-act="openmate" data-id="${m.id}" style="width:100%;text-align:left">
    <div class="av" style="${avatarStyle(m.name)}">${esc(initials(m.name))}</div>
    <div class="grow">
      <div class="spread" style="align-items:baseline">
        <b>${esc(m.name)}</b>
        <span class="badge ${tone}">${days === null ? 'never' : days + 'd'}</span>
      </div>
      <span class="sub">${esc(cadenceLabel(m.cadence))}${m.note ? ' · ' + esc(m.note) : ''}</span>
    </div>
    <span class="caret">›</span>
  </button>`;
}

/* ---------------- plans ---------------- */
function plansHTML(){
  const ps = store.get().plans.filter(p => !p.done).sort((a,b) => (a.when||'').localeCompare(b.when||''));
  const done = store.get().plans.filter(p => p.done).slice(-8).reverse();
  const mates = store.get().mates;
  const nameOf = id => mates.find(m => m.id === id)?.name || 'someone';

  return `
  <button class="btn btn-primary block in" data-act="addplan">+ New plan</button>

  ${!ps.length ? empty('📅','Nothing planned.<br>Vague intentions don\'t survive a busy week — put a date on it.') :
    `<div class="sec">Coming up</div><div class="stack" style="gap:9px">${ps.map(p => `
      <div class="rowcard">
        <div class="grow">
          <b>${esc(p.what)}</b>
          <span class="sub">${esc((p.mateIds||[]).map(nameOf).join(', '))}${p.when ? ' · ' + esc(fmtDayShort(p.when)) : ''}</span>
        </div>
        <button class="btn btn-soft btn-sm" data-act="doneplan" data-id="${p.id}">Done</button>
      </div>`).join('')}</div>`}

  ${done.length ? `<div class="sec">Recently done</div>
    <div class="stack" style="gap:8px">${done.map(p => `
      <div class="rowcard" style="opacity:.6">
        <div class="grow"><b>${esc(p.what)}</b>
          <span class="sub">${esc((p.mateIds||[]).map(nameOf).join(', '))}</span></div>
      </div>`).join('')}</div>` : ''}`;
}

/* ---------------- mate detail ---------------- */
function openMate(id){
  const m = store.get().mates.find(x => x.id === id);
  if (!m) return;
  const days = sinceDays(m);

  openSheet(`
    <div class="row" style="margin-bottom:14px">
      <div class="av" style="${avatarStyle(m.name)};width:52px;height:52px;font-size:18px">${esc(initials(m.name))}</div>
      <div class="grow">
        <h2 style="margin:0">${esc(m.name)}</h2>
        <div class="tiny muted">${esc(cadenceLabel(m.cadence))} · ${days === null ? 'never logged' : `${days} days since you caught up`}</div>
      </div>
    </div>

    ${m.note ? `<div class="card tight sunk" style="margin-bottom:14px">
      <div class="tiny muted" style="line-height:1.6">${esc(m.note)}</div></div>` : ''}

    <button class="btn btn-primary block" data-act="sawthem">✓ Caught up today</button>

    <div class="grid2" style="margin-top:10px;gap:8px">
      <button class="btn btn-plain" data-act="draft">✨ Draft a text</button>
      <button class="btn btn-plain" data-act="ideas">✨ Plan ideas</button>
    </div>

    <div id="mate-ai"></div>

    <button class="btn btn-plain block" style="margin-top:14px" data-act="edit">Edit</button>
    <button class="btn btn-ghost block" style="color:var(--bad)" data-act="rm">Remove</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    sawthem: () => {
      store.update(s => { s.mates.find(x => x.id === id).lastSeen = today(); });
      closeSheet(); haptic(); toast(`Logged — ${m.name} ✓`); render();
    },
    edit: () => { closeSheet(); setTimeout(() => editMate(m), 200); },
    rm: () => {
      store.update(s => { s.mates = s.mates.filter(x => x.id !== id); });
      closeSheet(); toast('Removed'); render();
    },
    draft: (d, btn) => runAI(btn, 'draft', m),
    ideas: (d, btn) => runAI(btn, 'ideas', m),
  });
}

async function runAI(btn, kind, m){
  const label = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin dark"></span>`;
  const days = sinceDays(m);
  const gap = days === null ? 'a long time' : `${days} days`;

  const prompts = {
    draft: `Write 3 short text messages to send to a mate called ${m.name}. It's been ${gap} since we caught up.
${m.note ? `Context about them: ${m.note}` : ''}
Rules: Australian, casual, how a bloke actually texts a mate. No corporate warmth, no "hope this finds you well", no excessive exclamation marks. Short. One should suggest something specific to do, one should be a light check-in, one should be funny about the gap.
Respond with ONLY this JSON:
{"options":[{"tone":"one word","text":"the message"}]}`,

    ideas: `Suggest 4 specific things to do with a mate in Sydney, Australia.
${m.note ? `About them: ${m.note}` : ''}
It's been ${gap}. Mix effort levels: at least one that takes ten minutes to organise, one that's a proper outing.
Be specific — name types of places or activities, not "grab a coffee sometime".
Respond with ONLY this JSON:
{"ideas":[{"what":"the plan","why":"one short line on why it works","effort":"low|medium|high"}]}`,
  };

  const offlines = {
    draft: () => ({ options: [
      { tone:'direct', text:`Oi ${m.name}, been way too long. Free for a beer this week?` },
      { tone:'light',  text:`${m.name}! You alive? Long overdue for a catch up.` },
      { tone:'funny',  text:`Genuinely can't remember the last time I saw you. Fix it? This weekend?` },
    ]}),
    ideas: () => ({ ideas: [
      { what:'Walk and coffee — Bay Run or Coogee to Bondi', why:'Zero planning, and walking makes talking easier.', effort:'low' },
      { what:'Weeknight pub feed somewhere central', why:'Low commitment, easy to say yes to on short notice.', effort:'low' },
      { what:'Go watch something — game, gig, or a film', why:'Takes the pressure off having to fill the silence.', effort:'medium' },
      { what:'Day trip out of the city', why:'The kind of thing that actually resets a friendship.', effort:'high' },
    ]}),
  };

  try{
    const res = await ask({ prompt: prompts[kind], offline: offlines[kind] });
    const out = document.getElementById('mate-ai');
    if (kind === 'draft'){
      out.innerHTML = `<div style="margin-top:12px">${(res.data.options||[]).map(o => `
        <div class="card tight sunk" style="margin-bottom:8px">
          <div class="spread" style="align-items:flex-start">
            <div class="grow">
              <span class="badge accent">${esc(o.tone)}</span>
              <div style="font-size:14.5px;margin-top:7px;line-height:1.5">${esc(o.text)}</div>
            </div>
          </div>
          <button class="btn btn-soft btn-sm block" style="margin-top:10px"
                  data-act="copy" data-t="${esc(o.text)}">Copy</button>
        </div>`).join('')}</div>`;
    } else {
      out.innerHTML = `<div style="margin-top:12px">${(res.data.ideas||[]).map(i => `
        <div class="card tight sunk" style="margin-bottom:8px">
          <div class="spread" style="align-items:baseline">
            <b style="font-size:14.5px">${esc(i.what)}</b>
            <span class="badge ${i.effort==='low'?'good':i.effort==='high'?'warn':'neutral'}">${esc(i.effort)}</span>
          </div>
          <div class="tiny muted" style="margin-top:4px">${esc(i.why)}</div>
          <button class="btn btn-soft btn-sm block" style="margin-top:10px"
                  data-act="makeplan" data-w="${esc(i.what)}" data-m="${m.id}">Make it a plan</button>
        </div>`).join('')}</div>`;
    }

    // These buttons live inside the sheet, which already has a handler
    // map; extend it rather than rebinding the whole sheet.
    bindActions(document.querySelector('.sheet'), {
      ...currentSheetHandlers(m),
      copy: async d => {
        try{ await navigator.clipboard.writeText(d.t); toast('Copied ✓'); }
        catch{ toast('Copy failed — select and copy manually'); }
      },
      makeplan: d => {
        store.update(s => s.plans.push({ id:uid(), mateIds:[d.m], what:d.w, when:shiftDay(today(),7), done:false }));
        closeSheet(); toast('Added to plans'); tab='plans'; render();
      },
    });
  }catch(e){
    toast(e.message || 'Could not reach AI');
  }finally{
    btn.disabled = false;
    btn.innerHTML = label;
  }
}

/* Rebuild the mate-sheet handler map so extending it doesn't drop the originals. */
function currentSheetHandlers(m){
  return {
    close: closeSheet,
    sawthem: () => {
      store.update(s => { s.mates.find(x => x.id === m.id).lastSeen = today(); });
      closeSheet(); haptic(); toast(`Logged — ${m.name} ✓`); render();
    },
    edit: () => { closeSheet(); setTimeout(() => editMate(m), 200); },
    rm: () => {
      store.update(s => { s.mates = s.mates.filter(x => x.id !== m.id); });
      closeSheet(); toast('Removed'); render();
    },
    draft: (d, btn) => runAI(btn, 'draft', m),
    ideas: (d, btn) => runAI(btn, 'ideas', m),
  };
}

/* ---------------- edit ---------------- */
function editMate(m){
  const isNew = !m;
  const d = m || { name:'', cadence:30, lastSeen:'', note:'' };
  openSheet(`
    <h2>${isNew ? 'Add a mate' : 'Edit'}</h2>
    <p class="sub">Cadence is how often you'd like to actually see them.</p>

    <label class="label">Name</label>
    <input class="input" id="m-name" value="${esc(d.name)}" placeholder="First name is fine">

    <label class="label" style="margin-top:16px">How often</label>
    <div class="chips" id="m-cad">
      ${CADENCES.map(c => `<button class="chip ${c.v===d.cadence?'on':''}" data-act="cad" data-v="${c.v}">${c.l}</button>`).join('')}
    </div>
    <div class="row" style="margin-top:10px;gap:8px;align-items:center">
      <span class="tiny muted nowrap">Or every</span>
      <input class="input" type="number" inputmode="numeric" min="1" id="m-cad-custom"
             value="${CADENCES.some(c => c.v === d.cadence) ? '' : d.cadence}"
             placeholder="…" style="width:80px;text-align:center;padding:9px">
      <span class="tiny muted nowrap">days</span>
    </div>

    <label class="label" style="margin-top:16px">Last caught up</label>
    <input class="input" type="date" id="m-last" value="${d.lastSeen||''}" max="${today()}">

    <label class="label" style="margin-top:16px">Anything worth remembering</label>
    <textarea class="textarea" id="m-note" placeholder="How you know them, what they're into, what's going on for them right now">${esc(d.note||'')}</textarea>
    <div class="tiny muted" style="margin-top:6px">This is what makes the drafted texts sound like you actually know them.</div>

    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">${isNew?'Add':'Save'}</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  let cad = d.cadence;
  bindActions(document.querySelector('.sheet'), {
    cad: (dd, el) => {
      cad = +dd.v;
      const custom = document.getElementById('m-cad-custom');
      if (custom) custom.value = '';        // a preset overrides a typed value
      el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    },
    save: () => {
      const name = sheetVal('m-name').trim();
      if (!name){ toast('Name?'); return; }
      const typed = parseInt(sheetVal('m-cad-custom'), 10);
      if (Number.isFinite(typed) && typed > 0) cad = typed;
      const obj = { id: m?.id || uid(), name, cadence: cad,
                    lastSeen: sheetVal('m-last') || '', note: sheetVal('m-note').trim() };
      store.update(s => {
        const i = s.mates.findIndex(x => x.id === obj.id);
        if (i >= 0) s.mates[i] = obj; else s.mates.push(obj);
      });
      closeSheet(); toast(isNew ? 'Added' : 'Saved'); render();
    },
    close: closeSheet,
  });
}

function addPlan(){
  const mates = store.get().mates;
  if (!mates.length){ toast('Add a mate first'); return; }
  const sel = new Set();
  openSheet(`
    <h2>New plan</h2>
    <p class="sub">A date beats an intention.</p>
    <label class="label">What</label>
    <input class="input" id="p-what" placeholder="Beers at the Courthouse">
    <label class="label" style="margin-top:16px">Who</label>
    <div class="chips">
      ${mates.map(m => `<button class="chip" data-act="who" data-id="${m.id}">${esc(m.name)}</button>`).join('')}
    </div>
    <label class="label" style="margin-top:16px">When</label>
    <input class="input" type="date" id="p-when" value="${shiftDay(today(),7)}">
    <button class="btn btn-primary block" style="margin-top:18px" data-act="save">Add plan</button>
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    who: (d, el) => {
      sel.has(d.id) ? sel.delete(d.id) : sel.add(d.id);
      el.classList.toggle('on', sel.has(d.id));
    },
    save: () => {
      const what = sheetVal('p-what').trim();
      if (!what){ toast('What are you doing?'); return; }
      store.update(s => s.plans.push({ id:uid(), mateIds:[...sel], what, when:sheetVal('p-when'), done:false }));
      closeSheet(); toast('Planned ✓'); render();
    },
    close: closeSheet,
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    addmate: () => editMate(null),
    openmate: d => openMate(d.id),
    addplan: addPlan,
    doneplan: d => {
      // Completing a plan also counts as having seen everyone on it.
      store.update(s => {
        const p = s.plans.find(x => x.id === d.id);
        if (p){
          p.done = true;
          (p.mateIds||[]).forEach(id => {
            const m = s.mates.find(x => x.id === id);
            if (m) m.lastSeen = today();
          });
        }
      });
      haptic(); toast('Nice ✓'); render();
    },
  });
}
