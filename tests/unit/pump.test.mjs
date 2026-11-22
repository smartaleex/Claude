/* Post-workout photos: which session a photo followed, what it pumped, and how
   the comparison and the AI are told. Also the muscle map's anatomy. */
import { ok, done } from '../lib.mjs';
import { pumpedAreas, sessionRows, sessionBefore, afterTag, tagLabel, promptNote, compareNote, PUMP_RULE } from '../../assets/js/core/pump.js';
import { bodySVG } from '../../assets/js/core/musclemap.js';
import { FRONT, BACK } from '../../assets/js/core/anatomy.js';
import { PHASES } from '../../assets/js/data/workouts.js';

// ---- areas a session pumps
const chestDay = [{ n: 'Incline DB press (30–45°)', sets: 4 }, { n: 'Pec deck fly', sets: 4 }, { n: 'Cable lateral raise', sets: 3 }, { n: 'Cable lateral raise', sets: 3 }, { n: 'Cable curl', sets: 2 }];
const a = pumpedAreas(chestDay);
ok(a[0] === 'Chest' && a.includes('Shoulders'), 'chest day pumps chest, then shoulders: ' + a);
ok(!a.includes('Arms'), 'two sets of curls do not count as an arm pump');
ok(pumpedAreas([]).length === 0, 'nothing logged, nothing pumped');
for (const ph of PHASES) for (const d of ph.days){
  const rows = d.supersets.flatMap(ss => ss.exercises.map(ex => ({ n: ex.name, sets: parseInt(ex.sets, 10) })));
  ok(pumpedAreas(rows).length >= 1, `Phase ${ph.phase} ${d.title} pumps something (${pumpedAreas(rows)})`);
}

// ---- done sets beat planned ones; planned is the fallback
const sess = { ex: [{ n: 'Pec deck fly', p: 4, d: 0 }, { n: 'Cable curl', p: 3, d: 3 }] };
ok(sessionRows(sess)[1].sets === 3 && sessionRows(sess)[0].sets === 0, 'logged sets are used when any were logged');
ok(sessionRows({ ex: [{ n: 'Pec deck fly', p: 4, d: 0 }] })[0].sets === 4, 'otherwise the planned sets');
ok(sessionRows({}, chestDay) === chestDay, 'a quick-completed session falls back to the plan');

// ---- the session a photo followed
const H = 3600e3, now = Date.UTC(2026, 10, 20, 8);
const S = [
  { id: 'a', day: 'd1', done: true, startedAt: now - 5 * H, endedAt: now - 4 * H },
  { id: 'b', day: 'd2', done: true, startedAt: now - 1.5 * H, endedAt: now - 40 * 60e3 },
];
let hit = sessionBefore(S, now);
ok(hit?.session.id === 'b' && hit.mins === 40, 'a photo 40 minutes after finishing is tagged with that session');
ok(sessionBefore([S[0]], now) === null, 'four hours later the pump is gone: no tag');
ok(sessionBefore(S, now - 3 * H)?.session.id === 'a', 'an earlier photo picks the session before it');
ok(sessionBefore([{ id: 'c', day: 'd1', done: false, startedAt: now - 30 * 60e3 }], now)?.session.id === 'c', 'a photo mid-session counts');
ok(sessionBefore([{ id: 'c', day: 'd1', done: false, startedAt: now - 5 * 60e3 }], now) === null, 'five minutes into a session there is no pump yet');
ok(sessionBefore([{ id: 'd', day: 'd1', done: true, quick: true }], now) === null, 'a session with no times never tags anything');
ok(sessionBefore([{ id: 'e', day: 'd1', done: true, endedAt: now + H }], now) === null, 'a session finished after the photo does not count');

// ---- wording
const tag = afterTag({ day: 'd2', title: 'Push', areas: ['Chest', 'Shoulders'], mins: 40 });
ok(tagLabel(tag) === 'After chest + shoulders' && tagLabel(null) === 'Rested' && tagLabel(undefined) === '', 'labels: ' + tagLabel(tag));
ok(/^about 40 minutes after a Push session/.test(promptNote(tag)) && /chest and shoulders will look fuller/.test(promptNote(tag)), promptNote(tag));
ok(promptNote(null) === 'rested, no workout beforehand' && promptNote(undefined) === '', 'rested and unknown');
ok(compareNote(undefined, null) === null && compareNote(null, null) === null, 'no note when nothing is pumped');
ok(/after photo was taken after training chest and shoulders/.test(compareNote(null, tag)) && /caution/.test(compareNote(null, tag)), compareNote(null, tag));
ok(/compare fairly/.test(compareNote(tag, { ...tag, mins: 10 })), 'same session both times: fair comparison');
ok(/different sessions/.test(compareNote(tag, afterTag({ title: 'Legs', areas: ['Legs'] }))), 'different sessions: says so');
ok(/do not count that extra fullness as progress/.test(PUMP_RULE) && !/roast|terrible|bad/i.test(PUMP_RULE), 'the AI rule discounts the pump without judging');
const all = [promptNote(tag), compareNote(null, tag), compareNote(tag, tag), PUMP_RULE].join(' ');
ok(!/—/.test(all), 'no em dashes in the wording');

// ---- the anatomy
const regions = new Set([...FRONT, ...BACK].map(r => r[0]));
for (const k of ['chest', 'abs', 'obliques', 'biceps', 'triceps', 'traps', 'delts-front', 'delts-back', 'lats', 'midback', 'quads', 'hamstrings', 'glutes', 'calves'])
  ok(regions.has(k), `the figure has ${k}`);
const svg = bodySVG('front', { 'Side delts': 20 }, 20), back = bodySVG('back', { Lats: 20 }, 20);
ok(/class="mm-4"/.test(svg) && (svg.match(/mm-4/g) || []).length === 2, 'side delts light both shoulders on the front (merged deltoid)');
ok((back.match(/mm-4/g) || []).length === 2, 'lats: one on each side');
ok(!/mm-[1-4]/.test(bodySVG('front', {}, 20)), 'nothing trained, nothing shaded');
ok(/mm-x/.test(svg) && /mm-skin/.test(svg), 'untracked muscles and skin stay neutral');

done('pump: post-workout photos, and the anatomy');
