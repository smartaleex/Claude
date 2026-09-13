/* ============================================================
   Cryptic — one clue a day, plus as much practice as you want.

   Two rules shape it:

   1. Hints are free and un-penalised, and a revealed clue gets the same
      full explanation as a solved one. A ladder that charges you for
      help teaches you to sit there feeling stupid; the explanation is
      the reward, not the consolation prize.
   2. The daily is the daily, but running out of puzzle at 7am when you
      need something to do with your head is a failure of the app, not a
      feature. Practice serves unlimited clues and touches no streak.

   On the keyboard: this used to borrow the phone's, with a hidden input
   under the letter boxes. Mobile keyboards fight that arrangement —
   autocapitalise, predictive text and composition events all write to
   the field behind your back, and reassigning .value on every keystroke
   to force uppercase is what broke Backspace. Owning the keyboard means
   delete is just an array pop, and it can't break again.
   ============================================================ */

import { Slice, today, shiftDay, fmtDayShort } from '../core/store.js';
import {
  esc, num, toast, bindActions, empty, stat, haptic, openSheet, closeSheet,
} from '../core/ui.js';
import { icon } from '../core/icons.js';
import { CLUES, DEVICES, SHORTHAND, clueFor, clueIndexFor } from '../data/cryptic.js';

const store = new Slice('cryptic', {
  plays: {},        // dayKey -> { solved, revealed, hints, tries }
  practice: {},     // clue index -> { solved, revealed }
  practiceDone: 0,
});

let tab = 'today';
let root = null;
let draft = '';
let shake = false;
let mode = 'daily';      // 'daily' | 'practice'
let practiceIdx = null;
let pHints = 0;          // hints taken on the current practice clue
let pShown = false;      // answer revealed on the current practice clue

/* ---------------- helpers ---------------- */
const playOn = d => store.get().plays[d] || null;
const isDone = d => { const p = playOn(d); return !!p && (p.solved || p.revealed); };

function recordPlay(d, patch){
  store.update(s => {
    s.plays[d] = { solved:false, revealed:false, hints:0, tries:0,
                   ...(s.plays[d] || {}), ...patch };
  });
}

const solvedCount = () => Object.values(store.get().plays).filter(p => p.solved).length;

/* Played days, not calendar days. A Tuesday you never opened should not
   read as a failure — there was nothing to fail. */
function streak(){
  let n = 0, d = today();
  if (!playOn(d)?.solved) d = shiftDay(d, -1);
  while (playOn(d)?.solved){ n++; d = shiftDay(d, -1); }
  return n;
}

/* Prefer a clue that is neither today's nor already practised. Once the
   bank is exhausted it just goes random rather than refusing to play. */
function pickPractice(){
  const done = store.get().practice;
  const todayIdx = clueIndexFor(today());
  const fresh = CLUES.map((_, i) => i).filter(i => i !== todayIdx && !done[i]);
  const pool = fresh.length ? fresh : CLUES.map((_, i) => i).filter(i => i !== todayIdx);
  return pool[Math.floor(Math.random() * pool.length)];
}

function startPractice(){
  mode = 'practice';
  practiceIdx = pickPractice();
  pHints = 0; pShown = false; draft = '';
  render();
}

/* The clue on screen right now, whichever mode we are in. */
const activeClue = () => mode === 'practice' ? CLUES[practiceIdx] : clueFor(today());
const activeDone = () => mode === 'practice'
  ? (pShown || !!store.get().practice[practiceIdx]?.solved)
  : isDone(today());
const activeHints = () => mode === 'practice' ? pHints : (playOn(today())?.hints || 0);

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  const d = today(), p = playOn(d), c = clueFor(d);
  if (p?.solved)   return { headline:'Solved', detail:`${c.answer} · ${DEVICES[c.device].name.toLowerCase()}`,
                            chips:[{ label:'Practice another', act:'cryptic-practice' }] };
  if (p?.revealed) return { headline:'Answer shown', detail:`It was ${c.answer}`,
                            chips:[{ label:'Practice another', act:'cryptic-practice' }] };
  return {
    headline: "Today's clue",
    detail: c.clue,
    badge: 'New',
    chips: [{ label:'Solve it', act:'cryptic-go' }],
    next: { id:'cryptic', label:"Today's cryptic clue", sub:c.clue,
            act:'cryptic-go', icon:'puzzle', urgency:25 },
  };
}

/* ---------------- mount ---------------- */
export async function mount(el, sub){
  root = el;
  await store.load();
  draft = '';
  if (sub === 'learn') tab = 'learn';
  if (sub === 'practice'){ tab = 'today'; startPractice(); return; }
  render();
}

function paintView(){
  root.innerHTML = `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">Cryptic</div>
        <h1 class="page-h1">${tab==='today' ? (mode==='practice'?'Practice':'One clue') : tab==='archive' ? 'Past clues' : 'How it works'}</h1>
      </div>
      <button class="chip" data-act="tab" data-v="learn" aria-label="How it works">${icon('note',18)}</button>
    </div>
  </header>

  <div class="seg sticky" style="margin:14px 0">
    ${[['today','Today'],['archive','Archive'],['learn','Learn']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='today' ? playHTML() : tab==='archive' ? archiveHTML() : learnHTML()}`;
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

/* ---------------- the clue ---------------- */
function playHTML(){
  const c = activeClue();
  const done = activeDone();
  const n = c.answer.length;
  const shown = (done ? c.answer : draft).padEnd(n, ' ');

  return `
  <div class="card in" style="text-align:center;padding:24px 20px">
    <div class="tiny muted" style="letter-spacing:.1em;text-transform:uppercase;margin-bottom:11px">
      ${mode === 'practice' ? 'Practice' : esc(fmtDayShort(today()))}
    </div>
    <div style="font-family:'Sora',sans-serif;font-size:21px;font-weight:700;line-height:1.45;letter-spacing:-.01em">
      ${esc(c.clue.replace(c.enumeration, '').trim())}
    </div>
    <div class="badge accent" style="margin-top:12px">${esc(c.enumeration)}</div>
  </div>

  <div class="cx-grid ${shake?'shake':''} in in-2" id="cx-grid" style="margin-top:18px">
    ${[...Array(n)].map((_, i) => `
      <span class="cx-box ${shown[i].trim() ? 'filled' : ''}">${esc(shown[i].trim())}</span>`).join('')}
  </div>

  ${hintsHTML(c, activeHints())}

  ${done ? doneHTML(c) : keyboardHTML()}`;
}

/* Our own keyboard. Three rows, with delete and enter flanking the last
   one exactly where a thumb expects them. */
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function keyboardHTML(){
  return `
  <div class="cx-kb in in-3">
    ${ROWS.map((row, i) => `
      <div class="cx-kbrow">
        ${i === 2 ? `<button class="cx-key wide" data-act="hint" aria-label="Hint">${icon('spark',17)}</button>` : ''}
        ${[...row].map(k => `<button class="cx-key" data-act="k" data-k="${k}">${k}</button>`).join('')}
        ${i === 2 ? `<button class="cx-key wide" data-act="del" aria-label="Delete">${icon('back',19)}</button>` : ''}
      </div>`).join('')}
  </div>

  <button class="btn btn-primary block in in-3" style="margin-top:14px" data-act="check">Check</button>
  <button class="btn btn-ghost block" style="color:var(--muted)" data-act="reveal">Show me the answer</button>`;
}

function hintList(c){
  return [
    { label:'What kind of clue is this?',
      body:`<b>${esc(DEVICES[c.device].name)}.</b> ${esc(DEVICES[c.device].idea)}` },
    { label:'Where is the definition?',
      body: c.def === 'both halves'
        ? 'Both halves of the clue define the answer independently. There is no wordplay to unpick.'
        : `The definition is <b>&ldquo;${esc(c.def)}&rdquo;</b>. Everything else is wordplay.` },
    { label:'Nudge me', body: esc(c.nudge) },
  ];
}

function hintsHTML(c, taken){
  if (!taken) return '';
  return `<div class="stack" style="gap:9px;margin-top:14px">
    ${hintList(c).slice(0, taken).map((h, i) => `
      <div class="card tight sunk">
        <div class="tiny muted" style="margin-bottom:5px">Hint ${i+1} · ${esc(h.label)}</div>
        <div style="font-size:14px;line-height:1.6">${h.body}</div>
      </div>`).join('')}
  </div>`;
}

function doneHTML(c){
  const dev = DEVICES[c.device];
  const good = mode === 'practice'
    ? !!store.get().practice[practiceIdx]?.solved
    : !!playOn(today())?.solved;
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
      <div class="tiny muted" style="margin-top:10px;line-height:1.6">Definition: &ldquo;${esc(c.def)}&rdquo;</div>`}
  </div>

  <div class="card tight sunk" style="margin-top:10px">
    <div class="tiny muted" style="line-height:1.6"><b>${esc(dev.name)}:</b> ${esc(dev.tell)}</div>
  </div>

  <button class="btn btn-primary block" style="margin-top:16px" data-act="practice">
    ${icon('puzzle',17)} ${mode === 'practice' ? 'Another one' : 'Practice another'}
  </button>
  ${mode === 'practice' ? `
    <button class="btn btn-plain block" style="margin-top:9px" data-act="backtoday">Back to today's clue</button>` : ''}

  <div class="grid2" style="margin-top:18px">
    ${stat(num(solvedCount()), 'Daily solved')}
    ${stat(num(store.get().practiceDone), 'Practice solved', 'var(--accent-1)')}
  </div>`;
}

/* ---------------- archive ---------------- */
function archiveHTML(){
  const plays = store.get().plays;
  const days = Object.keys(plays).sort().reverse();
  const streakN = streak();

  return `
  <div class="grid2 in" style="margin-bottom:14px">
    ${stat(num(solvedCount()), 'Daily solved')}
    ${stat(num(streakN), 'In a row', streakN ? 'var(--good)' : undefined)}
  </div>
  <button class="btn btn-primary block in" data-act="practice">
    ${icon('puzzle',17)} Practice a clue
  </button>
  <div class="center tiny muted" style="margin-top:9px">
    ${num(CLUES.length)} clues in the bank. Practice never touches the streak.
  </div>

  ${!days.length ? empty(icon('puzzle',34), "No dailies played yet.<br>Today's clue is on the first tab.") : `
  <div class="sec">Your dailies</div>
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
      </button>`;
    }).join('')}
  </div>`}`;
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

/* ---------------- typing ----------------
   Repaint the boxes directly rather than re-rendering the view: a full
   render on every keystroke would rebuild the keyboard under the thumb. */
function paintBoxes(){
  const grid = document.getElementById('cx-grid');
  if (!grid) return;
  [...grid.children].forEach((b, i) => {
    const ch = draft[i] || '';
    b.textContent = ch;
    b.classList.toggle('filled', !!ch);
  });
}

function typeLetter(k){
  const n = activeClue().answer.length;
  if (draft.length >= n) return;
  draft += k;
  haptic(6);
  paintBoxes();
}

function deleteLetter(){
  if (!draft) return;
  draft = draft.slice(0, -1);
  haptic(6);
  paintBoxes();
}

function check(){
  const c = activeClue();
  if (draft.length < c.answer.length){ toast(`${c.answer.length} letters`); return; }

  const right = draft === c.answer;

  if (mode === 'practice'){
    if (right){
      store.update(s => { s.practice[practiceIdx] = { solved:true }; s.practiceDone++; });
      haptic(30); toast('Got it ✓'); draft = ''; render();
    } else { wrong(); }
    return;
  }

  const d = today();
  const tries = (playOn(d)?.tries || 0) + 1;
  if (right){
    recordPlay(d, { solved:true, tries });
    haptic(30); toast('Got it ✓'); draft = ''; render();
  } else {
    recordPlay(d, { tries });
    wrong();
  }
}

function wrong(){
  haptic();
  shake = true;
  render();
  setTimeout(() => {
    shake = false;
    document.getElementById('cx-grid')?.classList.remove('shake');
  }, 500);
}

/* ---------------- binding ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; if (d.v === 'today' && mode === 'practice'){ /* stay in practice */ } render(); },
    k: d => typeLetter(d.k),
    del: deleteLetter,
    check,
    practice: startPractice,
    backtoday: () => { mode = 'daily'; practiceIdx = null; draft = ''; render(); },
    hint: () => {
      const c = activeClue();
      const taken = activeHints();
      if (taken >= hintList(c).length){ toast('That is all of them'); return; }
      if (mode === 'practice') pHints = taken + 1;
      else recordPlay(today(), { hints: taken + 1 });
      haptic();
      render();
    },
    reveal: () => {
      openSheet(`
        <h2>Show the answer?</h2>
        <p class="sub">You will still get the full explanation — that is the useful part either way.</p>
        <button class="btn btn-primary block" style="margin-top:16px" data-act="yes">Show me</button>
        <button class="btn btn-ghost block" data-act="close">Keep trying</button>
      `);
      bindActions(document.querySelector('.sheet'), {
        close: closeSheet,
        yes: () => {
          if (mode === 'practice') pShown = true;
          else recordPlay(today(), { revealed:true });
          closeSheet(); draft = ''; render();
        },
      });
    },
    openpast: d => openPast(d.d),
  });

  /* A physical keyboard should still work when this is open on a laptop. */
  if (!root.__keyBound){
    root.__keyBound = true;
    document.addEventListener('keydown', e => {
      if (document.querySelector('.sheet')) return;
      if (tab !== 'today' || activeDone()) return;
      if (e.key === 'Backspace'){ e.preventDefault(); deleteLetter(); }
      else if (e.key === 'Enter'){ e.preventDefault(); check(); }
      else if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toUpperCase());
    });
  }
}
