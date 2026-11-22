import { ok, done } from '../lib.mjs';
import { openingFor } from '../../assets/js/core/sets.js';

const ramp = { active:true, weights:0.85 };
const none = { active:false };

// 1. A new set copies the last logged set of THIS exercise, always.
let r = openingFor({ logged:[{ w:40 }], prev:{ w:60 }, ramp });
ok(r.w === 40 && r.why === 'session', 'comeback week: set 2 copies set 1 (40), not 85% of last time');
r = openingFor({ logged:[{ w:40 }, { w:42.5 }], prev:{ w:60 }, ramp });
ok(r.w === 42.5 && r.why === 'session', 'copies the most recent set (42.5)');
r = openingFor({ logged:[{ w:40 }], prev:{ w:60 }, ramp:none });
ok(r.w === 40, 'normal week: copies set 1 as well');
r = openingFor({ logged:[{ w:40 }, { w:null }], prev:{ w:60 }, ramp });
ok(r.w === 40, 'skips a trailing set with no weight and uses the last one that has one');
r = openingFor({ logged:[{ w:null }, { w:null }], prev:{ w:60 }, ramp:none });
ok(r.w === 60 && r.why === 'last', 'no weight logged yet this session: last session weight');

// 2. Nothing logged yet: last time, eased during a comeback week
r = openingFor({ logged:[], prev:{ w:60 }, ramp });
ok(r.w === 50 && r.why === 'ease', 'first set of a comeback week eases in (60 -> 50, rounded to a plate)');
r = openingFor({ logged:[], prev:{ w:60 }, ramp:none });
ok(r.w === 60 && r.why === 'last', 'first set of a normal week: last weight');
r = openingFor({ logged:[], prev:{ w:30, est:true }, ramp });
ok(r.w === 30 && r.why === 'est', 'an estimate carried from another machine is shown as is, not eased');

// 3. Nothing to go on
for (const [a, label] of [[{}, 'empty input'], [{ logged:[], prev:undefined, ramp }, 'no history'], [{ logged:[{}], prev:{ w:null } }, 'null weights'], [{ prev:{ w:'abc' } }, 'junk weight']]){
  r = openingFor(a); ok(r.w === null && r.why === null, 'nothing known -> null: ' + label);
}
r = openingFor({ logged:[{ w:'42.5' }] }); ok(r.w === 42.5, 'a weight stored as a string still counts');
r = openingFor({ logged:[{ w:0 }], prev:{ w:60 } }); ok(r.w === 0 && r.why === 'session', 'zero is a weight (bodyweight)');
done('set weights');
