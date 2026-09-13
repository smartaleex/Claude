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
import { JOKES, LINES, TRUTHS } from '../data/lift.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* Avoid serving the same joke twice running — the one thing that makes
   a bank feel small. */
let lastJoke = -1, lastLine = -1, lastTruth = -1;
function pickFresh(arr, lastRef){
  if (arr.length < 2) return { i:0, v:arr[0] };
  let i;
  do { i = Math.floor(Math.random() * arr.length); } while (i === lastRef);
  return { i, v:arr[i] };
}

let mode = 'joke';

export function openLift(startMode = 'joke'){
  mode = startMode;
  paint();
}

function body(){
  if (mode === 'joke'){
    const { i, v } = pickFresh(JOKES, lastJoke); lastJoke = i;
    return `
      <div class="card tight sunk" style="margin-top:6px">
        <div style="font-size:17px;line-height:1.55;font-weight:600">${esc(v)}</div>
      </div>
      <button class="btn btn-primary block" style="margin-top:14px" data-act="again">Another one</button>`;
  }

  if (mode === 'line'){
    const { i, v } = pickFresh(LINES, lastLine); lastLine = i;
    return `
      <div class="card tight sunk" style="margin-top:6px">
        <div style="font-size:16.5px;line-height:1.65">${esc(v.t)}</div>
        <div class="tiny muted" style="margin-top:10px">— ${esc(v.a)}</div>
      </div>
      <button class="btn btn-primary block" style="margin-top:14px" data-act="again">Another one</button>`;
  }

  if (mode === 'truth'){
    const { i, v } = pickFresh(TRUTHS, lastTruth); lastTruth = i;
    return `
      <div class="card tight sunk" style="margin-top:6px">
        <div style="font-size:16px;line-height:1.65">${esc(v)}</div>
      </div>
      <button class="btn btn-primary block" style="margin-top:14px" data-act="again">Another one</button>`;
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

function paint(){
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
    m: d => { mode = d.v; haptic(6); paint(); },
    again: () => { haptic(6); paint(); },
    close: closeSheet,
  });
}
