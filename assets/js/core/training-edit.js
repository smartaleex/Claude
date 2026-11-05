/* ============================================================
   training-edit.js — changing the program in plain words, and checking
   each change against who it is for.

   Three jobs, all pure (no screens, no storage), so they are testable:

   1. READ  what was typed. parseEdits() reads simple phrasings offline
      ("swap incline press for DB press", "3x10 on leg curl", "drop the
      shrugs", "cables read in lb"); the AI path returns the same shape.
   2. CHECK each change. benchmark() weighs it against the person: the
      shoulder, the triceps tendon, the knees, the back, the physique being
      built, how much he is eating, and whether he is mid comeback. It never
      refuses; it says "good fit", "worth a look" or "not advised" and why.
   3. APPLY. applyEdits() lays saved changes over the program. Swaps and
      stack settings are not applied here; they use the saved maps the swap
      sheet already writes, so weights convert and the existing "back to
      original" keeps working.

   A change is { type, day, exercise (name now), orig (program's name), ... }.
   Types: swap, sets, reps, rest, add, remove, stack.
   ============================================================ */

import { muscleOf, weeklyVolume, sessionMinutes, PHYSIQUE } from '../data/workouts.js';
import { patternOf, gearOf, swapsFor, SWAPS } from '../data/swaps.js';

/* ---------------- who this is for ---------------- */
export const PROFILE = {
  heightCm: PHYSIQUE.height, startKg: PHYSIQUE.start, goalKg: PHYSIQUE.goal,
  minutes: 40, minutesMax: 52,                 // a session is meant to be about 40 minutes
  /* The muscles that make the V-taper: cutting these works against the goal. */
  priority: ['Side delts', 'Lats', 'Chest', 'Rear delts & traps'],
  armCap: 20,                                  // biceps + triceps sets a week before it is mostly fatigue
  maxSets: 5, minReps: 6,
};

/* What to be careful of, by name. `no` = the program deliberately avoids it;
   `check` = fine for most people, needs thought for this body. Not medical advice. */
export const LIMITS = [
  { id:'shoulder', level:'no',
    re:/behind[- ]the[- ]neck|upright row|(barbell|bb|military|standing) (overhead|shoulder) press|\bohp\b|barbell bench|flat barbell|snatch|\bjerk\b/i,
    why:'Loads the shoulder at end range or overhead with a barbell. With an unstable, hypermobile shoulder the joint has little passive protection there.' },
  { id:'shoulder', level:'check',
    re:/\bdips?\b|overhead press|arnold|deep|\bfly\b|\bflye?s?\b|pec deck|pull-?over|incline (db|dumbbell) press|flat (db|dumbbell)/i,
    why:'Puts the shoulder into a deep stretch. Keep the range controlled and stop where the front of the shoulder starts to complain.' },
  { id:'elbow', level:'check',
    re:/skull ?crusher|french press|overhead (cable |db |dumbbell )?(triceps )?extension|close[- ]grip (bench|press)|\bdips?\b|lockout/i,
    why:'Hard lockouts and overhead triceps positions are what flare the distal triceps tendon. Pushdowns with a soft finish are kinder.' },
  { id:'knees', level:'check',
    re:/jump|plyo|sissy|lunge|bulgarian|split squat|leg extension|back squat|barbell squat|hack squat/i,
    why:'Your knees cave inward under load. Heavy single-leg and open-chain knee work needs the knee tracking over the toes, so go lighter and slower.' },
  { id:'back', level:'check',
    re:/deadlift|good ?morning|barbell row|bent[- ]over (bb|barbell)? ?row|back squat|barbell squat|romanian|\brdl\b/i,
    why:'Loads the lower back, and tight glutes already pull on it. Chest-supported or machine versions give you the muscle without the back cost.' },
];

/* ---------------- reading words ---------------- */
const STOP = new Set(['the','a','an','my','of','on','in','to','for','with','and','day','exercise','please','just','only','it','that','this','instead','set','sets','reps','rep','rest','make','change','swap','replace','use','add','remove','drop','skip','cut','from','at','each','per','x']);
const norm = s => String(s || '').toLowerCase().replace(/\bdumb-?bells?\b/g, 'db').replace(/\bbarbells?\b/g, 'bb').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const stem = w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const tokens = s => norm(s).split(' ').filter(w => w && !STOP.has(w)).map(stem);

/* "side delts", "lats", "chest": a muscle named instead of an exercise. */
const MUSCLE_ALIASES = [
  ['side delt', 'Side delts'], ['lateral', 'Side delts'], ['rear delt', 'Rear delts & traps'], ['front delt', 'Front delts'],
  ['lat', 'Lats'], ['chest', 'Chest'], ['bicep', 'Biceps'], ['tricep', 'Triceps'], ['hamstring', 'Hamstrings'],
  ['quad', 'Quads'], ['calf', 'Calves'], ['glute', 'Glutes'], ['trap', 'Traps'], ['core', 'Core'], ['ab', 'Core'],
];

/** Which exercises does `query` mean? Returns { hits:[{day,si,ei,name,orig}], ambiguous:[names] }. */
export function findExercise(query, days, swaps = {}){
  const q = tokens(query);
  if (!q.length) return { hits: [], ambiguous: [] };
  const scored = [];
  for (const d of days) d.supersets.forEach((ss, si) => ss.exercises.forEach((ex, ei) => {
    const shown = swaps[`${d.key}|${ex.name}`] || ex.name;
    const n = new Set([...tokens(shown), ...tokens(ex.name)]);
    const hit = q.filter(w => n.has(w)).length;
    const score = hit / q.length;
    if (score >= 0.75) scored.push({ day: d.key, si, ei, name: shown, orig: ex.name, score, tight: hit / n.size });
  }));
  if (!scored.length){
    // no exercise by that name: maybe a muscle ("4 sets of side delts")
    const text = q.join(' ');
    const alias = MUSCLE_ALIASES.find(([w]) => text === w || text === w + ' delt' || text.split(' ').includes(w));
    if (!alias) return { hits: [], ambiguous: [] };
    for (const d of days) d.supersets.forEach((ss, si) => ss.exercises.forEach((ex, ei) => {
      const shown = swaps[`${d.key}|${ex.name}`] || ex.name;
      if (muscleOf(shown) === alias[1]) scored.push({ day: d.key, si, ei, name: shown, orig: ex.name, score: 1, tight: 1 });
    }));
    const names = [...new Set(scored.map(h => h.name))];
    return names.length > 1 ? { hits: [], ambiguous: names } : { hits: scored, ambiguous: [] };
  }
  const best = Math.max(...scored.map(s => s.score));
  const top = scored.filter(s => s.score === best);
  // Of equally good matches, prefer the one the words fit most closely, but only if it is clearly closer.
  const tights = [...new Set(top.map(s => s.tight))].sort((a, b) => b - a);
  const clear = tights.length === 1 || tights[0] - tights[1] >= 0.15;
  const hits = clear ? top.filter(s => s.tight === tights[0]) : top;
  const names = [...new Set(hits.map(h => h.name))];
  return names.length > 1 ? { hits: [], ambiguous: names } : { hits, ambiguous: [] };
}

const DAY_WORDS = { back:'d1', biceps:'d1', lats:'d1', chest:'d2', triceps:'d2', legs:'d3', leg:'d3', core:'d3', shoulders:'d4', shoulder:'d4', delts:'d4', arms:'d4' };

/** "on chest day", "day 3", "in the shoulders session" -> a day key, or null.
    Only explicit: "my shoulder clicks" is a complaint about a joint, not a day. */
export function dayFromText(text, days){
  const t = norm(text);
  const num = /\bday (\d)\b/.exec(t);
  if (num && days.some(d => d.key === 'd' + num[1])) return 'd' + num[1];
  for (const d of days){
    const words = Object.keys(DAY_WORDS).filter(w => DAY_WORDS[w] === d.key);
    if (words.some(w => new RegExp(`\\b${w}\\s+(?:day|session|workout)\\b|\\b(?:day|session|workout)\\s+(?:for\\s+)?${w}\\b|\\bon\\s+${w}\\b`).test(t))) return d.key;
  }
  return null;
}

const toReps = s => String(s).replace(/\s+/g, '').replace('-', '–');
const toRest = (n, unit) => /^m/i.test(unit || '') ? `${Math.round(n * 60)}s` : `${Math.round(n)}s`;

/* The text with the number-ish words taken out, so what is left names the exercise. */
const stripNumbers = s => s
  .replace(/\beach\s+(?:side|leg|arm)\b/gi, ' ')
  .replace(/\d+\s*(?:x|sets? of|sets?)\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?/gi, ' ')
  .replace(/\d+\s*sets?\b/gi, ' ')
  .replace(/\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*reps?\b/gi, ' ')
  .replace(/reps?\s*(?:to|of|at)?\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?/gi, ' ')
  .replace(/rest\s*(?:of|to|at)?\s*\d{1,3}\s*(?:seconds?|secs?|minutes?|mins?|s|m)?/gi, ' ')
  .replace(/\d{1,3}\s*(?:seconds?|secs?)\s*rest/gi, ' ')
  .replace(/\bon\s+(?:the\s+)?[a-z]+\s+day\b|\bday\s*\d\b|\b[a-z]+\s+day\b/gi, ' ');

const cutTail = s => s.split(/\s*(?:,|;|\bbecause\b|\bas\b|\bsince\b|\bmy\b(?=\s+(?:shoulder|elbow|knee|back)))/i)[0].trim();

/* Sentences, then "and" / "then" where a second instruction really starts: a new verb, a number
   with a unit, or a stack setting. Anything else stays together ("swap X for Y and Z"). */
const NEW_INSTRUCTION = /^(?:swap|replace|make|set|drop|remove|add|change|use|cut|skip|switch)\b|\d\s*(?:x|sets?|reps?|s\b|sec|min)|\bto\s+\d|\b(?:cable|machine)s?\b.*\b(?:lbs?|kgs?|pounds?|2\s*:\s*1)/i;
function splitClauses(text){
  return String(text || '').split(/[.;\n]+/).flatMap(sentence => {
    const parts = sentence.split(/\s+(?:and|then|also)\s+/i);
    const out = [parts[0]];
    for (const part of parts.slice(1)){
      if (NEW_INSTRUCTION.test(part)) out.push(part); else out[out.length - 1] += ' and ' + part;
    }
    return out.map(c => c.trim()).filter(Boolean);
  });
}

/* Names the way the program writes them: sentence case, DB and EZ in capitals. */
const pretty = name => {
  const t = String(name).trim().replace(/\s+/g, ' ').toLowerCase().replace(/\bdb\b/g, 'DB').replace(/\bez\b/g, 'EZ').replace(/\brdl\b/g, 'RDL');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* ---------------- offline reader ---------------- */
/** Read plain English into raw changes. `days` is the program as it stands. */
export function parseEdits(text, days, swaps = {}){
  const ops = [], notes = [];
  const clauses = splitClauses(text);

  for (const c of clauses){
    const day = dayFromText(c, days);
    let m;

    // the stack at this gym
    if (/\b(cable|machine)s?\b/i.test(c) && /\b(lbs?|pounds?|kgs?|kilos?|2\s*:\s*1|1\s*:\s*2|pulley|doubl|halv)/i.test(c) && !/\b(swap|replace|add|remove|drop)\b/i.test(c)){
      const gear = /\bcable/i.test(c) ? 'cable' : 'machine';
      const op = { type: 'stack', gear };
      if (/\b(lbs?|pounds?)\b/i.test(c)) op.unit = 'lb';
      else if (/\b(kgs?|kilos?)\b/i.test(c)) op.unit = 'kg';
      if (/2\s*:\s*1|doubl|pulley|reads? (double|twice)/i.test(c)) op.ratio = 2;
      else if (/1\s*:\s*1|\bmatch|\bsame\b|\bnormal\b/i.test(c)) op.ratio = 1;
      if (op.unit || op.ratio) ops.push(op); else notes.push(`Could not tell what to change about the ${gear} stack: "${c}"`);
      continue;
    }

    // swap: "swap A for B" / "use B instead of A" / "A is busy, use B"
    if ((m = /\b(?:swap|replace|switch|change|substitute)\s+(?:out\s+)?(?:the\s+|my\s+)?(.+?)\s+(?:for|with|to|into|by)\s+(?:the\s+|a\s+|an\s+)?(.+)/i.exec(c))
        && !/^\d/.test(m[2]) && !/\b(?:sets?|reps?|rest|seconds?)\b/i.test(m[1])) {
      ops.push({ type: 'swap', day, from: m[1].trim(), to: cutTail(m[2]) }); continue;
    }
    if ((m = /\buse\s+(?:the\s+|a\s+)?(.+?)\s+(?:instead of|in place of|rather than)\s+(?:the\s+)?(.+)/i.exec(c))) {
      ops.push({ type: 'swap', day, from: cutTail(m[2]), to: cutTail(m[1]) }); continue;
    }
    if ((m = /(.+?)\s+(?:is|are)\s+(?:busy|taken|broken|out of order|not working)[\s,;-]*(?:so\s+)?(?:use|do|try)\s+(?:the\s+|a\s+)?(.+)/i.exec(c))) {
      ops.push({ type: 'swap', day, from: m[1].trim(), to: cutTail(m[2]) }); continue;
    }

    // remove
    if ((m = /\b(?:remove|drop|delete|skip|cut|get rid of|take out)\s+(?:the\s+|my\s+)?(.+)/i.exec(c))) {
      ops.push({ type: 'remove', day, exercise: cutTail(m[1]) }); continue;
    }

    // add
    if ((m = /\badd\s+(?:a\s+|an\s+|some\s+)?(.+)/i.exec(c))) {
      const body = m[1];
      const sx = /(\d)\s*(?:x|sets? of|sets?)\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)/i.exec(body);
      const name = stripNumbers(body).replace(/\b(?:to|on|for)\b.*$/i, '').replace(/\s+/g, ' ').trim();
      if (!name){ notes.push(`Add what? "${c}"`); continue; }
      ops.push({ type: 'add', day, exercise: pretty(name), sets: sx ? +sx[1] : 3, reps: sx ? toReps(sx[2]) : '10–12', rest: '60s' });
      continue;
    }

    // sets / reps / rest on a named exercise
    const sx = /(\d)\s*(?:x|sets? of|sets? x)\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)/i.exec(c);
    const setsM = sx || /(\d)\s*sets?\b/i.exec(c);
    const repsM = /(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)\s*reps?\b/i.exec(c) || /reps?\s*(?:to|of|at)?\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)/i.exec(c);
    const sets = setsM ? +setsM[1] : null;
    const reps = sx ? toReps(sx[2]) : repsM ? toReps(repsM[1]) : null;
    const rm = /rest\s*(?:of|to|at)?\s*(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|s|m)?|(\d{1,3})\s*(seconds?|secs?)\s*rest/i.exec(c);
    // "change the rest on pushdown to 60s": the number comes after the exercise
    const rm2 = !rm && /\brest\b/i.test(c) ? /\b(?:to|at|of)\s*(\d{1,3})\s*(seconds?|secs?|minutes?|mins?|s|m)\b/i.exec(c) : null;
    const rest = rm ? toRest(+(rm[1] || rm[3]), rm[2] || rm[4] || 's') : rm2 ? toRest(+rm2[1], rm2[2]) : null;
    if (sets == null && reps == null && rest == null){ notes.push(`Could not read: "${c}"`); continue; }
    const name = stripNumbers(c).replace(/\b(?:make|set|change|do|to|put|keep)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!name){ notes.push(`Which exercise? "${c}"`); continue; }
    if (sets != null) ops.push({ type: 'sets', day, exercise: name, sets });
    if (reps != null) ops.push({ type: 'reps', day, exercise: name, reps });
    if (rest != null) ops.push({ type: 'rest', day, exercise: name, rest });
  }
  return { ops, notes };
}

/* ---------------- raw changes -> concrete changes on real exercises ---------------- */
const num = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const okReps = s => /^\d{1,2}(–\d{1,2})?( each( side| leg)?)?$/.test(s);

/** Check and expand raw changes (from the offline reader or the AI) against the real program.
    Returns { ops, notes } where each op has a day, the exercise as shown now (`exercise`) and the
    program's own name (`orig`). Anything that cannot be made sense of becomes a note. */
export function resolveOps(raw, days, swaps = {}){
  const ops = [], notes = [];
  const byKey = Object.fromEntries(days.map(d => [d.key, d]));
  for (const r of raw || []){
    const type = String(r?.type || '');
    const why = r?.why ? { why: String(r.why).slice(0, 240) } : {};
    if (type === 'stack'){
      const gear = r.gear === 'cable' || r.gear === 'machine' ? r.gear : null;
      const unit = r.unit === 'lb' || r.unit === 'kg' ? r.unit : null;
      const ratio = r.ratio != null ? num(r.ratio, 1, 4) : null;
      if (gear && (unit || ratio)) ops.push({ type, gear, ...(unit && { unit }), ...(ratio && { ratio }), ...why });
      else notes.push('A stack change needs cable or machine, and a unit or a ratio.');
      continue;
    }
    if (type === 'add'){
      const day = r.day && byKey[r.day] ? r.day : null;
      const name = String(r.exercise || '').trim().slice(0, 60);
      const sets = num(r.sets ?? 3, 1, 8), reps = toReps(r.reps ?? '10–12');
      const rest = /^\d{1,3}s$/.test(String(r.rest || '60s')) ? String(r.rest || '60s') : '60s';
      if (!day){ notes.push(`Which day should "${name || 'it'}" go on?`); continue; }
      if (!name || sets == null || !okReps(reps)){ notes.push(`Could not add "${name}": check the sets and reps.`); continue; }
      ops.push({ type, day, exercise: name, orig: name, sets, reps, rest, ...why });
      continue;
    }
    if (!['swap', 'sets', 'reps', 'rest', 'remove'].includes(type)){ notes.push(`Unknown change: ${type}`); continue; }

    const query = type === 'swap' ? r.from ?? r.exercise : r.exercise;
    const scope = r.day && byKey[r.day] ? days.filter(d => d.key === r.day) : days;
    const found = findExercise(query, scope, swaps);
    if (found.ambiguous.length){ notes.push(`"${query}" could be ${found.ambiguous.slice(0, 3).join(', ')}. Say which one.`); continue; }
    if (!found.hits.length){ notes.push(`Could not find "${query}" in your program.`); continue; }

    for (const h of found.hits){
      const base = { type, day: h.day, si: h.si, ei: h.ei, exercise: h.name, orig: h.orig, ...why };
      if (type === 'swap'){
        const to = String(r.to || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!to || norm(to) === norm(h.name)){ notes.push(`Swap "${h.name}" for what?`); continue; }
        ops.push({ ...base, to: findOption(to) || byGear(to, h.orig) || pretty(to), ...(r.gear && { gear: r.gear }) });
      } else if (type === 'sets'){
        const n = num(r.sets, 1, 8);
        if (n == null){ notes.push(`Sets for "${h.name}" should be 1 to 8.`); continue; }
        ops.push({ ...base, sets: n });
      } else if (type === 'reps'){
        const reps = toReps(r.reps);
        if (!okReps(reps)){ notes.push(`Reps for "${h.name}" should look like 10 or 8–12.`); continue; }
        ops.push({ ...base, reps });
      } else if (type === 'rest'){
        const s = parseInt(r.rest, 10);
        if (!Number.isFinite(s) || s < 0 || s > 300){ notes.push(`Rest for "${h.name}" should be 0 to 300 seconds.`); continue; }
        ops.push({ ...base, rest: `${s}s` });
      } else ops.push(base);
    }
  }
  return { ops, notes };
}

/* "the DB one", "a cable version": the one option of that kit for this movement, if there is exactly one. */
const KIT_WORDS = { db: 'dumbbell', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine', bb: 'barbell', barbell: 'barbell', bodyweight: 'bodyweight' };
function byGear(text, fromName){
  const words = norm(text).split(' ').filter(w => !STOP.has(w));
  const kit = words.map(w => KIT_WORDS[w]).find(Boolean);
  const rest = words.filter(w => !KIT_WORDS[w] && !/^(one|version|variation|variant|option|kind|type|equivalent|alternative|instead)$/.test(w));
  if (!kit || rest.length) return null;
  const opts = (swapsFor(fromName)?.options || []).filter(o => o.gear === kit);
  return opts.length === 1 ? opts[0].name : null;
}

/* "db press" -> the known option name if there is one, so weights and kit convert. */
function findOption(text){
  const q = tokens(text);
  if (!q.length) return null;
  let best = null, bestScore = 0;
  for (const g of Object.values(SWAPS)) for (const o of g.options){
    const n = new Set(tokens(o.name));
    const hit = q.filter(w => n.has(w)).length;
    const score = hit / Math.max(q.length, n.size);
    if (hit === q.length && score > bestScore){ best = o.name; bestScore = score; }
  }
  return best;
}

/* ---------------- laying changes over the program ---------------- */
/** `edits` is the saved list of batches: [{ ops:[...] }]. Swaps and stack are not here (see the header).
    A change remembers the phase it was made in and only applies there. */
export function applyEdits(days, edits, phaseNo){
  const ops = (edits || []).flatMap(e => e.ops || [])
    .filter(o => ['sets', 'reps', 'rest', 'add', 'remove'].includes(o.type) && (o.phase == null || o.phase === phaseNo));
  if (!ops.length) return days;
  return days.map(d => {
    const mine = ops.filter(o => o.day === d.key);
    if (!mine.length) return d;
    let supersets = d.supersets.map(ss => ({ ...ss, exercises: ss.exercises.map(ex => ({ ...ex })) }));
    for (const o of mine){
      if (o.type === 'add'){
        supersets.push({ label: `SS${supersets.length + 1} — Added`, rationale: 'Added by you.',
          exercises: [{ name: o.exercise, sets: String(o.sets), reps: o.reps, rest: o.rest, tag: 'Isolation', added: true }] });
        continue;
      }
      supersets.forEach(ss => ss.exercises.forEach((ex, i) => {
        if (ex.name !== o.orig) return;
        if (o.type === 'sets') ss.exercises[i] = { ...ex, sets: String(o.sets) };
        if (o.type === 'reps') ss.exercises[i] = { ...ex, reps: o.reps };
        if (o.type === 'rest') ss.exercises[i] = { ...ex, rest: o.rest };
        if (o.type === 'remove') ss.exercises[i] = null;
      }));
      supersets = supersets.map(ss => ({ ...ss, exercises: ss.exercises.filter(Boolean) })).filter(ss => ss.exercises.length);
    }
    return { ...d, supersets };
  });
}

/** Does this change move exercises around inside a day? Those must wait until no session is open. */
export const isStructural = o => o.type === 'add' || o.type === 'remove';

/* ---------------- what it does to the week ---------------- */
/** Weekly sets by muscle, and minutes per session, before and after the changes. */
export function impact(days, ops){
  const after = applyEdits(days, [{ ops }]);
  const before = Object.fromEntries(weeklyVolume({ days }));
  const now = Object.fromEntries(weeklyVolume({ days: after }));
  const volume = [...new Set([...Object.keys(before), ...Object.keys(now)])]
    .map(m => ({ muscle: m, before: before[m] || 0, after: now[m] || 0 }))
    .filter(v => v.before !== v.after)
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before));
  const minutes = after.map((d, i) => ({ day: d.key, title: d.title, before: sessionMinutes(days[i]), after: sessionMinutes(d) }))
    .filter(x => x.before !== x.after);
  return { volume, minutes, after };
}

/* ---------------- checking a change against the person ---------------- */
/** ctx: { days, phase:{phase,name}, ramp:{active}, body:{ kg, perWeek, kcalAvg, kcalTarget } } */
export function benchmark(op, ctx){
  const reasons = [], good = [];
  let level = 'good';
  const bump = l => { if (l === 'no' || (l === 'check' && level === 'good')) level = l; };
  const name = op.type === 'swap' ? op.to : op.exercise;

  // what the exercise itself asks of the body (for a sets change, only when it asks for more)
  const was = parseInt(findSets(ctx.days, op), 10) || 0;
  if (op.type === 'swap' || op.type === 'add' || (op.type === 'sets' && op.sets > was)){
    const seen = new Set();
    for (const lim of LIMITS) if (lim.re.test(name) && !seen.has(lim.id + lim.level)){
      seen.add(lim.id + lim.level);
      reasons.push(lim.why); bump(lim.level);
    }
  }

  // swap: does it still do the same job?
  if (op.type === 'swap'){
    const a = muscleOf(op.exercise), b = muscleOf(op.to);
    const pa = patternOf(op.exercise), pb = patternOf(op.to);
    if (b !== 'Other' && a !== b){ reasons.push(`This trains ${b.toLowerCase()}, not ${a.toLowerCase()}, so that muscle loses its work.`); bump('check'); }
    else if (pa && pb && pa !== pb){ reasons.push('A different movement pattern, so the stimulus is not the same.'); bump('check'); }
    else if (!reasons.length) good.push(`Same job (${a.toLowerCase()}), different kit. Weights are converted as an estimate.`);
  }

  // sets and reps in a body with joints that need protecting
  if (op.type === 'sets' && op.sets > PROFILE.maxSets){ reasons.push(`${op.sets} sets of one exercise is past the point of useful work and adds time and joint load.`); bump('check'); }
  if ((op.type === 'reps' || op.type === 'add') && parseInt(op.reps, 10) < PROFILE.minReps){
    reasons.push(`Under ${PROFILE.minReps} reps means heavy loads. With hypermobile joints, 8 and up keeps the load kinder.`); bump('check');
  }
  if (op.type === 'rest' && parseInt(op.rest, 10) < 45 && /press|row|pulldown|squat|deadlift|dip/i.test(op.exercise)){
    reasons.push('Very short rests on a heavy compound lift cost you reps and form.'); bump('check');
  }

  // the physique: what the volume does to the muscles that make the V-taper
  if (['sets', 'add', 'remove', 'swap'].includes(op.type)){
    const one = impact(ctx.days, [op]);
    for (const v of one.volume){
      if (!PROFILE.priority.includes(v.muscle)) continue;
      if (v.after < v.before){
        reasons.push(`${v.muscle} would drop from ${v.before} to ${v.after} sets a week. That is one of the muscles that builds the width you are after.`); bump('check');
      } else good.push(`More ${v.muscle.toLowerCase()} (${v.before} to ${v.after} sets a week): that is the width you are building.`);
    }
    const arms = one.after.flatMap(d => d.supersets.flatMap(s => s.exercises)).filter(e => /^(Biceps|Triceps)$/.test(muscleOf(e.name))).reduce((n, e) => n + (parseInt(e.sets, 10) || 1), 0);
    const armsBefore = ctx.days.flatMap(d => d.supersets.flatMap(s => s.exercises)).filter(e => /^(Biceps|Triceps)$/.test(muscleOf(e.name))).reduce((n, e) => n + (parseInt(e.sets, 10) || 1), 0);
    if (arms > PROFILE.armCap && arms > armsBefore){ reasons.push(`Arms would reach ${arms} sets a week. Past about ${PROFILE.armCap} it is mostly fatigue, and the triceps tendon pays for it.`); bump('check'); }
    for (const m of one.minutes){
      if (m.after > PROFILE.minutesMax && m.after > m.before){ reasons.push(`${m.title} would run about ${m.after} minutes. You plan on about ${PROFILE.minutes}, and long sessions get skipped.`); bump('check'); }
    }
  }

  // the phase and where you are right now
  if (ctx.ramp?.active && (op.type === 'add' || (op.type === 'sets' && op.sets > was))){
    reasons.push('You are in the comeback ramp. Adding volume now is how a break turns into a setback; hold it until the ramp ends.'); bump('check');
  }
  if (ctx.phase?.phase === 3 && (op.type === 'add' || (op.type === 'sets' && op.sets > was)) && muscleOf(name) === 'Chest'){
    reasons.push('Phase 3 deliberately drops chest to maintenance to free up recovery for width.'); bump('check');
  }
  if ((op.type === 'add' || (op.type === 'sets' && op.sets > was)) && ctx.body?.kcalTarget && ctx.body.kcalAvg && ctx.body.kcalAvg < ctx.body.kcalTarget * 0.85){
    reasons.push(`You have been eating about ${Math.round(ctx.body.kcalAvg)} of ${Math.round(ctx.body.kcalTarget)} kcal. More volume on a short fuel supply costs recovery you do not have.`); bump('check');
  }
  if (op.type === 'remove'){
    const m = muscleOf(op.exercise);
    if (PROFILE.priority.includes(m) && !reasons.length) { reasons.push(`This is one of your ${m.toLowerCase()} exercises. Check the weekly total below before you drop it.`); bump('check'); }
  }
  return { level, reasons: reasons.length ? reasons : good.slice(0, 2), good };
}

const findSets = (days, op) => days.find(d => d.key === op.day)?.supersets.flatMap(s => s.exercises).find(e => e.name === op.orig)?.sets;

/* ---------------- words for the screen ---------------- */
export function describe(op, days = []){
  const day = days.find(d => d.key === op.day)?.title;
  const where = day ? `${day} · ` : '';
  switch (op.type){
    case 'swap':   return `${where}${op.exercise} → ${op.to}`;
    case 'sets':   return `${where}${op.exercise}: ${op.sets} sets`;
    case 'reps':   return `${where}${op.exercise}: ${op.reps} reps`;
    case 'rest':   return `${where}${op.exercise}: rest ${op.rest}`;
    case 'add':    return `${where}Add ${op.exercise}, ${op.sets} × ${op.reps}`;
    case 'remove': return `${where}Remove ${op.exercise}`;
    case 'stack':  return `${op.gear === 'cable' ? 'Cable' : 'Machine'} stack${op.unit ? ' reads in ' + op.unit : ''}${op.ratio ? ` at ${op.ratio}:1` : ''}`;
    default:       return op.type;
  }
}

export const LEVEL_TEXT = { good: 'Good fit', check: 'Worth a look', no: 'Not advised for you' };

/** The gear for a swap target: what was said, else the known option, else a guess from the name. */
export const gearFor = op => op.gear || gearOf(op.to) || 'machine';

/* ---------------- the AI path ---------------- */
/** The prompt that turns a request into changes. The model only translates; benchmark() judges. */
export function editPrompt({ text, days, swaps = {}, body = {}, phase = {}, ramp = {} }){
  const program = days.map(d => `${d.key} ${d.title}:\n` + d.supersets.flatMap(ss => ss.exercises).map(ex => {
    const shown = swaps[`${d.key}|${ex.name}`];
    return `  - ${ex.name}${shown ? ` (currently swapped to ${shown})` : ''} | ${ex.sets} sets x ${ex.reps} | rest ${ex.rest}`;
  }).join('\n')).join('\n');
  const eating = body.kcalAvg && body.kcalTarget ? ` Eating about ${Math.round(body.kcalAvg)} of ${Math.round(body.kcalTarget)} kcal a day lately.` : '';
  return `You turn a lifter's plain-English request into precise changes to his training program. You only translate and explain. You never refuse; a separate check judges each change.

THE PERSON: ${PROFILE.heightCm}cm, ${body.kg ? '~' + body.kg + 'kg' : '~' + PROFILE.startKg + 'kg'}, lean bulking towards ${PROFILE.goalKg}kg. Wants a swimmer physique: wide delts, wide lats, high upper chest. 4 days a week, supersets, about ${PROFILE.minutes} minutes, a commercial gym with cable stacks and machines (they may read in lb or at 2:1).
HIS BODY: unstable, hypermobile shoulder; distal triceps tendon pain when pressing; knees cave inward under load; tight glutes pull on the lower back.${eating} Phase ${phase.phase || '?'} (${phase.name || ''}).${ramp.active ? ' He is in a comeback ramp after time off.' : ''}

THE PROGRAM RIGHT NOW (use these exact exercise names):
${program}

HIS REQUEST: "${String(text).replace(/"/g, "'")}"

Reply with ONLY this JSON: {"ops":[...],"say":"one short sentence"}
Each op is one of:
{"type":"swap","day":"d2","from":"exact name","to":"replacement","gear":"dumbbell|barbell|cable|machine|bodyweight","why":"one line"}
{"type":"sets","day":"d2","exercise":"exact name","sets":4,"why":"one line"}
{"type":"reps","day":"d2","exercise":"exact name","reps":"8–10","why":"one line"}
{"type":"rest","day":"d2","exercise":"exact name","rest":"60s","why":"one line"}
{"type":"add","day":"d4","exercise":"name","sets":3,"reps":"12–15","rest":"60s","why":"one line"}
{"type":"remove","day":"d4","exercise":"exact name","why":"one line"}
{"type":"stack","gear":"cable|machine","unit":"kg|lb","ratio":2}
Rules: use the exact exercise names above. Leave out "day" only when the request is for every day that has that exercise; "add" always needs a day. Keep "why" to one plain sentence about THIS person. Only include changes the request asked for. If the request is unclear, return {"ops":[],"say":"what you need to know"}.`;
}
