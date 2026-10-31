import { launch, ok, done, OUT } from '../lib.mjs';
import { mkdirSync } from 'node:fs';
/* Every screen, in every look, light and dark: no script errors, no sideways
   overflow, and no text that is hard to read against its own background.
   Set SHOTS=1 to also save a screenshot of each into tests/out/. */
const skins = (process.env.SKINS || 'paper,instrument,poster,lichen').split(',');
const modes = (process.env.MODES || 'light,dark').split(',');
const shot = !!process.env.SHOTS;
if (shot) mkdirSync(OUT, { recursive:true });
const { b, ctx, url } = await launch();
const URL = url + 'index.html';
const SEED = () => {
  const k=n=>{const d=new Date(Date.now()-n*864e5);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  localStorage.setItem('alexhq:forge', JSON.stringify({blockIndex:1,blockStart:k(10),sessions:{a:{id:'a',day:'d1',dayKey:k(2),sets:{},done:true},act:{id:'act',day:'d2',dayKey:k(0),sets:{'0-0':[{w:40},{w:40}]},done:false,startedAt:Date.now()-900000}},activeId:'act',lastByEx:{'Incline machine chest press':{w:40}},comeback:{off:true}}));
  localStorage.setItem('alexhq:fuel', JSON.stringify({days:{[k(0)]:[{id:'1',name:'Oats and milk',kcal:620,p:32,c:84,f:14,meal:'Breakfast'},{id:'2',name:'Chicken wrap',kcal:710,p:48,c:60,f:26,meal:'Lunch'}],[k(1)]:[{id:'3',name:'Dinner',kcal:1900,p:120,c:200,f:60,meal:'Dinner'}],[k(2)]:[{id:'4',name:'Day',kcal:2500,p:150,c:300,f:80,meal:'Lunch'}]},weights:{[k(9)]:72.0,[k(5)]:72.4,[k(1)]:73.1}}));
  localStorage.setItem('alexhq:shout', JSON.stringify({people:[{id:'p1',name:'Marcus',type:'mate',cadence:14,last:k(20)},{id:'p2',name:'Priya',type:'family',cadence:7,last:k(3)},{id:'p3',name:'Sam',type:'seeing',cadence:3,last:k(1)},{id:'p4',name:'Joel',type:'mate',cadence:21,last:k(30)}]}));
  localStorage.setItem('alexhq:day', JSON.stringify({mood:{[k(1)]:{m:1,e:2},[k(2)]:{m:0,e:1},[k(3)]:{m:-1,e:1}},sleep:{[k(0)]:{hours:6.5,quality:3},[k(1)]:{hours:5,quality:2}}}));
};
const CHECK = () => {
  const parse = c => { let m = c.match(/rgba?\(([^)]+)\)/); if (m){ const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:a[0],g:a[1],b:a[2],a:a[3]??1}; }
    m = c.match(/color\(srgb ([^)]+)\)/); if (m){ const a=m[1].split(/[ \/]+/).filter(Boolean).map(Number); return {r:a[0]*255,g:a[1]*255,b:a[2]*255,a:a[3]??1}; } return null; };
  const lum = c => { const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}; return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); };
  const over = (top, bot) => ({ r: top.r*top.a + bot.r*(1-top.a), g: top.g*top.a + bot.g*(1-top.a), b: top.b*top.a + bot.b*(1-top.a), a:1 });
  const bgOf = el => { const stack=[]; for (let e=el; e; e=e.parentElement){ const c=parse(getComputedStyle(e).backgroundColor); if (c && c.a>0){ stack.push(c); if (c.a>=.99) break; } } let base={r:255,g:255,b:255,a:1}; if(!stack.length) base=parse(getComputedStyle(document.body).backgroundColor)||base; for (const c of stack.reverse()) base=over(c,base); return base; };
  const bad=[]; const seen=new Set();
  const walker=document.createTreeWalker(document.querySelector('#view'),NodeFilter.SHOW_TEXT);
  let n; while((n=walker.nextNode())){ const t=n.textContent.trim(); if(t.length<2) continue; const el=n.parentElement; if(!el||seen.has(el)) continue; seen.add(el);
    const cs=getComputedStyle(el); if (cs.visibility==='hidden'||cs.display==='none') continue; const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    let fg=parse(cs.color); if(!fg) continue; const bg=bgOf(el); if (fg.a<1) fg=over(fg,bg);
    const L2=lum(bg);
    let eff=1; for(let e=el;e&&e!==document.body;e=e.parentElement) eff*=parseFloat(getComputedStyle(e).opacity)||1;
    // opacity lowers contrast: approximate by blending fg toward bg
    const fg2={r:fg.r*eff+bg.r*(1-eff),g:fg.g*eff+bg.g*(1-eff),b:fg.b*eff+bg.b*(1-eff)};
    const L3=lum(fg2), ratio2=(Math.max(L3,L2)+.05)/(Math.min(L3,L2)+.05);
    if (ratio2<3) bad.push(`${ratio2.toFixed(1)} "${t.slice(0,28)}" <${el.tagName.toLowerCase()} class="${el.className}">`);
  }
  return { overflow: document.scrollingElement.scrollWidth - innerWidth, bad };
};
const SCREENS = [['home',null],['day',null],['fuel',null],['forge','plan'],['forge','session'],['cryptic',null],['shout',null],['ledger',null],['clear',null],['vale',null]];
for (const sk of skins) for (const mode of modes){
  const p = await ctx.newPage(); const pe=[]; p.on('pageerror',e=>pe.push(e.message));
  await p.addInitScript(([sk,mode,seed])=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1'; localStorage.setItem('alexhq:skin',sk); localStorage.setItem('alexhq:theme',mode); (new Function('return ('+seed+')()'))(); },[sk,mode,SEED.toString()]);
  await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1300);
  for (const [app,sub] of SCREENS){
    if (app!=='home') await p.evaluate(a=>window.navigate(a), app); else await p.evaluate(()=>window.navigate('home'));
    await p.waitForTimeout(600);
    if (app==='forge' && sub==='plan'){ if (await p.$('[data-act="abandon"]')) { await p.evaluate(()=>{}); } }
    const r = await p.evaluate(CHECK);
    const name = `${app}${sub?':'+sub:''}`;
    if (shot) await p.screenshot({path:`${OUT}/QA-${sk}-${mode}-${app}${sub?'_'+sub:''}.png`});
    ok(r.overflow <= 0, `${sk}/${mode} ${name}: no sideways overflow${r.overflow>0 ? ' ('+r.overflow+'px)' : ''}`);
    ok(r.bad.length === 0, `${sk}/${mode} ${name}: text is readable${r.bad.length ? ' :: '+r.bad.slice(0,3).join(' | ') : ''}`);
  }
  ok(pe.length===0, `${sk}/${mode}: no script errors ${pe[0]||''}`);
  await p.close();
}
await b.close();
done('looks');
