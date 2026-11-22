import { ok, done } from '../lib.mjs';
import * as C from '../../assets/js/core/coach.js';
import { PHASES, muscleOf } from '../../assets/js/data/workouts.js';

// canonical muscle names, forgiving of how a model words them
const cm = C.canonMuscle;
ok(cm('side delts') === 'Side delts' && cm('Lateral deltoids') === 'Side delts' && cm('medial delt') === 'Side delts', 'side delts: three spellings');
ok(cm('rear delts') === 'Rear delts & traps' && cm('Lats') === 'Lats' && cm('latissimus dorsi') === 'Lats', 'rear delts and lats');
ok(cm('pecs') === 'Chest' && cm('upper chest') === 'Chest', 'chest');
ok(cm('front delts') === 'Front delts' && cm('traps') === 'Traps', 'front delts and traps are recognised so the cap can refuse them');
ok(cm('') === null && cm(null) === null && cm('elbows') === null && cm(42) === null, 'junk -> null');

// the safety clamp
let r = C.clampAdjustments([{ muscle:'Side delts', extraSets:2, why:'width' }, { muscle:'Lats', extraSets:3 }]);
ok(r.accepted.length === 2 && r.total === 5 && r.refused.length === 0, 'ordinary suggestions pass untouched');
r = C.clampAdjustments([{ muscle:'Front delts', extraSets:2 }]);
ok(r.accepted.length === 0 && r.refused[0].muscle === 'Front delts', 'front delts refused (shoulder)');
r = C.clampAdjustments([{ muscle:'Traps', extraSets:1 }]);
ok(r.accepted.length === 0 && /taper/.test(r.refused[0].reason), 'traps refused with the real reason');
r = C.clampAdjustments([{ muscle:'Triceps', extraSets:3 }]);
ok(r.accepted[0].extraSets === 1 && r.refused[0].partial, 'triceps capped at 1 (elbow tendon)');
r = C.clampAdjustments([{ muscle:'Lats', extraSets:9 }]);
ok(r.accepted[0].extraSets === 3, 'default cap of 3 per muscle');
r = C.clampAdjustments([{ muscle:'Lats', extraSets:3 }, { muscle:'Chest', extraSets:3 }, { muscle:'Biceps', extraSets:3 }]);
ok(r.total === C.MAX_TOTAL && r.accepted.at(-1).extraSets === 0 + (C.MAX_TOTAL - 6) || r.total <= C.MAX_TOTAL, 'weekly total never exceeds ' + C.MAX_TOTAL + ' (got ' + r.total + ')');
r = C.clampAdjustments([{ muscle:'Lats', extraSets:2 }, { muscle:'lats', extraSets:2 }]);
ok(r.accepted.length === 1, 'the same muscle twice is counted once');
r = C.clampAdjustments([null, {}, { muscle:'Lats' }, { muscle:'Lats', extraSets:'x' }, { muscle:'Lats', extraSets:0 }, { muscle:'Lats', extraSets:-2 }, 'junk', 7]);
ok(r.accepted.length === 0 && r.total === 0, 'garbage entries are dropped without throwing');
ok(C.clampAdjustments(undefined).accepted.length === 0 && C.clampAdjustments('x').accepted.length === 0, 'non-arrays tolerated');

// tolerant parsing of model output
let b = C.sanitiseBenchmark({ summary:'S', areas:[{ muscle:'side delts', gap:'large', note:'n' }, { muscle:'?', gap:'x', note:'n' }, { muscle:'Lats', note:'' }], adjustments:[{ muscle:'Side delts', extraSets:2 }] });
ok(b.usable && b.areas.length === 1 && b.areas[0].muscle === 'Side delts' && b.areas[0].gap === 'large', 'benchmark keeps the usable area, drops the rest');
ok(b.adjustments.length === 1 && b.total === 2, 'benchmark adjustments are clamped');
ok(!C.sanitiseBenchmark(null).usable && !C.sanitiseBenchmark('x').usable && !C.sanitiseBenchmark({}).usable, 'empty / garbage benchmark is unusable, not a crash');
let p = C.sanitiseProgress({ headline:'H', changes:[{ area:'Chest', direction:'UP', note:'n' }, { note:'' }, { direction:'sideways', note:'m' }], next:['a', '', 'b', 'c'] });
ok(p.usable && p.changes.length === 2 && p.changes[0].direction === 'up' && p.changes[1].direction === 'unclear', 'progress: directions normalised');
ok(p.next.length === 2, 'progress: at most two next steps');
ok(!C.sanitiseProgress({}).usable && !C.sanitiseProgress([]).usable, 'empty progress unusable');

// weights near a date
const w = { '2026-10-01':72, '2026-10-10':73 };
ok(C.weightNear(w, '2026-10-09').kg === 73 && C.weightNear(w, '2026-10-03').kg === 72, 'weightNear picks the closest weigh-in');
ok(C.weightNear(w, '2026-12-01') === null && C.weightNear({}, '2026-10-01') === null && C.weightNear(null, '2026-10-01') === null, 'weightNear: nothing close enough -> null');

// focus boosts land on real exercises, round-robin, never piling on
const ph = PHASES[1];
const map = C.bonusMap(ph, { 'Side delts':2, Lats:3 });
const total = Object.values(map).reduce((a, b) => a + b, 0);
ok(total === 5, 'bonus sets all placed (' + total + ')');
ok(Object.values(map).every(n => n <= C.MAX_PER_EXERCISE), 'never more than ' + C.MAX_PER_EXERCISE + ' on one exercise');
ok(Object.keys(map).every(k => ['Side delts', 'Lats'].includes(muscleOf(k.split('|')[1]))), 'bonus only lands on matching muscles');
ok(Object.keys(C.bonusMap(ph, {})).length === 0 && Object.keys(C.bonusMap(null, { Lats:1 })).length === 0, 'no focus, no phase: no bonus');
const at = C.appliedTotals(ph, { 'Side delts':2 });
ok(at['Side delts'] === 2, 'appliedTotals reports what actually fits');
ok(C.bonusFor(map, 'd4', 'nothing') === 0, 'bonusFor defaults to 0');
done('coach');
