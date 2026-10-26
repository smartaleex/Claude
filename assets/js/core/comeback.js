/* ============================================================
   comeback.js — getting back into it after time off.

   Two problems, kept separate on purpose.

   1. The week back is where people get hurt or quit. Walking back in at
      full volume and full weights after a break is how a tendon flares or
      a session wrecks you and the next one never happens. So a gap of ten
      days or more starts a three-week ramp on its own (volume 60%, 75%,
      90%; weights opened a little under last time), and it can be
      switched off. Nothing about it is a penalty: two sessions in a week
      counts as a win while it runs.

   2. A plan, written from what the app already knows (sessions, weight,
      intake, photos), so "where am I and what do I do" has an answer that
      does not depend on a free key or a good day. Pure: no DOM, no
      network, so the rules can be tested.
   ============================================================ */

export const GAP_DAYS = 10;
export const RAMP = [
  { factor: 0.60, weights: 0.85, rpe: 'RPE 6 to 7. Stop with 3 reps in the tank.' },
  { factor: 0.75, weights: 0.90, rpe: 'RPE 7. Stop with 2 to 3 reps in the tank.' },
  { factor: 0.90, weights: 0.95, rpe: 'RPE 7 to 8. Nearly normal.' },
];
const MIN_LOG = 300;          // below this a day's food log is "forgot to log"

const ms = k => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const days = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);

export const lastDone = sessions =>
  Object.values(sessions || {}).filter(s => s.done).map(s => s.dayKey).sort().at(-1) || null;

export const gapDays = (sessions, todayKey) => {
  const l = lastDone(sessions);
  return l ? days(l, todayKey) : null;
};

/** Sessions completed in each of the last n Monday-to-Sunday weeks, oldest first. */
export function weeklyCounts(sessions, todayKey, n = 4){
  const t = new Date(ms(todayKey));
  const mondayMs = ms(todayKey) - ((t.getUTCDay() + 6) % 7) * 864e5;
  const out = Array(n).fill(0);
  for (const s of Object.values(sessions || {})){
    if (!s.done) continue;
    if (!s.dayKey) continue;
    const t = ms(s.dayKey);
    if (t >= mondayMs){ out[n - 1]++; continue; }                          // this week
    const back = Math.ceil((mondayMs - t) / (7 * 864e5));                  // 1 = last week
    if (back >= 1 && back < n) out[n - 1 - back]++;
  }
  return out;
}

/** Where the ramp is right now. `c` = { start, weeks, off }. */
export function rampState(c, todayKey){
  if (!c || c.off || !c.start) return { active:false };
  const d = days(c.start, todayKey);
  const weeks = Math.min(RAMP.length, c.weeks || RAMP.length);
  if (d < 0 || d >= weeks * 7) return { active:false, finished:true };
  const week = Math.floor(d / 7) + 1;
  const r = RAMP[week - 1];
  return { active:true, week, weeks, factor:r.factor, weights:r.weights, rpe:r.rpe, daysLeft: weeks * 7 - d };
}

/** Start one automatically after a long gap, once per gap. */
export function shouldStartRamp(c, sessions, todayKey){
  const l = lastDone(sessions);
  if (!l) return false;                                  // never trained: nothing to ramp back from
  if (days(l, todayKey) < GAP_DAYS) return false;
  if (rampState(c, todayKey).active) return false;
  return !c || c.start <= l;                             // not already offered for this gap
}

/** Sets to do during the ramp. Never below 1, and never touches a single set. */
export const scaleSets = (n, factor = 1) => n <= 1 ? n : Math.max(1, Math.round(n * factor));

const step = kg => kg >= 20 ? Math.round(kg / 2.5) * 2.5 : Math.max(1, Math.round(kg));
/** A weight to open with, a little under the last one. */
export const openingWeight = (prev, wFactor = 1) =>
  (Number.isFinite(+prev) && +prev > 0) ? step(+prev * wFactor) : null;

/** Sessions that make a week a good week. */
export const weekTarget = ramp => ramp?.active ? 3 : 4;
export const weekMinimum = 2;

/* ---------------- the plan ---------------- */

export function backOnTrack({ sessions, todayKey, weights = {}, fuel = {}, physique = {}, photoKeys = null, ramp } = {}){
  const items = [];
  const gap = gapDays(sessions, todayKey);
  const counts = weeklyCounts(sessions, todayKey, 4);
  const lastFour = counts.reduce((a, b) => a + b, 0);

  // ---- training
  let headline;
  if (gap == null) headline = 'No sessions logged yet. Start with one.';
  else if (gap <= 7) headline = 'You are in a rhythm. Keep it boring.';
  else headline = `${gap} days since your last session.`;

  const target = weekTarget(ramp);
  items.push({
    k:'train', title:'Training',
    tone: gap != null && gap >= GAP_DAYS ? 'warn' : 'good',
    body: ramp?.active
      ? `Comeback week ${ramp.week} of ${ramp.weeks}: sets are at ${Math.round(ramp.factor * 100)}% and weights open about ${Math.round((1 - ramp.weights) * 100)}% under last time. Aim for ${target} sessions. ${ramp.rpe} Two sessions still counts as a win.`
      : gap != null && gap >= GAP_DAYS
        ? 'Start the comeback ramp: three weeks building back to full volume. It is the fastest way to be at full strength without a setback.'
        : `Aim for ${target} sessions a week. Two is a win; zero is the only bad week.`,
    detail: `${lastFour} session${lastFour === 1 ? '' : 's'} in the last four weeks`,
  });

  // ---- food (the usual reason a physique shrinks)
  const dayMap = fuel.days || {};
  const target_kcal = fuel.targets?.kcal || 2800;
  const logged = [];
  for (let i = 1; i <= 7; i++){
    const k = new Date(ms(todayKey) - i * 864e5).toISOString().slice(0, 10);
    const kcal = (dayMap[k] || []).reduce((n, e) => n + (+e.kcal || 0), 0);
    if (kcal >= MIN_LOG) logged.push(kcal);
  }
  let avg = null, short = null;
  if (logged.length >= 3){
    avg = Math.round(logged.reduce((a, b) => a + b, 0) / logged.length);
    short = target_kcal - avg;
  }
  if (avg == null){
    items.push({ k:'food', title:'Food', tone:'neutral',
      body:'Log what you eat for the next three days, even badly. You cannot fix a number you cannot see, and eating too little is the commonest reason muscle disappears.' });
  } else if (short > 300){
    const add = Math.min(500, Math.round(short / 2 / 50) * 50);
    items.push({ k:'food', title:'Food', tone:'warn',
      body:`You are averaging about ${avg.toLocaleString()} kcal against a ${target_kcal.toLocaleString()} target, so roughly ${short.toLocaleString()} short. At that intake the body cannot build muscle and will give some up. That alone can explain feeling smaller. Do not try to fix it all at once: add about ${add} kcal a day this week (a milk-and-oats shake or a sandwich with the protein in it), then reassess. If it is appetite that is missing rather than time, liquid calories count, and a lasting loss of appetite is worth telling your doctor.`,
      detail:`${logged.length} logged days · avg ${avg.toLocaleString()} kcal` });
  } else {
    items.push({ k:'food', title:'Food', tone:'good',
      body:`Averaging about ${avg.toLocaleString()} kcal, close to the ${target_kcal.toLocaleString()} target. Food is not what is holding you back.`,
      detail:`${logged.length} logged days` });
  }

  // ---- weight
  const wk = Object.keys(weights).sort();
  const cur = wk.length ? weights[wk.at(-1)] : null;
  const since = wk.length ? days(wk.at(-1), todayKey) : null;
  const goal = physique.goal, rate = 0.3;
  if (cur == null){
    items.push({ k:'weight', title:'Weight', tone:'neutral',
      body:'Weigh in on waking, twice a week, and log it in Fuel. Two numbers a week is enough to tell whether the plan is working.' });
  } else {
    const toGo = goal ? Math.round((goal - cur) * 10) / 10 : null;
    items.push({ k:'weight', title:'Weight', tone: since > 14 ? 'warn' : 'neutral',
      body: `${cur} kg${since > 14 ? `, last logged ${since} days ago, so weigh in again` : ''}.${toGo > 0 ? ` ${toGo} kg to your ${goal} kg goal. At a realistic ${rate} kg a week that is about ${Math.ceil(toGo / rate)} weeks, and a lot of the first few kilos return quickly because the muscle was built once already.` : ''}`,
      detail: since != null ? `last weigh-in ${since === 0 ? 'today' : since + ' days ago'}` : '' });
  }

  // ---- photos (skipped while they are still loading)
  if (photoKeys){
  const pk = [...photoKeys].sort();
  const psince = pk.length ? days(pk.at(-1), todayKey) : null;
  items.push({ k:'photos', title:'Photos', tone: psince == null || psince > 21 ? 'warn' : 'neutral',
    body: psince == null
      ? 'Take a front, side and back photo in the same light and place. That is your baseline.'
      : psince > 21
        ? `Last photo was ${psince} days ago. Take a new set: same spot, same light. Then compare it to your best one, and ask for a read on the difference.`
        : 'Your photos are up to date. Compare the newest to your best one to see where you actually stand.' });
  }

  return { headline, gap, counts, lastFour, avgKcal: avg, short, items };
}
