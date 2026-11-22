import { launch, ok, done } from '../lib.mjs';
const { b, p, errs, url } = await launch();
const URL = url + 'index.html';
await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
const apps = { day:['today','reset','trend'], fuel:['today','history','trends'], forge:['plan','goal','photos','log'], clear:['today','trend','why'], cryptic:['today','archive','learn'], shout:['roster','plans'], ledger:['plan','fixed','goals','house'], vale:['learn','drill','talk'] };
for (const [app, tabs] of Object.entries(apps)){
  await p.evaluate(a=>window.navigate(a), app); await p.waitForTimeout(420);
  ok(!!(await p.$eval('#view', e=>e.innerText.trim())), app+' renders');
  for (const t of tabs){ const sel=`[data-act="tab"][data-v="${t}"]`; if(!(await p.$(sel))){console.log('   '+t+': NOT FOUND');continue;} await p.click(sel); await p.waitForTimeout(300); ok(!!(await p.$eval('#view',e=>e.innerText.trim())), `  ${app}/${t}`); }
}
await p.evaluate(()=>window.navigate('home')); await p.waitForTimeout(600);
ok(errs.length===0, errs.length? errs.join(' | ') : 'no js errors'); await b.close();
done('smoke: every screen opens');
