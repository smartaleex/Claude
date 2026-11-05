/* ============================================================
   balance.js — did the session, and the week, still balance out?

   Swapping an exercise is easy; knowing what it did to the programme is not.
   Swap assisted pull-ups for a machine iso-lateral row and the sets still
   get done, but a vertical pull (lat width) quietly became a horizontal pull
   (mid-back thickness). This works that out, in plain terms:

   - PLANNED is what the programme asked for, by the muscle each exercise was
     meant to train. DONE is what was actually logged, by the muscle of what
     you really did. The difference is the shift.
   - A session you only half-finished is not "unbalanced": shortfalls are
     judged against the share of the plan you completed.
   - A single session is not the whole story, so it also looks at the week:
     what is done, what the rest of the week still holds, and where that lands.

   Pure logic, no screens. The snapshot it works from is saved on the session
   when you finish, so the picture stays true even if you change swaps later.
   ============================================================ */

import { muscleOf } from '../data/workouts.js';
import { patternOf } from '../data/swaps.js';
import { PROFILE, LIMITS } from './training-edit.js';
import { libraryList, patternLabel } from './library.js';

const VERT = new Set(['verticalPull', 'straightArm']);
const HORIZ = new Set(['horizontalPull', 'rearDelt']);
const PUSH = new Set(['inclinePress', 'flatPress', 'chestFly', 'overheadPress', 'triceps']);

const setsOf = ex => parseInt(ex.sets, 10) || 1;
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
/* "lats lose", "chest loses": muscle names that end in s are plural */
const plural = m => /s$/i.test(m);
const verb = (m, one, many) => (plural(m) ? many : one);

/* ---------------- the snapshot ---------------- */
/** One row per exercise: where it sits, what the programme had, what you did, how many sets each.
    { k:'0-1', o:'Assisted pull-up machine', n:'Machine iso-lateral row', p:4, d:3 }  */
export function snapshotSession(day, sets, nameOf = ex => ex.name){
  const rows = [];
  (day?.supersets || []).forEach((ss, si) => ss.exercises.forEach((ex, ei) => {
    const k = `${si}-${ei}`;
    rows.push({ k, o: ex.name, n: nameOf(ex), p: setsOf(ex), d: (sets?.[k] || []).length });
  }));
  return rows;
}

const tally = (rows, nameKey, setsKey) => {
  const out = {};
  for (const r of rows){ const m = muscleOf(r[nameKey]); out[m] = (out[m] || 0) + r[setsKey]; }
  return out;
};

/* ---------------- describing one swap ---------------- */
const KIND = name => { const p = patternOf(name); return VERT.has(p) ? 'vertical' : HORIZ.has(p) ? 'horizontal' : PUSH.has(p) ? 'push' : null; };

/** In plain words, what swapping `from` for `to` changes. */
export function swapText(from, to, sets = 0){
  const a = muscleOf(from), b = muscleOf(to), pa = patternOf(from), pb = patternOf(to);
  const n = sets ? `${sets} set${sets === 1 ? '' : 's'}` : 'its sets';
  if (a === b && pa === pb) return { kind: 'same', brief: 'same movement', text: 'Same movement, different kit. Nothing changes in the balance.' };
  const brief = `${lower(patternLabel(pa))} became ${lower(patternLabel(pb))}`;
  if (a === b) return { kind: 'angle', brief, text: `Same muscle, a different angle: ${brief}.` };
  const prio = PROFILE.priority.includes(a) ? ' This is one of your width muscles.' : '';
  return { kind: 'muscle', brief, text: `${patternLabel(pa)} became ${lower(patternLabel(pb))}: ${a.toLowerCase()} ${verb(a, 'loses', 'lose')} ${n} and ${b.toLowerCase()} ${verb(b, 'gains', 'gain')} ${n}.${prio}` };
}

/** Before you commit to a swap: what it does to today's session. `day` is the programme day, `nameOf` gives
    each exercise's name as it stands now (with swaps already in force). */
export function swapEffect(day, orig, to, nameOf = ex => ex.name){
  const rows = snapshotSession(day, {}, nameOf);
  const row = rows.find(r => r.o === orig);
  if (!row) return null;
  const before = tally(rows, 'n', 'p');
  const after = tally(rows.map(r => (r === row ? { ...r, n: to } : r)), 'n', 'p');
  const deltas = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .map(m => ({ muscle: m, before: before[m] || 0, after: after[m] || 0 }))
    .filter(d => d.before !== d.after);
  return { ...swapText(row.n, to, row.p), sets: row.p, deltas };
}

/* ---------------- the session ---------------- */
/** @returns the whole picture: totals, muscles planned vs done, swaps, movements and a verdict. */
export function balanceOf(rows, week = null){
  const planned = rows.reduce((n, r) => n + r.p, 0);
  const done = rows.reduce((n, r) => n + r.d, 0);
  if (!done) return { logged: false, planned, done: 0 };

  const completion = Math.min(1, done / planned);
  const P = tally(rows, 'o', 'p'), D = tally(rows, 'n', 'd');
  const muscles = [...new Set([...Object.keys(P), ...Object.keys(D)])].map(muscle => {
    const pl = P[muscle] || 0, dn = D[muscle] || 0;
    const expected = Math.round(pl * completion * 10) / 10;
    const delta = Math.round((dn - expected) * 10) / 10;
    const state = expected >= 2 && delta <= -Math.max(2, expected * 0.3) ? 'short'
                : delta >= 2 && delta >= Math.max(2, expected * 0.3) ? 'extra' : 'ok';
    return { muscle, planned: pl, done: dn, expected, delta, state, priority: PROFILE.priority.includes(muscle) };
  }).sort((a, b) => (b.priority - a.priority) || (b.planned - a.planned) || a.muscle.localeCompare(b.muscle));

  const swaps = rows.filter(r => r.o !== r.n).map(r => ({ from: r.o, to: r.n, sets: r.d || r.p, ...swapText(r.o, r.n, r.d || r.p) }));

  const move = (nameKey, setsKey) => rows.reduce((o, r) => { const k = KIND(r[nameKey]); if (k) o[k] += r[setsKey]; return o; }, { vertical: 0, horizontal: 0, push: 0 });
  const mp = move('o', 'p'), md = move('n', 'd');
  const moves = {
    vertical: { planned: mp.vertical, done: md.vertical },
    horizontal: { planned: mp.horizontal, done: md.horizontal },
    push: { planned: mp.push, done: md.push },
    pullDone: md.vertical + md.horizontal, pushDone: md.push,
  };

  // the week decides whether a single-session shift matters
  const weekShort = m => week?.[m]?.short ?? 0;
  const shortMuscles = muscles.filter(m => m.state === 'short');
  const lost = new Set(swaps.filter(s => s.kind === 'muscle').map(s => muscleOf(s.from)));      // muscles a swap took work from
  const lopsidedMuscles = muscles.filter(m => m.priority && (week
    ? weekShort(m.muscle) >= 3 && (m.state === 'short' || lost.has(m.muscle))
    : m.state === 'short' && m.delta <= -3));
  const pullLight = moves.pushDone >= 6 && moves.pullDone < moves.pushDone * 0.6;
  // how to say the week stands for the muscles the swaps took work from
  const gap = Math.max(0, ...[...lost].map(weekShort));
  const weekNote = !week ? '' : gap === 0 ? '. The rest of your week covers it'
    : gap < 3 ? `. That leaves it about ${gap} set${gap === 1 ? '' : 's'} under plan this week` : '. The rest of your week does not cover it';

  let level = 'balanced', headline;
  if (lopsidedMuscles.length || pullLight){
    level = 'lopsided';
    const m = lopsidedMuscles[0];
    headline = m
      ? `Lopsided: ${m.muscle.toLowerCase()} ${verb(m.muscle, 'is', 'are')} ${Math.max(1, Math.round(Math.abs(m.delta)))} sets short${week ? ' and the rest of the week does not cover it' : ''}.`
      : 'Lopsided: a lot more pushing than pulling today. Protect the shoulder with a row or pulldown next time.';
  } else if (swaps.some(s => s.kind !== 'same') || shortMuscles.length || muscles.some(m => m.state === 'extra')){
    level = 'shifted';
    const s = swaps.find(x => x.kind !== 'same');
    headline = s ? `Shifted: ${s.brief}${weekNote}.`
                 : `A little off: ${shortMuscles.map(m => `${m.muscle.toLowerCase()} ${Math.max(1, Math.round(Math.abs(m.delta)))} short`).join(', ') || 'some muscles ran heavier than planned'}.`;
  } else {
    headline = completion < 0.8 ? `Balanced. You did about ${Math.round(completion * 100)}% of the sets, in proportion.` : 'Balanced. You trained what the plan asked for.';
  }
  return { logged: true, planned, done, completion, muscles, swaps, moves, level, headline };
}

/* ---------------- the week ---------------- */
/** Where the week stands per muscle.
    days: the programme's days. sessions: sessions done this week, each with rows (see snapshotSession).
    nameOf(ex, dayKey): the exercise's name with the swaps in force, used for days still to come. */
export function weekView(days, sessions, nameOf = ex => ex.name){
  const out = {};
  const slot = m => (out[m] ||= { plan: 0, done: 0, remaining: 0, projected: 0, short: 0 });
  for (const d of days) for (const ss of d.supersets) for (const ex of ss.exercises) slot(muscleOf(ex.name)).plan += setsOf(ex);
  const trained = new Set(sessions.map(s => s.day));
  for (const s of sessions) for (const r of s.rows) slot(muscleOf(r.n)).done += r.d;
  for (const d of days) if (!trained.has(d.key)) for (const ss of d.supersets) for (const ex of ss.exercises) slot(muscleOf(nameOf(ex, d.key))).remaining += setsOf(ex);
  for (const v of Object.values(out)){
    v.projected = v.done + v.remaining;
    v.short = Math.max(0, Math.round(v.plan * 0.85) - v.projected);      // within about 15% of the plan counts as on track
  }
  return out;
}

/** What to add to even the week out, for the priority muscles that would end short. */
export function suggestions(week, days, custom = {}){
  const out = [];
  for (const m of PROFILE.priority){
    const v = week?.[m];
    if (!v || v.short < 3) continue;
    const pool = libraryList(custom).filter(x => x.muscle === m && x.source === 'library' && x.idx !== undefined
      && !LIMITS.some(l => l.level === 'no' && l.re.test(x.name)));
    const rank = x => (x.gear === 'machine' || x.gear === 'cable' ? 0 : x.gear === 'dumbbell' ? 1 : 2);
    const picks = pool.sort((a, b) => rank(a) - rank(b)).slice(0, 2).map(x => x.name);
    const day = days.map(d => ({ d, n: d.supersets.flatMap(s => s.exercises).filter(e => muscleOf(e.name) === m).reduce((n, e) => n + setsOf(e), 0) }))
      .sort((a, b) => b.n - a.n)[0]?.d;
    if (picks.length) out.push({ muscle: m, sets: Math.min(4, v.short), exercises: picks, dayTitle: day?.title || '' });
  }
  return out;
}
