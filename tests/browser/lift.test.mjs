import { launch, ok, done } from '../lib.mjs';
const { b, p, errs, url } = await launch();
const URL = url + 'index.html';
await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.evaluate(async()=>{const m=await import('./assets/js/core/lift.js'); m.openLift('line');}); await p.waitForTimeout(400);
const seen=new Set(); for(let i=0;i<25;i++){ seen.add((await p.$eval('.sheet.on .card',e=>e.innerText)).replace(/\n/g,' ')); await p.click('.sheet.on [data-act="again"]'); await p.waitForTimeout(40); }
ok(seen.size>=20,'25 draws give variety: '+seen.size);
ok([...seen].every(x=>/—/.test(x)),'all attributed');
const all = await p.evaluate(async()=>{const m=await import('./assets/js/data/lift.js'); return m.QUOTES.map(q=>q.t+' | '+q.a);});
ok(all.some(x=>/empathy rob/.test(x)&&/TikTok/.test(x)),'TikTok quote present and credited honestly');
ok(all.some(x=>/hate the truth/.test(x)&&/Orwell/.test(x)),'Orwell note present');
ok(all.length>=60,'bank size '+all.length);
await p.click('.sheet.on [data-act="m"][data-v="truth"]'); await p.waitForTimeout(150);
ok((await p.$eval('.sheet.on .card',e=>e.innerText)).length>20,'truth renders');
await p.click('.sheet.on [data-act="m"][data-v="help"]'); await p.waitForTimeout(150);
ok(/13 11 14/.test(await p.$eval('.sheet.on',e=>e.innerText)),'help intact');
console.log(errs.length?errs:'no js errors'); await b.close();
done('lift: quotes, jokes, truths');
