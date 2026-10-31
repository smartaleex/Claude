import { ok, done } from '../lib.mjs';

import { PHASES } from '../../assets/js/data/workouts.js';
import * as C from '../../assets/js/core/comeback.js';
let n=0; const bad=m=>ok(false,m);
const seen=new Set();
for (const p of PHASES) for (const d of p.days) for (const ss of d.supersets) for (const ex of ss.exercises){
  for (const mode of ['bottom','mid','full']){
    n++;
    const r=C.reviseReps(ex.reps,mode);
    const m=String(ex.reps).match(/^(\d+)(?:[–-](\d+))?/);
    if (r.changed){
      const v=parseInt(r.text,10), lo=+m[1], hi=m[2]?+m[2]:lo;
      if (!(v>=5 && v<=hi)) bad(`${ex.name}: ${ex.reps} -> ${r.text} (${mode}) out of bounds`);
      if (mode==='full') bad('full must never change');
      if (/each/.test(ex.reps) && !/each/.test(r.text)) bad(`${ex.name}: lost "each"`);
      seen.add(`${ex.reps} -> ${r.text}`);
    } else if (r.text!==String(ex.reps).trim()) bad(`${ex.name}: unchanged flag lies`);
  }
}
console.log('checked',n,'exercise/week combinations;', seen.size,'distinct rewrites');
console.log([...seen].slice(0,12).join(' | '));
ok(n > 200 && seen.size > 20, 'rewrote '+seen.size+' distinct rep ranges across '+n+' combinations');
done('ramp over the whole program');
