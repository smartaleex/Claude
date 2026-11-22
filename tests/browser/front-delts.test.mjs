/* The front raise is on the shoulder day in every phase, as optional extra time,
   because every session is held to three supersets (4 / 3 / 3). */
import { launch, ok, done } from '../lib.mjs';
const { b, ctx, url } = await launch();
const URL = url + 'index.html';
for (const bi of [0,1,2]){
  const p = await ctx.newPage(); const pe=[]; p.on('pageerror',e=>pe.push(e.message));
  await p.addInitScript(bi=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1'; localStorage.setItem('alexhq:forge', JSON.stringify({blockIndex:bi, blockStart:new Date().toISOString().slice(0,10), comeback:{off:true}})); }, bi);
  await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  await p.evaluate(()=>window.navigate('forge')); await p.waitForTimeout(500);
  let t = await p.$eval('#view',e=>e.innerText);
  ok(/3 supersets/.test(t.split(/Shoulders/i)[1]?.slice(0,200)||t),`phase ${bi+1}: shoulder day lists 3 supersets`);
  await p.click('[data-act="start"][data-d="d4"]'); await p.waitForTimeout(500);
  t = await p.$eval('#view',e=>e.innerText);
  ok(!/SS4/.test(t),`phase ${bi+1}: no fourth superset`);
  const extra = t.split(/Extra time/i)[1] || '';
  ok(/Cable front raise/i.test(extra),`phase ${bi+1}: the cable front raise is in extra time`);
  ok(pe.length===0,`phase ${bi+1}: no js errors ${pe[0]||''}`); await p.close();
}
await b.close();
done('training: front delts');
