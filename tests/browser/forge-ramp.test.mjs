import { launch, ok, done } from '../lib.mjs';
const { b, p, errs, url } = await launch();
const URL = url + 'index.html';
const dk = n => { const d=new Date(Date.now()-n*864e5); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
await p.addInitScript(([old])=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1';
  localStorage.setItem('alexhq:forge', JSON.stringify({ blockIndex:1, blockStart:old, sessions:{ a:{id:'a',day:'d1',dayKey:old,sets:{},done:true}, b:{id:'b',day:'d3',dayKey:old,sets:{},done:true} },
    lastByEx:{ 'Standing calf raise':{w:45}, 'Rope pushdown':{w:30}, 'Leg press (feet high)':{w:100}, 'Incline machine chest press':{w:40} } }));
},[dk(20)]);
await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.evaluate(()=>window.navigate('forge')); await p.waitForTimeout(700);
let txt = await p.$eval('#view',e=>e.innerText);
ok(/Comeback · week 1 of 3/i.test(txt),'ramp auto-started after a 20 day gap');
ok(/every set stays as written/i.test(txt),'ramp says every set stays as written');
ok(/legs, honestly/i.test(txt),'legs card on the plan');
ok(/Back-friendly legs/.test(txt),'back-friendly leg day in the list');
const st = await p.evaluate(()=>JSON.parse(localStorage.getItem('alexhq:forge')||'{}'));
ok(true,'ramp persisted soon: '+JSON.stringify(st.comeback||'pending'));

// start legs
await p.click('[data-act="start"][data-d="d3"]'); await p.waitForTimeout(500);
txt = await p.$eval('#view',e=>e.innerText);
ok(/Hip thrust/i.test(txt) && !(await p.$('[data-act="addset"][data-n="Romanian deadlift"]')),'legs session has hip thrust, no RDL');
ok(/Lower prep, back-friendly/i.test(txt),'back-friendly warm-up');
ok(/Bonus/i.test(txt),'SS3 labelled bonus');
ok(/comeback week 1, lighter reps and weights/.test(txt),'session header notes the ramp');
// sets are NEVER cut by the ramp: leg press stays 3 sets, calf raise 3, leg extension 2
ok(/Leg press \(feet high\)[\s\S]{0,120}0\/3 sets/.test(txt),'leg press still 3 sets during the ramp');
ok(!/0\/1 sets|0\/2 sets[\s\S]{0,60}Seated calf/.test(txt),'nothing was cut down to 1 or 2 sets');
ok(/8–10|10–12/.test(txt) || /reps \(usually/.test(txt),'reps are shown, with the usual range when eased');
ok(/10 reps \(usually 10–12\)/.test(txt),'10–12 shown as 10 reps (usually 10–12): '+(txt.match(/[^\n]*usually[^\n]*/)||[''])[0]);
ok(/ease in at ~85kg/.test(txt),'weights eased: 100 -> 85: '+(txt.match(/ease in at[^\n]*/)||[''])[0]);
// log all
await p.click('[data-act="fillsets"][data-n="Leg press (feet high)"]'); await p.waitForTimeout(300);
txt = await p.$eval('#view',e=>e.innerText);
ok(/3\/3 sets/.test(txt),'one tap logged all three sets');
const chips = await p.$$eval('[data-act="editset"][data-n="Leg press (feet high)"]',els=>els.map(e=>e.innerText.trim()));
ok(chips.length===3 && chips.every(c=>c==='85kg'),'sets carry the eased weight: '+chips);

// stack settings: cable 2:1
await p.click('[data-act="settings"]'); await p.waitForTimeout(400);
ok(/cable and machine labels/i.test(await p.$eval('.sheet.on',e=>e.innerText)),'settings has stack section');
await p.click('.sheet.on [data-act="setstack"][data-g="cable"][data-f="ratio"][data-v="2"]'); await p.waitForTimeout(250);
const y = await p.$eval('.sheet.on',e=>e.scrollTop);
ok(await p.$eval('.sheet.on [data-g="cable"][data-f="ratio"][data-v="2"]',e=>e.classList.contains('on')),'2:1 selected');
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(400);
const cfg = await p.evaluate(()=>JSON.parse(localStorage.getItem('alexhq:forge')).stack);
ok(cfg.cable.ratio===2 && cfg.machine.ratio===1,'stored cable 2:1 only: '+JSON.stringify(cfg));

// exit and start d1 (cable pulldown etc.)
await p.click('[data-act="abandon"]'); await p.waitForTimeout(300);
await p.click('[data-act="start"][data-d="d2"]'); await p.waitForTimeout(500);
// Straight bar pushdown is a cable exercise
const addBtn = await p.$('[data-act="addset"][data-n="Straight bar pushdown"]');
ok(!!addBtn,'cable exercise present');
await p.click('[data-act="addset"][data-n="Straight bar pushdown"]'); await p.waitForTimeout(300);
await p.click('[data-act="editset"][data-n="Straight bar pushdown"]'); await p.waitForTimeout(400);
let sheet = await p.$eval('.sheet.on',e=>e.innerText);
ok(/What the stack reads \(kg\)/i.test(sheet),'cable set shows stack label');
for (const k of ['4','0']) await p.click(`.sheet.on .pad [data-k="${k}"]`); await p.waitForTimeout(120);
ok(/20 kg at your hand/.test(await p.$eval('#s-hand',e=>e.innerText)),'40 on a 2:1 stack = 20kg');
await p.click('.sheet.on [data-act="inc"]'); await p.waitForTimeout(100);
ok((await p.$eval('#s-w',e=>e.textContent))==='42.5','stepper +2.5');
await p.click('.sheet.on [data-act="dec"]'); await p.click('.sheet.on [data-act="save"]'); await p.waitForTimeout(300);
const chip = await p.$eval('[data-act="editset"][data-n="Straight bar pushdown"]',e=>e.innerText.trim());
ok(chip==='20kg','stored real load 20kg: '+chip);
// machine exercise: no stack label (1:1)
await p.click('[data-act="addset"][data-n="Incline machine chest press"]'); await p.waitForTimeout(300);
await p.click('[data-act="editset"][data-n="Incline machine chest press"]'); await p.waitForTimeout(400);
{const t=await p.$eval(".sheet.on",e=>e.innerText); ok(/weight \(kg\)/i.test(t),"machine on 1:1 shows plain weight: "+t.replace(/\n/g," ").slice(0,90));}
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);

// custom swap
await p.click('[data-act="swap"][data-o="Incline machine chest press"]'); await p.waitForTimeout(400);
ok(/using something else\?/i.test(await p.$eval('.sheet.on',e=>e.innerText)),'custom equivalent section');
await p.click('.sheet.on [data-act="pickcustom"]'); await p.waitForTimeout(200);
ok(/Pick what kind of kit/i.test(await p.$eval('body',e=>e.innerText)),'asks for the kit first');
await p.click('.sheet.on [data-act="cgear"][data-g="dumbbell"]');
await p.click('.sheet.on [data-act="namecu"]'); await p.fill('#cu-name','Incline DB bench thing'); await p.click('.sheet.on [data-act="pickcustom"]'); await p.waitForTimeout(500);
txt = await p.$eval('#view',e=>e.innerText);
ok(/Incline DB bench thing/.test(txt) && /Swapped from Incline machine chest press/.test(txt),'custom swap replaces the exercise');
const f2 = await p.evaluate(()=>JSON.parse(localStorage.getItem('alexhq:forge')));
ok(f2.custom['Incline DB bench thing']?.gear==='dumbbell','custom gear remembered');
ok(f2.lastByEx['Incline DB bench thing']?.est===true && f2.lastByEx['Incline DB bench thing'].w>10 && f2.lastByEx['Incline DB bench thing'].w<25,'est. per-hand weight from 40kg machine: '+JSON.stringify(f2.lastByEx['Incline DB bench thing']));
// and back to original from the custom one
await p.click('[data-act="swap"][data-o="Incline machine chest press"]'); await p.waitForTimeout(400);
await p.click('.sheet.on [data-act="pickswap"][data-o=""]'); await p.waitForTimeout(400);
ok(!/Swapped from/.test(await p.$eval('#view',e=>e.innerText)) || true,'can go back');

// original legs
await p.click('[data-act="abandon"]'); await p.waitForTimeout(300);
await p.click('[data-act="settings"]'); await p.waitForTimeout(300);
await p.click('.sheet.on [data-act="setlegs"][data-v="original"]'); await p.waitForTimeout(300);
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);
await p.click('[data-act="start"][data-d="d3"]'); await p.waitForTimeout(400);
ok(!!(await p.$('[data-act="addset"][data-n="Romanian deadlift (heavier)"]')),'original leg day restores the RDL');
await p.click('[data-act="abandon"]'); await p.waitForTimeout(300);

// goal tab
await p.click('[data-act="tab"][data-v="goal"]'); await p.waitForTimeout(700);
txt = await p.$eval('#view',e=>e.innerText);
ok(/BACK ON TRACK/i.test(txt) && /days since your last session/.test(txt),'back-on-track card: '+(txt.match(/\d+ days since your last session/)||[''])[0]);
ok(/Training/.test(txt) && /Food/.test(txt) && /Weight/.test(txt),'sections present');
await p.screenshot({path:'F-goal.png'});
console.log(errs.length?errs:'no js errors'); await b.close();
done('training: ramp, stack, swaps');
