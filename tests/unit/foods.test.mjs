import { ok, done } from '../lib.mjs';
import { FOOD_DB, offlineMatch, offlineSuggest, looksBranded } from '../../assets/js/data/foods.js';

ok(FOOD_DB.length > 40, 'food bank has ' + FOOD_DB.length + ' entries');
ok(FOOD_DB.every(f => f.n && Array.isArray(f.a) && f.a.length && f.kcal > 0 && f.p >= 0 && f.c >= 0 && f.f >= 0), 'every food has a name, aliases and macros');
// calories should roughly agree with the macros (4/4/9), otherwise someone typed a number wrong
const DRINK = /beer|wine|spirit|martini|spritz|cider/i;            // alcohol has 7 kcal/g that the macros do not show
const off = FOOD_DB.filter(f => !DRINK.test(f.n) && Math.abs(f.p * 4 + f.c * 4 + f.f * 9 - f.kcal) > Math.max(60, f.kcal * .25));
ok(off.length === 0, 'macros agree with calories within 25%' + off.map(f => ` [${f.n}: ${f.kcal} vs ${f.p * 4 + f.c * 4 + f.f * 9}]`).join(''));
const m = offlineMatch('2 eggs and toast');
ok(Array.isArray(m) && m.length === 2 && m[0].name === 'Egg ×2' && m[0].kcal === 148 && /Bread/.test(m[1].name), 'matches "2 eggs and toast" as two foods, with the number of eggs applied');
ok(offlineMatch('') === null && offlineMatch(null) === null, 'empty description -> null');
ok(offlineMatch('zzzxqv unmatched gibberish') === null, 'gibberish matches nothing');
ok(looksBranded('big mac from maccas') && looksBranded('Nandos chicken') && !looksBranded('chicken and rice'), 'branded food detection');
const sug = offlineSuggest({ kcal: 600, p: 40, c: 60, f: 20 });
ok(sug.length === 3 && sug.every(s => s.name && s.kcal > 0), 'three suggestions with macros');
ok(offlineSuggest({ kcal: 0, p: 0, c: 0, f: 0 }).length === 3, 'a full day still returns suggestions');
done('foods');
