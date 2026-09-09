/* ============================================================
   Cryptic — one clue a day.

   The brief was a puzzle like Wordle or Connections: small, finishable,
   the same for everyone, and over in a couple of minutes. One cryptic
   clue is a better fit than a whole crossword — a grid is a thirty
   minute commitment and turns into another thing you are behind on.

   Two rules shape the whole thing:

   1. It ends. One clue, and when it is done it is done. There is no
      "next" button dragging you into a second session.
   2. Hints are free and un-penalised. Every hint ladder that punishes
      you for taking help teaches you to sit there feeling stupid
      instead. The point is learning how the wordplay works, so the
      explanation is the reward, not the consolation prize.

   Which is also why a solved clue and a revealed clue both show the
   full parsing. Understanding why DESSERTS is STRESSED backwards is
   the thing worth keeping.
   ============================================================ */

import { Slice, today, dayKey, shiftDay, daysBetween, fmtDayShort } from '../core/store.js';
import {
  esc, num, toast, bindActions, empty, stat, haptic, openSheet, closeSheet,
} from '../core/ui.js';
import { icon } from '../core/icons.js';
import { CLUES, DEVICES, SHORTHAND, clueFor, clueIndexFor } from '../data/cryptic.js';

const store = new Slice('cryptic', {
  plays: {},        // dayKey -> { answer, solved, revealed, hints, tries }
});

let tab = 'today';
let root = null;
let draft = '';           // what is typed but not yet checked
let shake = false;        // one-shot wrong-answer animation

/* ---------------- helpers ---------------- */
const playOn = d => store.get().plays[d] || null;
const isDone = d => { const p = playOn(d); return !!p && (p.solved || p.revealed); };

function recordPlay(d, patch){
  store.update(s => {
    s.plays[d] = { answer:'', solved:false, revealed:false, hints:0, tries:0,
                   ...(s.plays[d] || {}), ...patch };
  });
}

const solvedCount = () => Object.values(store.get().plays).filter(p => p.solved).length;

/* Played days, not calendar days. Skipping a Tuesday you never opened
   should not read as a failure — there was nothing to fail. */
function streak(){
  let n = 0, d = today();
  if (!playOn(d)?.solved) d = shiftDay(d, -1);
  while (playOn(d)?.solved){ n++; d = shiftDay(d, -1); }
  return n;
}

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  const d = today(), p = playOn(d), c = clueFor(d);
  if (p?.solved)  return { headline:'Solved', detail:`${c.answer} · ${DEVICES[c.device].name.toLowerCase()}`, badge:null };
  if (p?.revealed)return { headline:'Answer shown', detail:`It was ${c.answer}`, badge:null };
  return {
    headline: "Today's clue",
    detail: `${c.clue}`,
    badge: 'New',
    chips: [{ label:'Solve it', act:'cryptic-go' }],
  };
}

/* ---------------- mount ---------------- */
export async function mount(el, sub){
  root = el;
  await store.load();
  if (sub === 'learn') tab = 'learn';
  draft = '';
  render();
}

function render(){
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Cryptic</div>
        <h1 class="page-h1">${tab==='today' ? 'One clue' : tab==='archive' ? 'Past clues' : 'How it works'}</h1>
      </div>
      <button class="chip" data-act="tab" data-v="learn" aria-label="How it works">${icon('note',18)}</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:14px 0">
    ${[['today','Today'],['archive','Archive'],['learn','Learn']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='today' ? todayHTML() : tab==='archive' ? archiveHTML() : learnHTML()}`;
  bind();
  if (tab === 'today' && !isDone(today())) focusInput();
}

/* ---------------- today ---------------- */
function todayHTML(){
  const d = today(), c = clueFor(d), p = playOn(d) || {};
  const done = isDone(d);
  const n = c.answer.length;
  const shown = (done ? c.answer : draft).padEnd(n, ' ');

  return `
  <div class="card in" style="text-align:center;padding:26px 20px">
    <div class="tiny muted" style="letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px">
      ${esc(fmtDayShort(d))}
    </div>
    <div style="font-family:'Sora',sans-serif;font-size:21px;font-weight:700;line-height:1.45;letter-spacing:-.01em">
      ${esc(c.clue.replace(c.enumeration, '').trim())}
    </div>
    <div class="badge accent" style="margin-top:12px">${esc(c.enumeration)}</div>
  </div>

  ${done ? '' : `
  <!-- A real input sits under the boxes so the phone keyboard opens and
       autocorrect stays off; the boxes are just its display. -->
  <div class="cx-wrap in in-2" data-act="focus">
    <input id="cx-input" class="cx-input" maxlength="${n}" autocomplete="off"
           autocapitalize="characters" autocorrect="off" spellcheck="false"
           inputmode="text" aria-label="Your answer">
    <div class="cx-grid ${shake?'shake':''}" id="cx-grid">
      ${[...Array(n)].map((_, i) => `
        <span class="cx-box ${shown[i].trim() ? 'filled' : ''}">${esc(shown[i].trim())}</span>`).join('')}
    </div>
  </div>

  <div class="row in in-2" style="margin-top:14px">
    <button class="btn btn-primary grow" data-act="check">Check</button>
    <button class="btn btn-plain" data-act="hint">${icon('spark',16)} Hint</button>
  </div>`}

  ${hintsHTML(c, p)}

  ${done ? solvedHTML(c, p) : `
    <button class="btn btn-ghost block" style="margin-top:18px;color:var(--muted)" data-act="reveal">
      Show me the answer
    </button>`}

  <div class="grid2" style="margin-top:20px">
    ${stat(num(solvedCount()), 'Solved')}
    ${stat(num(streak()), 'In a row', streak() ? 'var(--good)' : undefined)}
  </div>`;
}

/* The ladder: what kind of clue → where the definition is → a nudge at
   the mechanism. Never the answer; that is its own button. */
function hintList(c){
  return [
    { label:'What kind of clue is this?',
      body:`<b>${esc(DEVICES[c.device].name)}.</b> ${esc(DEVICES[c.device].idea)}` },
    { label:'Where is the definition?',
      body: c.def === 'both halves'
        ? 'Both halves of the clue define the answer independently. There is no wordplay to unpick.'
        : `The definition is <b>&ldquo;${esc(c.def)}&rdquo;</b>. Everything else is wordplay.` },
    { label:'Nudge me',
      body: esc(c.nudge) },
  ];
}

function hintsHTML(c, p){
  const taken = p.hints || 0;
  if (!taken) return '';
  const list = hintList(c);
  return `<div class="stack" style="gap:9px;margin-top:14px">
    ${list.slice(0, taken).map((h, i) => `
      <div class="card tight sunk">
        <div class="tiny muted" style="margin-bottom:5px">Hint ${i+1} · ${esc(h.label)}</div>
        <div style="font-size:14px;line-height:1.6">${h.body}</div>
      </div>`).join('')}
  </div>`;
}

function solvedHTML(c, p){
  const dev = DEVICES[c.device];
  const good = p.solved;
  return `
  <div class="card in" style="margin-top:16px;background:${good?'var(--good-tint)':'var(--surface-2)'};border-color:transparent">
    <div class="spread" style="align-items:center">
      <div>
        <div class="tiny muted">${good ? 'Solved' : 'The answer was'}</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:26px;letter-spacing:.04em;
                    color:${good?'var(--good)':'var(--ink)'};margin-top:2px">${esc(c.answer)}</div>
      </div>
      ${good ? `<span style="color:var(--good)">${icon('check',30)}</span>` : ''}
    </div>
  </div>

  <div class="sec">How it works</div>
  <div class="card">
    <span class="badge accent">${esc(dev.name)}</span>
    <div style="font-size:14.5px;line-height:1.65;margin-top:11px">${esc(c.wordplay)}</div>
    ${c.def === 'both halves' ? '' : `
      <div class="tiny muted" style="margin-top:10px;line-height:1.6">
        Definition: &ldquo;${esc(c.def)}&rdquo;
      </div>`}
  </div>

  <div class="card tight sunk" style="margin-top:10px">
    <div class="tiny muted" style="line-height:1.6"><b>${esc(dev.name)}:</b> ${esc(dev.tell)}</div>
  </div>

  <button class="btn btn-plain block" style="margin-top:16px" data-act="tab" data-v="learn">
    See all nine devices
  </button>
  <div class="center tiny muted" style="margin-top:14px">Next clue tomorrow.</div>`;
}

/* ---------------- archive ---------------- */
function archiveHTML(){
  const plays = store.get().plays;
  const days = Object.keys(plays).sort().reverse();
  if (!days.length) return empty(icon('puzzle',34), "Nothing played yet.<br>Today's clue is on the first tab.");

  return `
  <div class="grid2 in" style="margin-bottom:16px">
    ${stat(num(solvedCount()), 'Solved')}
    ${stat(num(days.filter(d => plays[d].revealed).length), 'Revealed', 'var(--muted)')}
  </div>
  <div class="stack" style="gap:9px">
    ${days.map(d => {
      const p = plays[d], c = clueFor(d);
      const tone = p.solved ? 'good' : p.revealed ? 'neutral' : 'warn';
      const label = p.solved ? 'Solved' : p.revealed ? 'Shown' : 'Open';
      return `<button class="rowcard" data-act="openpast" data-d="${d}" style="width:100%;text-align:left">
        <div class="grow" style="min-width:0">
          <b style="font-size:14px">${esc(c.clue)}</b>
          <span class="sub">${esc(fmtDayShort(d))} · ${esc(DEVICES[c.device].name)}</span>
        </div>
        <span class="badge ${tone}">${label}</span>
        <span class="caret">${icon('chevron',15)}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function openPast(d){
  const c = clueFor(d), p = playOn(d) || {};
  const dev = DEVICES[c.device];
  openSheet(`
    <div class="tiny muted">${esc(fmtDayShort(d))}</div>
    <h2 style="margin:4px 0 2px">${esc(c.answer)}</h2>
    <p class="sub" style="margin-bottom:14px">${esc(c.clue)}</p>
    <div class="card tight sunk">
      <span class="badge accent">${esc(dev.name)}</span>
      <div style="font-size:14px;line-height:1.65;margin-top:10px">${esc(c.wordplay)}</div>
    </div>
    <div class="tiny muted" style="margin-top:12px;line-height:1.6">
      ${p.solved ? `You got it${p.hints ? ` with ${p.hints} hint${p.hints>1?'s':''}` : ' unaided'}.`
                 : 'You had this one revealed.'}
    </div>
    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), { close: closeSheet });
}

/* ---------------- learn ---------------- */
function learnHTML(){
  return `
  <p class="card-note in" style="margin-bottom:16px;line-height:1.65">
    Every cryptic clue is the same shape: <b>a definition at one end, and wordplay
    that builds the same answer a second way</b>. The whole skill is spotting where
    one stops and the other starts.
  </p>

  <div class="stack" style="gap:10px">
    ${Object.entries(DEVICES).map(([k, dv]) => `
      <div class="card">
        <div class="card-title">${esc(dv.name)}</div>
        <div style="font-size:14px;line-height:1.6;margin-top:6px">${esc(dv.idea)}</div>
        <div class="tiny muted" style="margin-top:9px;line-height:1.6"><b>Tell:</b> ${esc(dv.tell)}</div>
        <div class="card tight sunk" style="margin-top:10px">
          <div class="tiny" style="line-height:1.6">${esc(dv.example)}</div>
        </div>
      </div>`).join('')}
  </div>

  <div class="sec">Shorthand worth knowing</div>
  <p class="card-note" style="margin-bottom:12px">
    Half of solving is recognising that &ldquo;learner&rdquo; means L.
  </p>
  <div class="card">
    <div style="display:grid;grid-template-columns:1fr auto;gap:9px 14px;font-size:13.5px">
      ${SHORTHAND.map(([word, abbr]) => `
        <span class="muted">${esc(word)}</span>
        <b class="mono" style="color:var(--accent-1)">${esc(abbr)}</b>`).join('')}
    </div>
  </div>`;
}

/* ---------------- input ---------------- */
function focusInput(){
  const inp = document.getElementById('cx-input');
  if (!inp) return;
  inp.value = draft;
  inp.oninput = () => {
    draft = inp.value.toUpperCase().replace(/[^A-Z]/g, '');
    inp.value = draft;
    paintBoxes();
  };
  inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); check(); } };
}

/* Repainting the boxes directly rather than re-rendering — a full render
   would drop the keyboard on every keystroke. */
function paintBoxes(){
  const grid = document.getElementById('cx-grid');
  if (!grid) return;
  const boxes = [...grid.children];
  boxes.forEach((b, i) => {
    const ch = draft[i] || '';
    b.textContent = ch;
    b.classList.toggle('filled', !!ch);
  });
}

function check(){
  const d = today(), c = clueFor(d);
  if (draft.length < c.answer.length){ toast(`${c.answer.length} letters`); return; }

  const tries = (playOn(d)?.tries || 0) + 1;
  if (draft === c.answer){
    recordPlay(d, { answer:draft, solved:true, tries });
    haptic(30);
    toast('Got it ✓');
    draft = '';
    render();
    return;
  }

  recordPlay(d, { tries });
  haptic();
  shake = true;
  render();
  setTimeout(() => { shake = false; const g = document.getElementById('cx-grid'); g?.classList.remove('shake'); }, 500);
}

/* ---------------- binding ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; render(); },
    focus: () => document.getElementById('cx-input')?.focus(),
    check,
    hint: () => {
      const d = today(), c = clueFor(d);
      const taken = playOn(d)?.hints || 0;
      if (taken >= hintList(c).length){ toast('That is all of them'); return; }
      recordPlay(d, { hints: taken + 1 });
      haptic();
      render();
    },
    reveal: () => {
      const d = today(), c = clueFor(d);
      openSheet(`
        <h2>Show the answer?</h2>
        <p class="sub">You will still get the full explanation — that is the useful part either way.</p>
        <button class="btn btn-primary block" style="margin-top:16px" data-act="yes">Show me</button>
        <button class="btn btn-ghost block" data-act="close">Keep trying</button>
      `);
      bindActions(document.querySelector('.sheet'), {
        close: closeSheet,
        yes: () => { recordPlay(d, { revealed:true }); closeSheet(); draft=''; render(); },
      });
    },
    openpast: d => openPast(d.d),
  });
}
