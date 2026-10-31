import { ok, done } from '../lib.mjs';
import { patternOf, swapsFor, SWAPS, LOAD_INDEX, convertWeight, loadIndex, gearOf, gearIndex, estimateForGear, stackToKg, kgToStack, stackConfigFor, GEARS } from '../../assets/js/data/swaps.js';
// every option has a K entry key, patterns resolve
for (const [k,g] of Object.entries(SWAPS)) for (const o of g.options) ok(o.name in LOAD_INDEX, `K entry for ${o.name}`);
ok(patternOf('Hip thrust (bench or machine)')==='glutes','hip thrust -> glutes');
ok(patternOf('Romanian deadlift')==='hinge','RDL still hinge');
ok(patternOf('Back extension (45°)')==='glutes' || patternOf('Back extension (45°)')==='hinge','back extension resolves');
ok(patternOf('Leg press (feet high)')==='quads','leg press quads');
ok(swapsFor('Hip thrust (barbell or bench)').options.length>=3,'glute swaps exist');

// gear
ok(gearOf('Machine chest press')==='machine','gear machine');
ok(gearOf('Flat DB press')==='dumbbell','gear DB');
ok(gearOf('Rope pushdown')==='cable','gear cable');
ok(gearOf('Close/neutral-grip lat pulldown')!==null,'gear for program wording');
ok(gearOf('Smith press',{ 'Smith press':{gear:'barbell',idx:.8}})==='barbell','custom gear honoured');

// estimates: machine chest press 60kg -> DB per hand
const e=estimateForGear('Machine chest press','dumbbell',60);
ok(e.kg>=20&&e.kg<=30,'60kg machine press -> ~25kg DB: '+e.kg);
const e2=estimateForGear('Machine chest press','barbell',60);
ok(e2.kg!=null&&e2.kg>0,'barbell fallback '+e2.kg);
ok(estimateForGear('Machine chest press','bodyweight',60).kg===null,'bodyweight carries no weight');
ok(estimateForGear('Machine chest press','dumbbell',null).kg===null && estimateForGear('Machine chest press','dumbbell',null).idx>0,'no weight yet, idx still returned');
ok(estimateForGear('Assisted pull-up machine','dumbbell',40).kg===null,'assisted machine carries nothing');
// custom chain: custom DB press then convert back to machine
const idx=e.idx; const extra={'DB incline thing':{gear:'dumbbell',idx}};
const back=convertWeight('DB incline thing','Machine chest press',e.kg,extra);
ok(Math.abs(back-60)<=3,'round trip custom -> machine ~60: '+back);
ok(loadIndex('DB incline thing',extra)===idx,'custom idx used');

// stack
ok(stackToKg(40,{unit:'kg',ratio:2})===20,'2:1 stack 40 -> 20kg');
ok(stackToKg(100,{unit:'lb',ratio:1})===45.25,'100lb -> 45.25kg '+stackToKg(100,{unit:'lb',ratio:1}));
ok(kgToStack(20,{unit:'kg',ratio:2})===40,'20kg at 2:1 -> stack 40');
ok(Math.abs(kgToStack(stackToKg(60,{unit:'lb',ratio:2}),{unit:'lb',ratio:2})-60)<=1,'lb 2:1 round trip within rounding');
ok(stackToKg('abc')===null,'garbage -> null');
ok(stackConfigFor('cable',{cable:{unit:'kg',ratio:1}})===null,'default config needs no conversion');
ok(stackConfigFor('cable',{cable:{unit:'kg',ratio:2}}).ratio===2,'2:1 needs conversion');
ok(stackConfigFor('dumbbell',{cable:{unit:'lb',ratio:2}})===null,'dumbbells never converted');
ok(convertWeight('Lat pulldown (any grip)','Single-arm cable pulldown',60)===30,'existing conversion intact');
done('swaps');
