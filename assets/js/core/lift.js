/* ============================================================
   lift.js — the "I need something right now" button.

   Deliberately a sheet rather than an app. An app is somewhere you go
   when you have the energy to go somewhere; this has to be one tap from
   the home screen and instant.

   The ladder matters more than the content. It opens on a joke, because
   that is what he asked for and because a low bar is the right bar. But
   every screen carries a way down to something more serious, and the
   bottom of the ladder is a real phone number — not a breathing
   exercise. An app that only ever offers jokes to someone in a bipolar
   depression is failing them politely.
   ============================================================ */

import { esc, openSheet, closeSheet, bindActions, haptic, toast } from './ui.js';
import { icon } from './icons.js';
import { ask, aiSettings, initAI } from './ai.js';
import { JOKES, LINES, TRUTHS } from '../data/lift.js';
import { readContext, quoteWeight, truthWeight, choose, hide, loadMem, saveMem, vetJoke } from './mind.js';

/* What the app already knows, read straight from saved data so this
   works from any screen. Anything missing just means "unknown", and the
   selection falls back to a fair shuffle. */
function liveContext(){
  const read = k => { try { return JSON.parse(localStorage.getItem('alexhq:' + k) || 'null'); } catch { return null; } };
  const d = new Date(), y = new Date(d.getTime() - 864e5);
  const key = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  return readContext({ day:read('day'), fuel:read('fuel'), todayKey:key(d), yesterdayKey:key(y), hour:d.getHours() });
}

let mode = 'joke';
let current = null;        // what is on screen: { kind, text, ai? }
let busyAI = false;
let aiJokes = [];          // this session's vetted AI jokes, never persisted
const hasKey = () => { const s = aiSettings?.(); return !!(s && s.aiEnabled && s.geminiKey); };

export function openLift(startMode = 'joke'){
  mode = startMode;
  paint(true);
}

function next(kind){
  const mem = loadMem();
  let item;
  if (kind === 'joke'){
    item = choose(JOKES, { kind, mem });
    current = { kind, text:item };
  } else if (kind === 'line'){
    const ctx = liveContext();
    item = choose(LINES, { kind, mem, textOf:q => q.t, weightOf:q => quoteWeight(q, ctx) });
    current = { kind, text:item.t, by:item.a };
  } else {
    const ctx = liveContext();
    item = choose(TRUTHS, { kind, mem, textOf:t => t.t, weightOf:t => truthWeight(t, ctx) });
    current = { kind, text:item.t };
  }
  saveMem(mem);
}

/* An AI joke is a bonus, never a dependency. It is written to a strict
   brief, then screened by a program (no illness, death, food, mood or
   medicine; not a copy of a stored joke; one line). If it fails the
   screen the caller gets a curated joke instead. */
async function aiJoke(){
  const samples = [...JOKES].sort(() => Math.random() - .5).slice(0, 5);
  const bank = [...JOKES, ...aiJokes];
  for (let i = 0; i < 2; i++){
    try{
      const res = await ask({
        maxTokens: 200,
        prompt: `Write ONE short, clean, original joke in the style of these, a pun or dry one-liner. One or two sentences.
Never about: illness, death, hospitals, medicine, mental health, moods, food or dieting, family conflict, politics, or anyone's body.

Style examples:
${samples.map(j => '- ' + j).join('\n')}

Return ONLY JSON: {"joke":"..."}`,
      });
      const j = String(res?.data?.joke || '').trim();
      const v = vetJoke(j, bank);
      if (v.ok){ aiJokes.push(j); return j; }
    }catch{ return null; }
  }
  return null;
}

function body(){
  if (!current || current.kind !== mode) next(mode);
  const c = current;
  const acts = (extra = '') => `
    <button class="btn btn-primary block" style="margin-top:14px" data-act="again">Another one</button>
    ${extra}`;

  if (mode === 'joke'){
    return `
      <div class="card tight sunk" style="margin-top:6px">
        <div style="font-size:17px;line-height:1.55;font-weight:600">${esc(c.text)}</div>
        ${c.ai ? '<div class="tiny muted" style="margin-top:8px">Written by the AI. Hit or miss.</div>' : ''}
      </div>
      ${acts(`
      <div style="display:flex;gap:9px;margin-top:9px">
        ${hasKey() ? `<button class="btn btn-plain" style="flex:1" data-act="aijoke" ${busyAI?'disabled':''}>${busyAI?'Thinking…':'Try a fresh one (AI)'}</button>` : ''}
        <button class="btn btn-ghost" style="flex:1" data-act="nofunny">Not funny, drop it</button>
      </div>`)}`;
  }

  if (mode === 'line'){
    return `
      <div class="card tight sunk" style="margin-top:6px">
        <div style="font-size:16.5px;line-height:1.65">${esc(c.text)}</div>
        <div class="tiny muted" style="margin-top:10px">— ${esc(c.by)}</div>
      </div>
      ${acts(`<button class="btn btn-ghost block" style="margin-top:9px" data-act="nofunny">Not for me, drop it</button>`)}`;
  }

  if (mode === 'truth'){
    return `
      <div class="card tight sunk" style="margin-top:6px">
        <div style="font-size:16px;line-height:1.65">${esc(c.text)}</div>
      </div>
      ${acts(`<button class="btn btn-ghost block" style="margin-top:9px" data-act="nofunny">Not true for me, drop it</button>`)}`;
  }

  /* The bottom of the ladder. No jokes here, no reframing, and the
     number is tappable rather than something to go and look up. */
  return `
    <div class="card tight sunk" style="margin-top:6px">
      <div style="font-size:15px;line-height:1.7">
        If it is worse than a flat day — if you are frightened by how you feel, or
        you are thinking about hurting yourself — stop reading the app and talk to
        a person. That is not an overreaction and it is not dramatic.
      </div>
    </div>

    <a class="btn btn-primary block" href="tel:131114" style="margin-top:14px;text-decoration:none">
      Call Lifeline · 13 11 14
    </a>
    <a class="btn btn-plain block" href="sms:0477131114" style="margin-top:9px;text-decoration:none">
      Text Lifeline · 0477 13 11 14
    </a>
    <a class="btn btn-plain block" href="tel:000" style="margin-top:9px;text-decoration:none">
      Emergency · 000
    </a>

    <div class="tiny muted" style="margin-top:14px;line-height:1.65">
      Also worth doing on a normal bad week: message your psychiatrist or GP and say
      the thing you would not say out loud. Sleep changing, not eating, memory going —
      those are medication-review conversations, not personal failings.
    </div>`;
}

function paint(fresh){
  if (fresh) current = null;
  const tabs = [
    ['joke',  'Joke'],
    ['line',  'A line'],
    ['truth', 'Straight up'],
    ['help',  'Real help'],
  ];

  openSheet(`
    <h2>${mode === 'help' ? 'Talk to someone' : 'Here you go'}</h2>
    <p class="sub">${
      mode === 'joke'  ? 'The bar is low on purpose.'
    : mode === 'line'  ? 'Someone else got here first and wrote it down.'
    : mode === 'truth' ? 'Not a reframe. Just true.'
    :                    'No jokes on this screen.'}</p>

    <div class="seg" style="margin:14px 0 4px">
      ${tabs.map(([v,l]) => `<button class="${mode===v?'on':''}" data-act="m" data-v="${v}">${l}</button>`).join('')}
    </div>

    ${body()}

    <button class="btn btn-ghost block" style="margin-top:10px" data-act="close">Close</button>
  `);

  bindActions(document.querySelector('.sheet'), {
    m: d => { mode = d.v; haptic(6); paint(true); },
    again: () => { haptic(6); paint(true); },
    nofunny: () => {
      if (current){ const m = loadMem(); hide(m, current.text); saveMem(m); }
      haptic(6); paint(true);
    },
    aijoke: async () => {
      if (busyAI) return;
      busyAI = true; paint();
      const j = await aiJoke();
      busyAI = false;
      if (j) current = { kind:'joke', text:j, ai:true };
      else { next('joke'); toast('Nothing usable came back, so here is one from the bank.'); }
      paint();
    },
    close: closeSheet,
  });
}
