/* ============================================================
   Training: the Goal tab. Weight and rate of gain, the back-on-track plan,
   the reasoning, weekly volume, focus boosts.
   ============================================================ */

import { today, dayKey, keyToDate } from '../../core/store.js';
import { esc, round, haptic } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { PHYSIQUE, weeklyVolume } from '../../data/workouts.js';
import * as cb from '../../core/comeback.js';
import * as coach from '../../core/coach.js';
import { loadPhotos } from './photos.js';
import { ui, fuelData, phase, ramp, render, store } from './state.js';

export function goalHTML(){
  // Bodyweight lives in Fuel — one source of truth, read it from there.
  let weights = {};
  try{ weights = JSON.parse(localStorage.getItem('alexhq:fuel') || '{}').weights || {}; }catch{}
  const keys = Object.keys(weights).sort();
  const cur = keys.length ? weights[keys.at(-1)] : PHYSIQUE.start;
  const prog = Math.max(0, Math.min(100, (cur - PHYSIQUE.start) / (PHYSIQUE.goal - PHYSIQUE.start) * 100));

  let rate = null;
  if (keys.length >= 2){
    const wks = Math.max(1, (keyToDate(keys.at(-1)) - keyToDate(keys[0])) / 6048e5);
    rate = (weights[keys.at(-1)] - weights[keys[0]]) / wks;
  }

  return `
  ${backOnTrackHTML(weights)}

  <div class="hero in" style="margin-top:14px">
    <div class="eyebrow">Swimmer build</div>
    <div class="spread" style="align-items:flex-end;margin-top:6px">
      <div><div class="hero-num" style="font-size:44px">${round(cur,1)}<span style="font-size:22px">kg</span></div>
        <div class="hero-cap">from ${PHYSIQUE.start} → ${PHYSIQUE.goal}kg</div></div>
      <div class="hero-side" style="font-size:28px">${Math.round(prog)}%</div>
    </div>
    <div class="bar"><i style="width:${prog}%"></i></div>
  </div>

  <div class="card in in-2" style="margin-top:14px">
    <div class="card-title">What actually closes the gap</div>
    <p class="card-note" style="margin-top:8px">${esc(PHYSIQUE.note)}</p>
    <div class="hr"></div>
    ${[
      ['Side & rear delts','Shoulder width is the whole illusion. Phase 3 doubles their frequency for exactly this reason.'],
      ['Lat width','Wide grips and straight-arm work. Width makes the waist look smaller without losing a kilo.'],
      ['Upper chest','Incline only. A high chest reads swimmer; a low one reads gym.'],
      ['Posture','Face pulls, chest-supported rows, wall slides. Rounded shoulders hide everything you build.'],
    ].map(([t,x]) => `<div style="padding:10px 0">
      <b style="font-size:14.5px">${t}</b>
      <div class="tiny muted" style="margin-top:2px;line-height:1.55">${x}</div></div>`).join('')}
  </div>

  ${rate !== null ? `
  <div class="card in in-3" style="margin-top:14px">
    <div class="card-title">Rate of gain</div>
    <div class="disp" style="font-size:30px;margin:8px 0 4px;
                color:${rate < PHYSIQUE.rateLo ? 'var(--warn)' : rate <= PHYSIQUE.rateHi ? 'var(--good)' : 'var(--bad)'}">
      ${rate>=0?'+':''}${round(rate,2)} kg/week
    </div>
    <div class="card-note">${
      rate < PHYSIQUE.rateLo ? 'Too slow to be building much. Add 150-200 kcal a day in Fuel.'
      : rate <= PHYSIQUE.rateHi ? 'Ideal. This is the range where the gain is mostly muscle.'
      : 'Faster than you want. Pull back about 200 kcal — the extra is going on as fat.'
    }</div>
  </div>` : `
  <div class="card in in-3" style="margin-top:14px">
    <div class="card-note">Log your bodyweight in Fuel → Trends a couple of times and this will show whether you're gaining at the right speed.</div>
  </div>`}

  ${whyHTML()}

  ${focusHTML()}

  ${volumeHTML()}

  <button class="btn btn-plain block in" style="margin-top:14px" data-act="advice">${icon('spark',17)} Ask about form or a swap</button>`;
}

/* Where you are and what to do about it, from what the app already knows.
   No key and no AI needed, so it is there on a flat day. */
function backOnTrackHTML(weights){
  const f = fuelData();
  const plan = cb.backOnTrack({
    sessions: store.get().sessions, todayKey: today(), weights, fuel: f, physique: PHYSIQUE,
    photoKeys: ui.photos ? ui.photos.map(x => dayKey(x.t)) : null, ramp: ramp(),
  });
  if (ui.photos === null) loadPhotos();
  const TONE = { good:'var(--good)', warn:'var(--warn)', neutral:'var(--faint)' };
  const max = Math.max(1, ...plan.counts);
  return `
  <div class="eyebrow in">Back on track</div>
  <div class="card in" style="margin-top:8px">
    <div class="disp" style="font-size:19px;line-height:1.3">${esc(plan.headline)}</div>
    <div class="tiny muted" style="margin-top:4px">Sessions per week, last four weeks</div>
    <div style="display:flex;gap:8px;align-items:flex-end;height:46px;margin-top:8px">
      ${plan.counts.map((n, i) => `<div style="flex:1;text-align:center">
        <div style="height:${Math.max(4, n / max * 34)}px;border-radius:7px;background:${n >= cb.weekMinimum ? 'var(--accent-1)' : 'var(--bg-sunk)'}"></div>
        <div class="tiny muted" style="margin-top:3px">${n}</div></div>`).join('')}
    </div>
    <div class="stack" style="gap:0;margin-top:12px">
      ${plan.items.map(it => `
        <div style="padding:12px 0;border-top:1px solid var(--line-soft)">
          <div class="spread" style="align-items:center">
            <b style="font-size:14.5px">${esc(it.title)}</b>
            <span style="width:9px;height:9px;border-radius:var(--r-av);background:${TONE[it.tone] || TONE.neutral}"></span>
          </div>
          <div class="tiny" style="margin-top:4px;line-height:1.6;color:var(--ink-2)">${esc(it.body)}</div>
          ${it.detail ? `<div class="tiny muted" style="margin-top:4px">${esc(it.detail)}</div>` : ''}
        </div>`).join('')}
    </div>
    <button class="btn btn-plain block" style="margin-top:6px" data-act="tab" data-v="photos">Compare my photos</button>
  </div>`;
}

/* The reasoning, written down. "Trust the plan" is worth nothing when
   you are tired and the mirror is arguing with you; being able to read
   why each choice was made is what makes it survive a bad month. */
function whyHTML(){
  return `
  <div class="card in" style="margin-top:14px">
    <div class="card-title">Why this works</div>
    <div class="card-note" style="margin-top:5px">
      The swimmer look is a ratio, not a weight. Everything below serves one number.
    </div>

    <div class="card tight sunk" style="margin-top:13px">
      <div class="tiny muted" style="line-height:1.6">
        <b>Shoulder-to-waist.</b> A "V-taper" is just wide shoulders over a narrow waist,
        and it is read as a <i>ratio</i> by the eye — around 1.6 is where a physique starts
        looking athletic rather than simply lean. You can move that ratio two ways: widen
        the top, or narrow the bottom. Narrowing has a floor, because your waist is mostly
        skeleton. Widening does not.
      </div>
    </div>

    <div class="stack" style="gap:11px;margin-top:13px">
      ${[
        ['Side delts are the highest-leverage muscle you own',
         'They sit at the widest point of your frame, so a centimetre there changes the outline more than a centimetre anywhere else. They are also small, recover fast, and tolerate being trained three times a week. This is why the program hammers them and why lateral raises appear on more days than chest does.'],
        ['Lats change the outline, not just the back',
         'Width comes from the lats flaring out below the armpit. It reads from the front, which is the angle you actually see yourself from. Vertical pulling and straight-arm work drive it; rows build thickness, which is a different thing.'],
        ['Upper chest, not chest',
         'A full upper chest fills the line under the collarbone and continues the shoulder shelf across. A big lower chest does the opposite — it drops the line and reads heavy. So every press in this program is inclined.'],
        ['Traps are deliberately kept light',
         'Heavy shrugs build the slope between neck and shoulder, which visually narrows the shoulder line and works directly against the taper. The program keeps them at maintenance on purpose.'],
        ['Arms are not a vanity block here',
         'They are the part of you closest to the viewer in almost every photo, and they are currently your weakest link relative to the goal. Triceps are roughly two thirds of arm size, which is why they get more volume than biceps.'],
        ['The waist is a kitchen problem',
         'No amount of core work narrows a midsection — that is body fat and skeletal width. Training the core adds thickness, which is why it is kept to a few sets. What you eat decides that number.'],
      ].map(([t,x]) => `
        <div>
          <b style="font-size:14.5px;line-height:1.4;display:block">${t}</b>
          <div class="tiny muted" style="margin-top:4px;line-height:1.6">${x}</div>
        </div>`).join('')}
    </div>

    <div class="card tight" style="margin-top:14px;background:var(--accent-tint);border-color:transparent">
      <div class="tiny" style="line-height:1.6">
        <b>The honest timeline.</b> Shoulder and arm width at your training age moves in
        months, not weeks — expect a visible difference at around twelve weeks and a
        clear one at six months, provided you are eating enough to build with. That last
        clause is the one that decides it.
      </div>
    </div>
  </div>`;
}

/* Weekly sets per muscle for the current phase — the honesty check that
   the program targets the goal rather than just looking busy. */
function volumeHTML(){
  const p = phase();
  const ap = coach.appliedTotals(p, store.get().focus);
  const vol = weeklyVolume(p).map(([m, n]) => [m, n + (ap[m] || 0)]).sort((a, b) => b[1] - a[1]);
  const max = vol[0]?.[1] || 1;
  const PRIORITY = ['Side delts','Rear delts & traps','Lats','Upper back'];

  const delts = vol.filter(v => v[0].includes('delts')).reduce((n,v) => n+v[1], 0);
  const back  = vol.filter(v => ['Lats','Upper back'].includes(v[0])).reduce((n,v) => n+v[1], 0);
  const chest = vol.find(v => v[0] === 'Chest')?.[1] || 0;
  const side  = vol.find(v => v[0] === 'Side delts')?.[1] || 0;

  return `
  <div class="card in" style="margin-top:14px">
    <div class="card-title">Weekly volume · Phase ${p.phase}</div>
    <div class="card-note" style="margin:4px 0 14px">
      Sets per muscle across the four days. For a V-taper, delts and back want to sit above chest.
    </div>
    ${vol.map(([m,n]) => {
      const pri = PRIORITY.includes(m);
      return `<div style="margin-bottom:9px">
        <div class="spread" style="margin-bottom:4px">
          <span style="font-size:13.5px;${pri?'font-weight:700':'color:var(--muted)'}">${esc(m)}</span>
          <span class="tiny mono" style="${pri?'font-weight:700;color:var(--accent-1)':'color:var(--muted)'}">${n}</span>
        </div>
        <div class="meter-track" style="background:var(--bg-sunk);height:7px">
          <div class="meter-fill" style="width:${n/max*100}%;height:7px;background:${pri?'var(--accent-1)':'var(--line)'}"></div>
        </div>
      </div>`;
    }).join('')}
    <div class="hr"></div>
    <div class="grid3" style="gap:8px">
      <div><div class="tiny muted">Delts</div><b class="mono" style="font-size:16px;color:var(--accent-1)">${delts}</b></div>
      <div><div class="tiny muted">Back</div><b class="mono" style="font-size:16px;color:var(--accent-1)">${back}</b></div>
      <div><div class="tiny muted">Chest</div><b class="mono" style="font-size:16px">${chest}</b></div>
    </div>
    <div class="tiny muted" style="margin-top:10px;line-height:1.55">
      ${side < 6
        ? `Side delts are on ${side} sets a week here — low for a width goal. Phase 3 lifts that to 11 by training them twice a week.`
        : `Side delts on ${side} sets a week, chest down to ${chest}. That's the ratio that builds the V.`}
    </div>
  </div>`;
}

function focusHTML(){
  const focus = store.get().focus || {};
  const muscles = Object.keys(focus);
  if (!muscles.length) return '';
  const p = phase();
  const fits = coach.appliedTotals(p, focus);
  const total = muscles.reduce((n, m) => n + (fits[m] || 0), 0);
  const since = store.get().focusMeta?.t;
  const weeks = since ? Math.floor((Date.now() - since) / 604800000) : 0;
  return `
  <div class="card in" style="margin-top:14px">
    <div class="spread" style="align-items:baseline">
      <div class="card-title">Focus boosts</div>
      <span class="mono" style="font-weight:800;color:var(--accent-1)">+${total} sets/wk</span>
    </div>
    <div class="card-note" style="margin-top:4px;line-height:1.55">
      Extra sets added on top of the plan from your goal benchmark — about ${total * 2} extra minutes a week.
      ${since ? `Applied ${weeks ? `${weeks} week${weeks>1?'s':''} ago` : 'this week'}; worth re-benchmarking after about eight.` : ''}
    </div>
    <div class="stack" style="gap:0;margin-top:10px">
      ${muscles.map(m => `
        <div class="spread" style="padding:10px 0;border-top:1px solid var(--line-soft)">
          <div><b style="font-size:14px">${esc(m)}</b>
            <div class="tiny muted">${fits[m] === focus[m] ? `+${focus[m]} a week` : `+${fits[m] || 0} fits in this phase (asked +${focus[m]})`}</div></div>
          <button class="btn btn-ghost btn-sm" style="color:var(--bad)" data-act="rmfocus" data-m="${esc(m)}">Remove</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-plain block btn-sm" style="margin-top:8px" data-act="clearfocus">Clear all boosts</button>
  </div>`;
}

export const actions = {
  rmfocus: d => { store.update(s => { const f = { ...s.focus }; delete f[d.m]; s.focus = f; }); haptic(); render(); },
  clearfocus: () => { store.update(s => { s.focus = {}; s.focusMeta = null; }); haptic(); render(); },
};
