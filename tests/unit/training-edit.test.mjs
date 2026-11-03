/* Changing the program in plain words: reading it, checking it against the person, applying it. */
import { ok, done } from '../lib.mjs';
import { PHASES } from '../../assets/js/data/workouts.js';
import { parseEdits, resolveOps, applyEdits, impact, benchmark, findExercise, dayFromText, describe, isStructural } from '../../assets/js/core/training-edit.js';

const days = PHASES[1].days;                       // Phase 2, the one being run
const read = text => { const r = parseEdits(text, days); const x = resolveOps(r.ops, days); return { ops: x.ops, notes: [...r.notes, ...x.notes] }; };
const one = text => read(text).ops[0];

// ---- finding the exercise you mean
let f = findExercise('incline press', days);
ok(f.hits.length === 1 && f.hits[0].orig === 'Incline machine chest press', 'two words find the exercise: ' + f.hits[0]?.orig);
f = findExercise('db lateral raise', days);
ok(f.hits[0]?.orig === 'DB lateral raise + partials', '"db" and "dumbbell" read the same');
f = findExercise('dumbbell lateral raise', days);
ok(f.hits[0]?.orig === 'DB lateral raise + partials', '"dumbbell" finds DB');
f = findExercise('pushdown', days);
ok(f.ambiguous.length === 3, 'three pushdowns: it asks which one (' + f.ambiguous.length + ')');
f = findExercise('side delts', days);
ok(f.hits[0]?.orig === 'DB lateral raise + partials', 'a muscle name finds its exercise: ' + f.hits[0]?.orig);
f = findExercise('lats', days);
ok(f.ambiguous.length > 1 || f.hits.length > 0, 'a muscle with several exercises asks or finds');
f = findExercise('zottman curl', days);
ok(f.hits.length === 0 && f.ambiguous.length === 0, 'an exercise that is not there finds nothing');
ok(dayFromText('on shoulders day', days) === 'd4' && dayFromText('legs day', days) === 'd3' && dayFromText('day 2', days) === 'd2', 'days are found when said like a day');
ok(dayFromText('my shoulder clicks on incline press', days) === null, 'a sore joint is not a day');

// ---- reading what was typed
let r = read('swap incline machine chest press for incline db press, my shoulder clicks');
ok(r.ops.length === 1 && r.ops[0].type === 'swap' && r.ops[0].orig === 'Incline machine chest press' && /Incline DB press/.test(r.ops[0].to), 'swap: ' + describe(r.ops[0], days));
ok(!/shoulder clicks/.test(r.ops[0].to), 'the reason is not part of the exercise name');
r = read('swap incline press for the DB one, my shoulder clicks');
ok(r.ops[0]?.to === 'Incline DB press (30–45°)', '"the DB one" finds the real dumbbell option: ' + r.ops[0]?.to);
r = read('swap incline press for the DB one, my shoulder clicks and side delts to 5 sets and drop the face pulls');
ok(r.ops.length === 3 && r.ops.map(o => o.type).join() === 'swap,sets,remove', 'a long sentence splits into its three instructions: ' + r.ops.map(o => o.type));
r = read('swap lying leg curl for seated db thing');
ok(r.ops[0]?.to === 'Seated DB thing', 'a free-text exercise is written the way the program writes names: ' + r.ops[0]?.to);
r = read('use pec deck instead of chest dips');
ok(r.ops[0]?.type === 'swap' && r.ops[0].orig.startsWith('Chest dips') && r.ops[0].to === 'Pec deck', '"use X instead of Y": ' + (r.ops[0] && describe(r.ops[0], days)));
r = read('the pec deck is busy, use cable crossover');
ok(r.ops[0]?.type === 'swap' && r.ops[0].orig === 'Pec deck fly' && /crossover/i.test(r.ops[0].to), '"X is busy, use Y": ' + (r.ops[0] && describe(r.ops[0], days)));
r = read('make side delts 4 sets on shoulders day');
ok(r.ops.length === 1 && r.ops[0].type === 'sets' && r.ops[0].sets === 4 && r.ops[0].day === 'd4', 'sets by muscle on a named day');
r = read('3x10 on lying leg curl');
ok(r.ops.some(o => o.type === 'sets' && o.sets === 3) && r.ops.some(o => o.type === 'reps' && o.reps === '10'), '"3x10": sets and reps');
r = read('bulgarian split squat 3 sets of 8-10');
ok(r.ops.some(o => o.type === 'reps' && o.reps === '8–10'), 'a hyphen becomes the en dash the program uses');
r = read('change the rest on straight bar pushdown to 60s');
ok(r.ops.length === 1 && r.ops[0].type === 'rest' && r.ops[0].rest === '60s', 'rest is not mistaken for a swap');
r = read('set pec deck rest to 2 minutes');
ok(r.ops[0]?.rest === '120s', 'minutes become seconds');
r = read('drop the face pulls');
ok(r.ops[0]?.type === 'remove' && /Face pull/.test(r.ops[0].orig), 'remove');
r = read('add cable lateral raise 3x15 to shoulders day');
ok(r.ops[0]?.type === 'add' && r.ops[0].day === 'd4' && r.ops[0].sets === 3 && r.ops[0].reps === '15' && /lateral raise/i.test(r.ops[0].exercise), 'add with sets and reps to a named day');
r = read('add cable lateral raise');
ok(r.ops.length === 0 && r.notes.some(n => /which day/i.test(n)), 'an add with no day asks which day');
r = read('cable stack reads in lb and is 2:1');
ok(r.ops[0]?.type === 'stack' && r.ops[0].gear === 'cable' && r.ops[0].unit === 'lb' && r.ops[0].ratio === 2, 'the cable stack in lb at 2:1');
r = read('machines are in lb');
ok(r.ops[0]?.gear === 'machine' && r.ops[0].unit === 'lb' && !r.ops[0].ratio, 'the machines in lb, ratio untouched');
r = read('pushdown to 4 sets');
ok(r.ops.length === 0 && r.notes.some(n => /could be/.test(n)), 'an ambiguous name is asked about, not guessed');
r = read('zottman curl to 4 sets');
ok(r.ops.length === 0 && r.notes.some(n => /Could not find/.test(n)), 'a missing exercise is said out loud');
r = read('make it nicer');
ok(r.ops.length === 0 && r.notes.length === 1, 'nonsense becomes a note, not a change');
r = read('swap incline press for db press and drop the shrugs and set pec deck rest to 90s');
ok(r.ops.filter(o => o.type === 'swap').length === 1 && r.ops.some(o => o.type === 'rest' && o.rest === '90s'), 'several changes in one sentence');
ok(resolveOps([{ type: 'sets', exercise: 'incline press', sets: 40 }], days).ops.length === 0, 'absurd values are refused (40 sets)');
ok(resolveOps([{ type: 'reps', exercise: 'incline press', reps: 'lots' }], days).ops.length === 0, 'junk reps are refused');
ok(resolveOps([{ type: 'explode', exercise: 'x' }], days).notes.length === 1, 'unknown change types are refused');

// ---- laying changes over the program
const edit = ops => [{ ops }];
let after = applyEdits(days, edit(read('3 sets of 10 on pec deck').ops));
const pd = after.find(d => d.key === 'd2').supersets[0].exercises[1];
ok(pd.sets === '3' && pd.reps === '10', 'sets and reps change on the right exercise');
ok(days.find(d => d.key === 'd2').supersets[0].exercises[1].sets === '4', 'the original program is not touched');
after = applyEdits(days, edit(read('drop the face pulls').ops));
ok(!after.find(d => d.key === 'd4').supersets.flatMap(s => s.exercises).some(e => /Face pull/.test(e.name)), 'remove takes the exercise out');
after = applyEdits(days, edit(read('add cable lateral raise 3x15 to shoulders day').ops));
const d4 = after.find(d => d.key === 'd4');
ok(d4.supersets.length === days.find(d => d.key === 'd4').supersets.length + 1 && d4.supersets.at(-1).exercises[0].added, 'add goes in as a new last superset, so nothing before it moves');
ok(isStructural({ type: 'add' }) && isStructural({ type: 'remove' }) && !isStructural({ type: 'sets' }), 'add and remove are the ones that shift positions');
ok(applyEdits(days, []) === days, 'no edits returns the same program');

// ---- what it does to the week
let im = impact(days, read('make side delts 4 sets on shoulders day').ops.map(o => ({ ...o, sets: 6 })));
const sd = im.volume.find(v => v.muscle === 'Side delts');
ok(sd && sd.before === 4 && sd.after === 6, 'side delts 4 to 6 sets a week');
ok(im.minutes.length === 1 && im.minutes[0].after > im.minutes[0].before, 'and that day runs a little longer');

// ---- checking against the person
const ctx = { days, phase: { phase: 2 }, ramp: { active: false }, body: { kcalAvg: 2800, kcalTarget: 2800 } };
const bm = text => benchmark(one(text), ctx);
let b = bm('swap incline machine chest press for barbell bench press');
ok(b.level === 'no' && /shoulder/i.test(b.reasons.join(' ')), 'barbell bench is not advised for an unstable shoulder: ' + b.level);
b = bm('swap incline machine chest press for incline db press');
ok(b.level === 'check', 'a dumbbell incline press is worth a look (deep stretch): ' + b.level);
b = bm('swap lying leg curl for seated leg curl');
ok(b.level === 'good' && b.reasons.length > 0, 'a like-for-like machine swap is a good fit, with a reason: ' + b.level);
b = bm('swap standing calf raise for dead bug');
ok(b.level === 'check' && /trains/i.test(b.reasons.join(' ')), 'swapping to a different muscle is called out');
b = bm('swap lying leg curl for romanian deadlift');
ok(b.level === 'check' && /back/i.test(b.reasons.join(' ')), 'a deadlift is flagged for the back');
b = bm('swap straight bar pushdown for skull crushers');
ok(b.level === 'check' && /triceps|elbow|lockout/i.test(b.reasons.join(' ')), 'skull crushers are flagged for the triceps tendon');
b = bm('swap bulgarian split squat for walking lunges');
ok(b.level === 'check' && /knee/i.test(b.reasons.join(' ')), 'lunges are flagged for knees that cave');
b = benchmark({ type: 'sets', day: 'd4', orig: 'DB lateral raise + partials', exercise: 'DB lateral raise + partials', sets: 5 }, ctx);
ok(b.level === 'good' && /side delts/i.test(b.reasons.join(' ')), 'more side delts is praised as the goal: ' + b.reasons[0]);
b = benchmark({ type: 'sets', day: 'd4', orig: 'DB lateral raise + partials', exercise: 'DB lateral raise + partials', sets: 6 }, ctx);
ok(b.level === 'check' && /past the point/i.test(b.reasons.join(' ')), 'six sets of one exercise is past the cap');
b = benchmark({ type: 'sets', day: 'd4', orig: 'DB lateral raise + partials', exercise: 'DB lateral raise + partials', sets: 2 }, ctx);
ok(b.level === 'check' && /width/i.test(b.reasons.join(' ')), 'cutting a width muscle is flagged');
b = bm('drop the face pulls');
ok(b.level === 'check', 'dropping a posture and rear-delt exercise is worth a look');
b = bm('drop the reverse ez-bar curl');
ok(b.level === 'good' || b.level === 'check', 'dropping an arm exercise gets an answer: ' + b.level);
b = benchmark({ type: 'sets', day: 'd4', orig: 'DB lateral raise + partials', exercise: 'DB lateral raise + partials', sets: 5 }, { ...ctx, ramp: { active: true } });
ok(b.reasons.some(x => /comeback/i.test(x)), 'adding sets during the comeback ramp is flagged');
b = benchmark({ type: 'sets', day: 'd4', orig: 'DB lateral raise + partials', exercise: 'DB lateral raise + partials', sets: 5 }, { ...ctx, body: { kcalAvg: 1900, kcalTarget: 2800 } });
ok(b.reasons.some(x => /eating/i.test(x)), 'adding volume while under-eating is flagged: ' + b.reasons.join(' | '));
b = benchmark({ type: 'reps', day: 'd2', orig: 'Incline machine chest press', exercise: 'Incline machine chest press', reps: '3–5' }, ctx);
ok(b.level === 'check' && /heavy/i.test(b.reasons.join(' ')), 'very low reps are flagged for hypermobile joints');
b = benchmark({ type: 'sets', day: 'd2', orig: 'Incline machine chest press', exercise: 'Incline machine chest press', sets: 9 }, ctx);
ok(b.level === 'check', 'nine sets of one exercise is flagged');
b = benchmark({ type: 'add', day: 'd2', exercise: 'Cable chest press', orig: 'Cable chest press', sets: 3, reps: '10–12', rest: '60s' }, { ...ctx, phase: { phase: 3 } });
ok(b.reasons.some(x => /Phase 3/.test(x)), 'adding chest in Phase 3 is flagged');
ok(['good', 'check', 'no'].includes(benchmark({ type: 'stack', gear: 'cable', unit: 'lb' }, ctx).level), 'a stack setting is benchmarked without error');

done('training edits in plain words');
