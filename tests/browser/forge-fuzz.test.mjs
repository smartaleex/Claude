import { launch, ok, done } from '../lib.mjs';
const { b, ctx, url } = await launch();
const URL = url + 'index.html';
const dk = n => { const d=new Date(Date.now()-n*864e5); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
let seed=12345; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32); const pick=a=>a[Math.floor(rnd()*a.length)];
const WEIRD=[null,undefined,'',0,'40',40,42.5,-5,'abc',NaN,1e9,{},[],true];
const NAMES=['Incline machine chest press','Straight bar pushdown','Leg press (feet high)','Hip thrust (barbell or bench)','Cable front raise (rope, neutral grip)','Machine shoulder press','Lying leg curl','Dead bug','Pec deck fly','Nonexistent exercise'];
function makeState(i){
  const sessions={}; const n=Math.floor(rnd()*6);
  for(let k=0;k<n;k++){ const day=pick(['d1','d2','d3','d4']); const sets={}; for(let a=0;a<4;a++)for(let j=0;j<3;j++) if(rnd()<.4) sets[`${a}-${j}`]=Array.from({length:Math.floor(rnd()*5)},()=>pick([{w:pick(WEIRD)},{w:42.5},{},{w:null}])); sessions['s'+k]={id:'s'+k,day,dayKey:dk(Math.floor(rnd()*40)),sets,done:rnd()<.7,startedAt:rnd()<.5?Date.now()-rnd()*7e6:undefined,mins:pick([undefined,30,'x'])}; }
  const act = rnd()<.6; if(act){ const day=pick(['d1','d2','d3','d4']); sessions.act={id:'act',day,dayKey:dk(0),sets:{'0-0':[{w:pick(WEIRD)},{w:40}],'1-0':[{}],'3-0':[{w:20}]},done:false,startedAt:Date.now()-5e5}; }
  const lastByEx={}; NAMES.forEach(nm=>{ if(rnd()<.6) lastByEx[nm]=pick([{w:pick(WEIRD)},{w:30,est:true},{w:60}]); });
  const swaps={}; if(rnd()<.5) swaps[`d${1+Math.floor(rnd()*4)}|${pick(NAMES)}`]=pick(NAMES.concat(['Custom thing']));
  const custom = rnd()<.5 ? {'Custom thing':{gear:pick(['dumbbell','cable','machine','barbell','bodyweight','zzz']),idx:pick([null,0.4,1,undefined,'x'])}} : (rnd()<.5?undefined:{});
  const stack = pick([undefined,{cable:{unit:'lb',ratio:2},machine:{unit:'kg',ratio:1}},{cable:{unit:'kg',ratio:2}},{},{cable:null}]);
  const st = { blockIndex:Math.floor(rnd()*3), blockStart:dk(Math.floor(rnd()*70)), sessions, lastByEx, swaps, activeId:act?'act':pick([null,'ghost']),
    legs:pick(['kind','original',undefined,'weird']), comeback:pick([null,{start:dk(3),weeks:3},{start:dk(20),weeks:3,off:false},{off:true},{start:'garbage'}]), focus:pick([{},{ 'Side delts':2},{'Front delts':3}]) };
  if(custom!==undefined) st.custom=custom; if(stack!==undefined) st.stack=stack;
  return st;
}
let bad=0, runs=0;
/* Messy saved data (strings for weights, damaged dates, swaps that point nowhere...) across
   every phase, tab and interaction. 12 runs by default; FUZZ_RUNS=100 for a long soak. */
const RUNS = +process.env.FUZZ_RUNS || 12;
for (let i=0;i<RUNS;i++){
  const st=makeState(i);
  const pg = await ctx.newPage(); const pe=[]; pg.on('pageerror',e=>pe.push(e.message));
  await pg.addInitScript(s=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1'; localStorage.setItem('alexhq:forge', JSON.stringify(s)); }, st);
  try {
    await pg.goto(URL,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(500);
    await pg.evaluate(()=>window.navigate('forge')); await pg.waitForTimeout(350);
    for (const tab of ['plan','goal','photos','log','plan']){ const sel=`[data-act="tab"][data-v="${tab}"]`; if(await pg.$(sel)){ await pg.click(sel); await pg.waitForTimeout(220);} 
      const t=await pg.$eval('#view',e=>e.innerText); if(/hit a snag/i.test(t)||!t.trim()){ bad++; console.log('FAIL snag/blank run',i,'tab',tab,'::',(t.match(/hit a snag[\s\S]{0,200}/i)||[''])[0].replace(/\n/g,' ')); } }
    // start a session if none, tap through sets and edit
    if(!(await pg.$('[data-act="abandon"]'))){ const d=pick(['d1','d2','d3','d4']); const s=await pg.$(`[data-act="start"][data-d="${d}"]`); if(s){ await s.click(); await pg.waitForTimeout(300);} }
    const adds=await pg.$$('[data-act="addset"]'); for(const a of adds.slice(0,4)){ await a.click().catch(()=>{}); await pg.waitForTimeout(60); }
    const fills=await pg.$$('[data-act="fillsets"]'); if(fills[0]) await fills[0].click().catch(()=>{});
    const chip=await pg.$('[data-act="editset"]'); if(chip){ await chip.click(); await pg.waitForTimeout(350); const inp=await pg.$('#s-w'); if(inp){ await pg.click('.sheet.on [data-act="inc"]'); for (const k of pick([['4','1'],[],['0'],['9','9','9','9','9','9','9'],['.','.','5'],['del','del','del']])) await pg.click(`.sheet.on .pad [data-k="${k}"]`); const sv=await pg.$('.sheet.on [data-act="save"]'); if(sv) await sv.click(); await pg.waitForTimeout(200);} }
    const sw=await pg.$('[data-act="swap"]'); if(sw){ await sw.click(); await pg.waitForTimeout(300); const c=await pg.$('.sheet.on [data-act="pickswap"]'); if(c) await c.click(); await pg.waitForTimeout(200); }
    const t2=await pg.$eval('#view',e=>e.innerText); if(/hit a snag/i.test(t2)){ bad++; console.log('FAIL snag after interaction run',i); }
    runs++;
  } catch(e){ console.log('run',i,'harness error:',e.message.split('\n')[0]); }
  if(pe.length){ bad++; console.log('FAIL js error run',i,pe[0], JSON.stringify(st).slice(0,300)); }
  await pg.close();
}
ok(bad===0,`fuzz: ${runs} runs, ${bad} failures`);
await b.close();
done('training: fuzz');
