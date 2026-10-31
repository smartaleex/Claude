import { launch, ok, done } from '../lib.mjs';
const { b, p, errs, url } = await launch();
const URL = url + 'index.html';
const dk = n => { const d=new Date(Date.now()-n*864e5); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
await p.addInitScript(([t,y])=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1';
  localStorage.setItem('alexhq:forge', JSON.stringify({ blockIndex:1, blockStart:t, sessions:{ old:{id:'old',day:'d1',dayKey:y,sets:{},done:true}, act:{id:'act',day:'d1',dayKey:t,sets:{},done:false,startedAt:Date.now()-600000} }, activeId:'act',
    lastByEx:{'Wide-grip lat pulldown':{w:45},'Assisted pull-up machine':{w:20}}, comeback:{off:true} }));
},[dk(0),dk(2)]);
await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.evaluate(()=>window.navigate('forge')); await p.waitForTimeout(700);
const m = () => p.evaluate(()=>{ const sc=document.getElementById('app'); const tb=document.querySelector('.tabbar').getBoundingClientRect(); const dk=document.getElementById('tmdock'); const db=dk&&!dk.hidden?dk.getBoundingClientRect():null; return { doc:window.scrollY, docH:document.scrollingElement.scrollHeight, inner:innerHeight, appTop:sc.scrollTop, appH:sc.scrollHeight, appC:sc.clientHeight, tabBottom:Math.round(tb.bottom), tabTop:Math.round(tb.top), dockBottom: db?Math.round(db.bottom):null }; });
let s = await m();
ok(s.docH<=s.inner && s.doc===0,'the document itself does not scroll (page height '+s.docH+' <= '+s.inner+')');
ok(s.appH>s.appC,'the content scrolls inside the app frame (content '+s.appH+' > frame '+s.appC+')');
ok(s.tabBottom===852,'tab bar at the very bottom');
const dock0 = s.dockBottom; ok(dock0!==null,'timer dock present');
// scroll the frame well down, then log sets (each one redraws the whole screen)
await p.evaluate(()=>{ document.getElementById('app').scrollTop = 900; }); await p.waitForTimeout(150);
const y0 = (await m()).appTop; ok(y0>600,'scrolled down '+y0);
const tapVisible = sel => p.evaluate(sel=>{ const els=[...document.querySelectorAll(sel)]; const e=els.find(x=>{const r=x.getBoundingClientRect(); return r.top>90&&r.bottom<700}); if(!e) return false; e.click(); return true; }, sel);
for (let i=0;i<4;i++){
  ok(await tapVisible('[data-act="addset"]'),'tapped a + Set that is on screen ('+(i+1)+')');
  await p.waitForTimeout(250);
  s = await m();
  if (i===0) ok(Math.abs(s.appTop-y0)<=2,'scroll position survives a redraw ('+y0+' -> '+s.appTop+')');
}
ok(Math.abs(s.appTop-y0)<=60,'and after four redraws ('+s.appTop+')');
ok(s.tabBottom===852,'tab bar did not move');
ok(s.dockBottom===dock0,'timer dock did not move ('+dock0+' -> '+s.dockBottom+')');
ok(s.doc===0,'document still at 0');
// fill-all and sheet open/close with the frame scrolled
if (await tapVisible('[data-act="fillsets"]')){ await p.waitForTimeout(300); s=await m(); ok(s.tabBottom===852&&s.dockBottom===dock0&&Math.abs(s.appTop-y0)<=80,'Log-all redraw: bars stay put, scroll kept ('+s.appTop+')'); }
if (await tapVisible('[data-act="editset"]')){ await p.waitForTimeout(500); await p.click('.sheet.on [data-act="inc"]'); await p.click('.sheet.on [data-act="save"]'); await p.waitForTimeout(500); s=await m(); ok(s.tabBottom===852&&s.dockBottom===dock0,'weight sheet save: bars stay put'); }
// opening and closing a sheet must never shove the scroll position (a delayed 'recovery' once did, ~0.5s later)
await p.evaluate(()=>{ document.getElementById('app').scrollTop = 700; }); await p.waitForTimeout(100);
const before = (await m()).appTop;
if (await tapVisible('[data-act="editset"]')){ await p.waitForTimeout(900); await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(1200); s=await m(); ok(Math.abs(s.appTop-before)<=2,'scroll unchanged 1.2s after opening and cancelling the weight sheet ('+before+' -> '+s.appTop+')'); }
// the last thing on the page is not hidden by the bars
await p.evaluate(()=>{ const sc=document.getElementById('app'); sc.scrollTop=sc.scrollHeight; }); await p.waitForTimeout(200);
const end = await p.evaluate(()=>{ const kids=[...document.querySelectorAll('#view > *')].filter(e=>e.getBoundingClientRect().height>0 && !e.hidden); const last=kids.at(-1).getBoundingClientRect(); return { lastBottom: Math.round(last.bottom), tabTop: Math.round(document.querySelector('.tabbar').getBoundingClientRect().top) }; });
ok(end.lastBottom<=end.tabTop,'bottom of the page clears the tab bar ('+end.lastBottom+' <= '+end.tabTop+')');
// sticky tab strip stays pinned while scrolling
await p.evaluate(()=>{ document.getElementById('app').scrollTop = 600; }); await p.waitForTimeout(150);
const seg = await p.evaluate(()=>{ const e=document.querySelector('.seg.sticky'); return e? Math.round(e.getBoundingClientRect().top):null; });
ok(seg!==null && seg<=20,'sticky tab strip stays pinned at the top (top='+seg+')');
// navigating resets to the top; switching tabs works
await p.evaluate(()=>window.navigate('fuel')); await p.waitForTimeout(500);
ok((await m()).appTop===0,'navigating to another screen starts at the top');
for (const app of ['day','clear','shout','ledger','vale','cryptic','home']){ await p.evaluate(a=>window.navigate(a),app); await p.waitForTimeout(350); s=await m(); ok(s.tabBottom===852 && s.docH<=s.inner,app+': frame ok, bar at bottom'); }
ok(errs.length===0,'no js errors '+(errs[0]||'')); await b.close();
done('app frame');
