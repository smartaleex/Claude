/* Every session is three supersets: the first for 4 sets, the second and third for 3.
   Pins it for every phase, the back-friendly leg day, and changes made in plain words. */
import { ok, done } from '../lib.mjs';
import { PHASES, kindLegs, FORMAT, fitFormat } from '../../assets/js/data/workouts.js';
import { applyEdits } from '../../assets/js/core/training-edit.js';

const shape = d => d.supersets.map(ss => [...new Set(ss.exercises.map(e => e.sets))].join('/')).join(' | ');
ok(FORMAT.join() === '4,3,3', 'the format is 4 / 3 / 3');

for (const p of PHASES){
  for (const d of p.days.concat(p.days.map(kindLegs))){
    ok(d.supersets.length === 3, `phase ${p.phase} ${d.key}: 3 supersets (${d.supersets.length})`);
    ok(shape(d) === '4 | 3 | 3', `phase ${p.phase} ${d.key}: sets are 4 | 3 | 3 (${shape(d)})`);
    ok(d.supersets.every((ss, i) => ss.label.startsWith(`SS${i + 1}`)), `phase ${p.phase} ${d.key}: labels run SS1 to SS3`);
  }
  const d4 = p.days.find(d => d.key === 'd4');
  ok(d4.extra.exercises.some(e => /front raise/i.test(e.name)), `phase ${p.phase}: the front raise is in the shoulder day's extra time`);
}

// a fourth superset spills into extra time, and stray set counts are corrected
const day = { key: 'd1', supersets: [
  { label: 'SS1 — A', exercises: [{ name: 'A', sets: '2' }] },
  { label: 'SS2 — B', exercises: [{ name: 'B', sets: '5' }] },
  { label: 'SS3 — C', exercises: [{ name: 'C', sets: '3' }] },
  { label: 'SS4 — D', exercises: [{ name: 'D', sets: '3', reps: '12', added: true }] },
], extra: { label: 'Extra', exercises: [{ name: 'E' }] } };
const f = fitFormat(day);
ok(f.supersets.length === 3 && shape(f) === '4 | 3 | 3', 'fitFormat trims to 3 supersets at 4 / 3 / 3');
ok(f.extra.exercises[0].name === 'D' && f.extra.exercises[1].name === 'E', 'the fourth superset moves to extra time, ahead of what was there');

// plain-English changes cannot break it
const days = PHASES[1].days;
const edited = applyEdits(days, [{ ops: [
  { type: 'sets', day: 'd1', orig: days[0].supersets[0].exercises[0].name, sets: 6 },
  { type: 'add', day: 'd1', exercise: 'Cable curl', sets: 3, reps: '12', rest: '60s' },
] }], 2);
ok(shape(edited[0]) === '4 | 3 | 3' && edited[0].supersets.length === 3, 'a sets change or an added exercise keeps day 1 at 4 / 3 / 3');
ok(edited[0].extra.exercises.some(e => e.name === 'Cable curl'), 'the added exercise sits in extra time');

done('session format');
