/* ============================================================
   Training: the Gemini calls on photos. The consent gate, the progress
   read, the goal benchmark, applying focus boosts. Every call is clamped
   by core/coach.js before it touches the program.
   ============================================================ */

import { dayKey } from '../../core/store.js';
import { ask } from '../../core/ai.js';
import { toast, openSheet, closeSheet, bindActions, haptic } from '../../core/ui.js';
import { blobToImage } from '../../core/photos.js';
import { weeklyVolume } from '../../data/workouts.js';
import * as coach from '../../core/coach.js';
import { dateOf, pair } from './photos.js';
import { ui, fuelData, phase, render, store, weekInBlock } from './state.js';

function askConsent(then){
  openSheet(`
    <h2>Send photos to Gemini?</h2>
    <p class="sub">To read your photos, the app sends the ones you have selected to Google's Gemini service, using your own key.</p>
    <div class="card tight sunk" style="margin:14px 0">
      <div class="tiny" style="line-height:1.7">
        <b>They leave this device</b> for that request. Otherwise they stay here.<br><br>
        <b>On the free tier</b>, Google's terms allow submitted content to be used to improve their products,
        including review by people. Do not send anything you would be uncomfortable with that.<br><br>
        You will see how many photos go each time, and can switch this off again from the Photos tab.
        The before/after slider works without any of this.
      </div>
    </div>
    <button class="btn btn-primary block" data-act="yes">I understand — send</button>
    <button class="btn btn-ghost block" data-act="no">Not now</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    yes: () => { store.update(s => { s.photoAI = true; }); closeSheet(); then(); },
    no: closeSheet,
  });
}

function aiContext(fromKey, toKey){
  const f = fuelData(), p = phase();
  return coach.buildContext({
    weights: f.weights, fuelDays: f.days, targetKcal: f.targets?.kcal,
    sessions: Object.values(store.get().sessions),
    fromKey, toKey, phaseName: `Phase ${p.phase} · ${p.name}`, week: Math.min(weekInBlock(), 8),
  });
}

const aiError = e => {
  const m = String(e?.message || '');
  if (/429|quota|rate/i.test(m)) return 'Gemini says you are out of free requests for now. Try again later.';
  if (/No AI available/i.test(m)) return 'No AI available — add a Gemini key first.';
  return m.length > 140 ? m.slice(0, 140) + '…' : (m || 'Could not get a reading.');
};

export async function readProgress(){
  if (ui.busy) return;
  const [a, b] = pair();
  if (!b) return;
  ui.askText = (document.getElementById('ask-q')?.value || '').trim();
  if (!store.get().photoAI) return askConsent(readProgress);

  ui.busy = 'progress'; render();
  try{
    const picks = a && a.id !== b.id ? [a, b] : [b];
    const images = await Promise.all(picks.map(p => blobToImage(p.blob)));
    const labels = picks.length === 2
      ? [`Photo 1: BEFORE, taken ${dateOf(picks[0])}`, `Photo 2: AFTER, taken ${dateOf(picks[1])}`]
      : [`Photo 1: his current physique, taken ${dateOf(picks[0])}`];
    const context = aiContext(dayKey(picks[0].t), dayKey(picks.at(-1).t));
    const res = await ask({
      prompt: coach.progressPrompt({ context, question: ui.askText, labels }),
      images, maxTokens: 1400,
    });
    const data = coach.sanitiseProgress(res.data);
    if (!data.usable) throw new Error('The reply came back in a shape I could not read. Try again.');
    store.update(s => {
      s.readings = { ...(s.readings || {}), progress: { t: Date.now(), q: ui.askText, n: picks.length, data } };
    });
  }catch(e){ toast(aiError(e)); }
  finally{ ui.busy = null; render(); }
}

export async function runBenchmark(){
  if (ui.busy) return;
  const [, b] = pair();
  const goals = ui.goals || [];
  if (!b || !goals.length) return;
  if (!store.get().photoAI) return askConsent(runBenchmark);

  ui.busy = 'benchmark'; render();
  try{
    const refs = goals.slice(-2);
    const images = await Promise.all([b, ...refs].map(p => blobToImage(p.blob)));
    const labels = [`Photo 1: him NOW, taken ${dateOf(b)}`,
                    ...refs.map((_, i) => `Photo ${i + 2}: GOAL reference ${i + 1}`)];
    const volume = weeklyVolume(phase()).map(([m, n]) => `${m}: ${n}`).join(', ');
    const res = await ask({
      prompt: coach.benchmarkPrompt({ context: aiContext(dayKey(b.t), dayKey(b.t)), volume, labels }),
      images, maxTokens: 1600,
    });
    const data = coach.sanitiseBenchmark(res.data);
    if (!data.usable) throw new Error('The reply came back in a shape I could not read. Try again.');
    store.update(s => {
      s.readings = { ...(s.readings || {}), benchmark: { t: Date.now(), n: images.length, data } };
    });
  }catch(e){ toast(aiError(e)); }
  finally{ ui.busy = null; render(); }
}

export function applyFocus(){
  const bm = (store.get().readings || {}).benchmark;
  if (!bm) return;
  // Re-clamp on apply rather than trusting what was stored.
  const { accepted } = coach.clampAdjustments(bm.data.adjustments);
  const focus = Object.fromEntries(accepted.map(a => [a.muscle, a.extraSets]));
  store.update(s => { s.focus = focus; s.focusMeta = { t: Date.now() }; });
  haptic(20);
  toast('Applied — see the Goal tab');
  render();
}

export const actions = {
  readprogress: readProgress,
  benchmark: runBenchmark,
  applyfocus: applyFocus,
  photoaioff: () => { store.update(s => { s.photoAI = false; }); toast('Photo analysis off'); render(); },
};
