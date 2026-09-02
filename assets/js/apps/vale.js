/* ============================================================
   Vale — Spanish.

   The gap in Duolingo-style apps for someone at Alex's level is that
   they drill without ever explaining. He lived in Spain for a year, so
   the ear is there and the grammar has rusted — which means he needs
   the *why*, then the reps, not endless multiple choice.

   So: Learn (real explanations) → Practise (spaced repetition over
   drills you've actually seen) → Talk (open conversation with
   correction). Peninsular Spanish throughout.
   ============================================================ */

import { Slice, today, dayKey, daysBetween, uid, shiftDay } from '../core/store.js';
import { ask } from '../core/ai.js';
import {
  esc, num, toast, openSheet, closeSheet, sheetVal, bindActions,
  empty, stat, haptic,
} from '../core/ui.js';
import { LESSONS, LEVELS, SCENARIOS, lessonsIn } from '../data/spanish.js';

const store = new Slice('vale', {
  seen: {},          // lessonId -> true
  srs: {},           // drillKey -> { box, due, lessonId }
  streak: 0,
  lastStudy: '',
  totalRight: 0,
  totalWrong: 0,
});

let tab = 'learn';
let root = null;
let session = null;   // active drill session

/* ---------------- SRS ----------------
   Leitner boxes. Right answer promotes and pushes the next review
   further out; wrong answer drops it straight back to box 1, because
   a grammar rule you got wrong needs seeing tomorrow, not in a week. */
const INTERVALS = [0, 1, 3, 7, 16, 35];

function drillKey(lessonId, i){ return `${lessonId}:${i}`; }

function scheduleDrill(key, lessonId, right){
  store.update(s => {
    const cur = s.srs[key] || { box:0, lessonId };
    const box = right ? Math.min(cur.box + 1, INTERVALS.length - 1) : 1;
    s.srs[key] = { box, lessonId, due: shiftDay(today(), INTERVALS[box]) };
    if (right) s.totalRight++; else s.totalWrong++;
  });
}

function dueDrills(){
  const s = store.get();
  const out = [];
  for (const l of LESSONS){
    l.drills.forEach((d, i) => {
      const key = drillKey(l.id, i);
      const rec = s.srs[key];
      // Unseen drills only enter rotation once the lesson's been read.
      if (!rec) { if (s.seen[l.id]) out.push({ ...d, key, lessonId:l.id, lessonTitle:l.title, isNew:true }); }
      else if (rec.due <= today()) out.push({ ...d, key, lessonId:l.id, lessonTitle:l.title });
    });
  }
  return out;
}

function markStudied(){
  store.update(s => {
    const y = shiftDay(today(), -1);
    if (s.lastStudy === today()) return;
    s.streak = s.lastStudy === y ? s.streak + 1 : 1;
    s.lastStudy = today();
  });
}

const progress = () => {
  const s = store.get();
  const done = LESSONS.filter(l => s.seen[l.id]).length;
  return { done, total: LESSONS.length, pct: Math.round(done / LESSONS.length * 100) };
};

/* ---------------- summary ---------------- */
export async function summary(){
  await store.load();
  const due = dueDrills().length;
  const p = progress();
  return {
    headline: due ? `${due} to review` : 'All caught up',
    detail: `${p.done} of ${p.total} lessons · ${store.get().streak} day streak`,
    badge: due ? String(due) : null,
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
        <div class="eyebrow">Español · Vale</div>
        <h1 class="page-h1">${tab==='learn' ? 'Learn' : tab==='drill' ? 'Practise' : 'Talk'}</h1>
      </div>
      <div class="chip" style="pointer-events:none">🔥 ${store.get().streak}</div>
    </div>
  </header>

  <div class="seg sticky" style="margin:16px 0">
    ${[['learn','Learn'],['drill','Practise'],['talk','Talk']].map(([v,l]) =>
      `<button class="${tab===v?'on':''}" data-act="tab" data-v="${v}">${l}</button>`).join('')}
  </div>

  ${tab==='learn' ? learnHTML() : tab==='drill' ? drillHTML() : talkHTML()}`;
  bind();
}

/* ---------------- learn ---------------- */
function learnHTML(){
  const s = store.get();
  const p = progress();

  return `
  <div class="hero in">
    <div class="eyebrow" style="color:rgba(255,255,255,.75)">De B1 a nativo</div>
    <div class="spread" style="align-items:flex-end;margin-top:6px">
      <div><div class="hero-num" style="font-size:44px">${p.done}<span style="font-size:22px">/${p.total}</span></div>
        <div class="hero-cap">lessons worked through</div></div>
      <div class="hero-side" style="font-size:28px">${p.pct}%</div>
    </div>
    <div class="bar"><i style="width:${p.pct}%"></i></div>
  </div>

  ${LEVELS.map(lv => {
    const ls = lessonsIn(lv.id);
    const doneN = ls.filter(l => s.seen[l.id]).length;
    return `
    <div class="sec">${esc(lv.name)} · ${doneN}/${ls.length}</div>
    <div class="tiny muted" style="margin:-6px 2px 10px">${esc(lv.blurb)}</div>
    <div class="stack" style="gap:9px">
      ${ls.map(l => `
        <button class="rowcard" data-act="lesson" data-id="${l.id}" style="width:100%;text-align:left">
          <div class="av" style="background:${s.seen[l.id] ? 'var(--good)' : 'var(--bg-sunk)'};color:${s.seen[l.id]?'#fff':'var(--faint)'};font-size:16px">
            ${s.seen[l.id] ? '✓' : '·'}
          </div>
          <div class="grow"><b>${esc(l.title)}</b><span class="sub">${esc(l.hook.slice(0,72))}${l.hook.length>72?'…':''}</span></div>
          <span class="caret">›</span>
        </button>`).join('')}
    </div>`;
  }).join('')}`;
}

function openLesson(id){
  const l = LESSONS.find(x => x.id === id);
  if (!l) return;
  store.update(s => { s.seen[id] = true; });
  markStudied();

  openSheet(`
    <h2>${esc(l.title)}</h2>
    <p class="sub">${esc(l.hook)}</p>

    ${l.body.map(b => `
      <div style="margin-bottom:16px">
        <div class="card-title" style="font-size:14.5px;color:var(--accent-1)">${esc(b.h)}</div>
        <p style="font-size:14.5px;line-height:1.68;margin:5px 0 0;color:var(--ink-2)">${esc(b.p)}</p>
      </div>`).join('')}

    ${l.table ? `
      <div style="overflow-x:auto;margin:18px 0;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;min-width:${l.table.head.length*88}px">
          <thead><tr>${l.table.head.map(h =>
            `<th style="text-align:left;padding:9px 10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-bottom:1.5px solid var(--line)">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${l.table.rows.map(r => `<tr>${r.map((c,i) =>
            `<td style="padding:9px 10px;border-bottom:1px solid var(--line-soft);${i===0?'color:var(--muted)':'font-weight:600'}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

    <div class="label" style="margin-top:20px">In practice</div>
    ${l.examples.map(([es_, en, note]) => `
      <div class="card tight sunk" style="margin-bottom:8px">
        <div style="font-size:15px;font-weight:600">${esc(es_)}</div>
        <div class="tiny muted" style="margin-top:3px">${esc(en)}</div>
        ${note ? `<div class="tiny" style="margin-top:6px;color:var(--accent-1)">${esc(note)}</div>` : ''}
      </div>`).join('')}

    <button class="btn btn-primary block" style="margin-top:18px" data-act="practise" data-id="${l.id}">
      Practise this — ${l.drills.length} questions
    </button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    practise: d => {
      const les = LESSONS.find(x => x.id === d.id);
      closeSheet();
      startSession(les.drills.map((dr,i) => ({ ...dr, key:drillKey(les.id,i), lessonId:les.id, lessonTitle:les.title })));
    },
    close: () => { closeSheet(); render(); },
  });
}

/* ---------------- drills ---------------- */
function drillHTML(){
  if (session) return sessionHTML();

  const due = dueDrills();
  const s = store.get();
  const acc = s.totalRight + s.totalWrong > 0
    ? Math.round(s.totalRight / (s.totalRight + s.totalWrong) * 100) : null;

  return `
  <div class="grid2 in">
    ${stat(num(due.length), 'Due now', due.length ? 'var(--accent-1)' : 'var(--good)')}
    ${stat(num(s.streak) + '<small> days</small>', 'Streak')}
    ${stat(acc !== null ? acc + '<small>%</small>' : '—', 'Accuracy')}
    ${stat(num(s.totalRight), 'Correct all time')}
  </div>

  ${due.length ? `
    <button class="btn btn-primary block in in-2" style="margin-top:16px" data-act="startdue">
      Review ${due.length} question${due.length>1?'s':''} →
    </button>
    <div class="tiny muted center" style="margin-top:10px">
      Spaced repetition — anything you get wrong comes back tomorrow, anything you nail goes further out.
    </div>` : `
    <div class="card in in-2" style="margin-top:16px;background:var(--good-tint);border-color:transparent">
      <div class="card-title" style="color:var(--good)">Nothing due</div>
      <div class="card-note" style="margin-top:4px">
        ${progress().done === 0
          ? 'Read a lesson first — drills unlock as you go.'
          : 'Come back tomorrow, or read a new lesson to add more.'}
      </div>
    </div>`}

  ${progress().done > 0 ? `
  <div class="sec">Drill a specific lesson</div>
  <div class="stack" style="gap:8px">
    ${LESSONS.filter(l => store.get().seen[l.id]).map(l => `
      <button class="rowcard" data-act="drilllesson" data-id="${l.id}" style="width:100%;text-align:left">
        <div class="grow"><b>${esc(l.title)}</b><span class="sub">${l.drills.length} questions</span></div>
        <span class="caret">›</span>
      </button>`).join('')}
  </div>` : ''}`;
}

function startSession(items){
  // Shuffle so order isn't a memory cue.
  const q = [...items].sort(() => Math.random() - 0.5);
  session = { queue:q, i:0, answered:null, right:0, wrong:0 };
  tab = 'drill';
  render();
}

function sessionHTML(){
  const { queue, i, answered } = session;
  if (i >= queue.length){
    const pct = Math.round(session.right / queue.length * 100);
    return `
    <div class="card in center" style="padding:34px 22px">
      <div style="font-size:44px">${pct >= 80 ? '🎉' : pct >= 50 ? '👊' : '📚'}</div>
      <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:28px;margin-top:12px">
        ${session.right} / ${queue.length}
      </div>
      <p class="card-note" style="margin-top:8px">
        ${pct >= 80 ? 'Solid. The ones you missed will come back in a day or two.'
        : pct >= 50 ? 'Getting there. Everything you missed is queued for tomorrow.'
        : 'Worth re-reading the lesson — the explanation does more than repetition here.'}
      </p>
      <button class="btn btn-primary block" style="margin-top:18px" data-act="endsession">Done</button>
    </div>`;
  }

  const d = queue[i];
  return `
  <div class="spread in" style="margin-bottom:14px">
    <span class="tiny muted">${esc(d.lessonTitle)}</span>
    <span class="tiny muted mono">${i+1} / ${queue.length}</span>
  </div>
  <div class="meter-track" style="background:var(--bg-sunk);margin-bottom:20px">
    <div class="meter-fill" style="width:${i/queue.length*100}%;background:var(--accent-1)"></div>
  </div>

  <div class="card in">
    <div style="font-size:20px;font-weight:600;line-height:1.5;text-align:center;padding:14px 4px">
      ${esc(d.q)}
    </div>
  </div>

  <div class="stack" style="margin-top:16px;gap:9px">
    ${d.opts.map(o => {
      let style = '';
      if (answered){
        if (o === d.a) style = 'background:var(--good-tint);border-color:var(--good);color:var(--good)';
        else if (o === answered) style = 'background:var(--bad-tint);border-color:var(--bad);color:var(--bad)';
        else style = 'opacity:.45';
      }
      return `<button class="chip" data-act="answer" data-o="${esc(o)}"
        style="width:100%;padding:16px;font-size:16px;font-weight:600;${style}"
        ${answered?'disabled':''}>${esc(o)}</button>`;
    }).join('')}
  </div>

  ${answered ? `
    <div class="card in" style="margin-top:14px;background:${answered===d.a?'var(--good-tint)':'var(--surface-2)'};border-color:transparent">
      <div class="card-title" style="font-size:14.5px;color:${answered===d.a?'var(--good)':'var(--ink)'}">
        ${answered===d.a ? '✓ Correcto' : `The answer is "${esc(d.a)}"`}
      </div>
      <div class="card-note" style="margin-top:5px">${esc(d.why)}</div>
    </div>
    <button class="btn btn-primary block" style="margin-top:14px" data-act="next">
      ${i+1 >= queue.length ? 'Finish' : 'Next →'}
    </button>` : ''}`;
}

/* ---------------- talk ---------------- */
function talkHTML(){
  return `
  <div class="card in">
    <div class="card-title">Open practice</div>
    <p class="card-note" style="margin-top:8px">
      Write something in Spanish and get it corrected properly — not just "wrong", but what a Spaniard
      would have said and why. Pick a scenario or write anything you like.
    </p>
  </div>

  <div class="sec">Scenarios</div>
  <div class="grid2" style="gap:10px">
    ${SCENARIOS.map(s => `
      <button class="card tight in" data-act="scenario" data-id="${s.id}" style="text-align:left">
        <div style="font-size:22px">${s.icon}</div>
        <div class="card-title" style="margin-top:8px;font-size:14.5px">${esc(s.title)}</div>
      </button>`).join('')}
  </div>

  <div class="sec">Or just write</div>
  <div class="card in">
    <textarea class="textarea" id="v-text" placeholder="Escribe algo en español…"></textarea>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="check" id="v-check">Check my Spanish</button>
    <div id="v-out"></div>
  </div>`;
}

async function checkSpanish(text, context){
  const btn = document.getElementById('v-check');
  if (btn){ btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Corrigiendo…`; }
  try{
    const res = await ask({
      prompt: `You are a Spanish teacher from Madrid correcting an Australian student. He lived in Spain for a year, so he is roughly B1-B2: good ear and vocabulary, rusty grammar. Use PENINSULAR Spanish — vosotros, Spain vocabulary (coche, móvil, ordenador, zumo), Spain idiom.
${context ? `Context: he is practising ${context}.` : ''}

His text: "${text}"

Correct it honestly. Don't praise mistakes. Focus on what actually marks him as a foreigner rather than trivial slips. If it's already correct, say so and offer a more natural or more native phrasing instead.

Respond with ONLY this JSON:
{"corrected":"his text, corrected","natural":"how a Spaniard would more likely say it","notes":[{"issue":"what was wrong","fix":"the correction","why":"the rule, one short line"}],"level":"rough CEFR estimate like B1 or B2"}`,
      offline: () => ({
        corrected: text,
        natural: '',
        notes: [{ issue:'AI is off', fix:'Add a free Gemini key in Settings', why:'Correction needs the AI tier — lessons and drills work offline.' }],
        level: '—',
      }),
    });
    const a = res.data;
    const out = document.getElementById('v-out');
    if (out) out.innerHTML = `
      <div class="card tight sunk in" style="margin-top:14px">
        <div class="spread"><span class="label" style="margin:0">Corrected</span>
          ${a.level ? `<span class="badge accent">${esc(a.level)}</span>` : ''}</div>
        <div style="font-size:15px;font-weight:600;margin-top:6px;line-height:1.5">${esc(a.corrected)}</div>
        ${a.natural ? `<div class="hr"></div>
          <div class="label" style="margin:0 0 5px">More natural</div>
          <div style="font-size:15px;line-height:1.5">${esc(a.natural)}</div>` : ''}
        ${(a.notes||[]).length ? `<div class="hr"></div>${a.notes.map(n => `
          <div style="padding:8px 0">
            <div style="font-size:13.5px;font-weight:600">${esc(n.issue)} → <span style="color:var(--good)">${esc(n.fix)}</span></div>
            <div class="tiny muted" style="margin-top:2px">${esc(n.why)}</div>
          </div>`).join('')}` : ''}
      </div>`;
    markStudied();
  }catch(e){
    toast(e.message || 'Could not reach AI');
  }finally{
    if (btn){ btn.disabled = false; btn.textContent = 'Check my Spanish'; }
  }
}

function openScenario(id){
  const sc = SCENARIOS.find(s => s.id === id);
  openSheet(`
    <h2>${sc.icon} ${esc(sc.title)}</h2>
    <p class="sub">Write what you'd say. It'll be corrected as a Spaniard would hear it.</p>
    <div class="card tight sunk" style="margin-bottom:14px">
      <div class="tiny muted">Situación: ${esc(sc.prompt)}</div>
    </div>
    <textarea class="textarea" id="v-text" placeholder="Escribe aquí…" style="min-height:110px"></textarea>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="check" id="v-check">Check it</button>
    <div id="v-out"></div>
    <button class="btn btn-ghost block" style="margin-top:10px" data-act="close">Close</button>
  `);
  setTimeout(() => document.getElementById('v-text')?.focus(), 140);
  bindActions(document.querySelector('.sheet'), {
    check: () => {
      const t = sheetVal('v-text').trim();
      if (!t){ toast('Escribe algo primero'); return; }
      checkSpanish(t, sc.prompt);
    },
    close: closeSheet,
  });
}

/* ---------------- bind ---------------- */
function bind(){
  bindActions(root, {
    tab: d => { tab = d.v; session = null; render(); },
    lesson: d => openLesson(d.id),
    startdue: () => startSession(dueDrills()),
    drilllesson: d => {
      const l = LESSONS.find(x => x.id === d.id);
      startSession(l.drills.map((dr,i) => ({ ...dr, key:drillKey(l.id,i), lessonId:l.id, lessonTitle:l.title })));
    },
    answer: d => {
      const cur = session.queue[session.i];
      session.answered = d.o;
      const right = d.o === cur.a;
      if (right){ session.right++; haptic(10); } else { session.wrong++; haptic(30); }
      scheduleDrill(cur.key, cur.lessonId, right);
      render();
    },
    next: () => { session.i++; session.answered = null; render(); },
    endsession: () => { session = null; markStudied(); render(); },
    scenario: d => openScenario(d.id),
    check: () => {
      const t = document.getElementById('v-text')?.value.trim();
      if (!t){ toast('Escribe algo primero'); return; }
      checkSpanish(t, null);
    },
  });
}
