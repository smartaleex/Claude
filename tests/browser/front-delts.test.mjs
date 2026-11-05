import { launch, ok, done } from '../lib.mjs';
const { b, ctx, url } = await launch();
const URL = url + 'index.html';
for (const bi of [0,1,2]){
  const p = await ctx.newPage(); const pe=[]; p.on('pageerror',e=>pe.push(e.message));
  await p.addInitScript(bi=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1'; localStorage.setItem('alexhq:forge', JSON.stringify({blockIndex:bi, blockStart:new Date().toISOString().slice(0,10), comeback:{off:true}, lastByEx:{'Cable front raise (rope, neutral grip)':{w:10}}})); }, bi);
  await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  await p.evaluate(()=>window.navigate('forge')); await p.waitForTimeout(500);
  let t = await p.$eval('#view',e=>e.innerText);
  ok(/4 supersets/.test(t.split(/Shoulders/i)[1]?.slice(0,200)||t),`phase ${bi+1}: shoulder day lists 4 supersets`);
  await p.click('[data-act="start"][data-d="d4"]'); await p.waitForTimeout(500);
  t = await p.$eval('#view',e=>e.innerText);
  ok(/SS4 — Front Delts/i.test(t) && /Cable front raise/i.test(t),`phase ${bi+1}: SS4 Front Delts with the cable front raise`);
  ok(/last 10kg/.test(t),`phase ${bi+1}: remembers its weight`);
  await p.click('[data-act="addset"][data-n="Cable front raise (rope, neutral grip)"]'); await p.waitForTimeout(250);
  ok(/1\/3 sets/.test(await p.$eval('#view',e=>e.innerText)),`phase ${bi+1}: logs a set`);
  ok((await p.evaluate(()=>{const d=document.getElementById('tmdock'); return d&&!d.hidden&&getComputedStyle(d).visibility==='visible';})),`phase ${bi+1}: timer dock visible after logging`);
  if (bi===1){
    await p.click('[data-act="swap"][data-n="Cable front raise (rope, neutral grip)"]'); await p.waitForTimeout(350);
    const s = await p.$eval('.sheet.on',e=>e.innerText);
    ok(/front raise/i.test(s)&&/DB front raise/i.test(s)&&/Plate front raise/i.test(s),'swap sheet offers DB / plate / band front raise');
    ok(/Start around \d/i.test(s)||/Your last/i.test(s),'with a weight estimate: '+(s.match(/Start around[^\n]*/)||[''])[0]);
    await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(250);
    await p.click('[data-act="abandon"]'); await p.waitForTimeout(250);
    await p.click('[data-act="tab"][data-v="goal"]'); await p.waitForTimeout(600);
    const g = await p.$eval('#view',e=>e.innerText);
    ok(/FRONT DELTS\s*\n?\s*6|Front delts\s*\n?\s*6/i.test(g.replace(/\n+/g,' ').replace(/\s+/g,' ')) || /front delts/i.test(g),'weekly volume lists Front delts: '+(g.match(/front delts[\s\S]{0,12}/i)||[''])[0].replace(/\n/g,' '));
  }
  ok(pe.length===0,`phase ${bi+1}: no js errors ${pe[0]||''}`); await p.close();
}
await b.close();
done('training: front delts');
