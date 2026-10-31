import { launch, ok, done } from '../lib.mjs';
const { b, p, errs, url } = await launch();
const URL = url + 'index.html';
const dk = n => { const d=new Date(Date.now()-n*864e5); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
await p.addInitScript(([t,y])=>{ if(sessionStorage.seeded) return; sessionStorage.seeded='1';
  localStorage.setItem('alexhq:forge', JSON.stringify({ blockIndex:1, blockStart:t, sessions:{ old:{id:'old',day:'d1',dayKey:y,sets:{},done:true}, act:{id:'act',day:'d2',dayKey:t,sets:{},done:false,startedAt:Date.now()-600000} }, activeId:'act',
    lastByEx:{'Incline machine chest press':{w:40}}, comeback:{start:'2000-01-01',weeks:3,off:true} }));
},[dk(0),dk(2)]);
await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.evaluate(()=>window.navigate('forge')); await p.waitForTimeout(700);
const dockVis = () => p.evaluate(()=>{const d=document.getElementById('tmdock'); if(!d) return 'none'; const cs=getComputedStyle(d); return d.hidden?'hidden-attr':cs.visibility+'/'+cs.opacity;});
const tabbarBottom = () => p.evaluate(()=>Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom));
const typeKeys = async ks => { for (const k of ks) await p.click(`.sheet.on .pad [data-k="${k}"]`); await p.waitForTimeout(60); };
const val = () => p.$eval('#s-w',e=>e.textContent);
ok(await dockVis()==='visible/1','dock visible with a live session');
ok(await tabbarBottom()===852,'tab bar sits at the bottom of the screen');

await p.click('[data-act="addset"][data-n="Incline machine chest press"]'); await p.waitForTimeout(300);
await p.click('[data-act="editset"][data-n="Incline machine chest press"]'); await p.waitForTimeout(500);
ok(await val()==='40','sheet opens showing the last weight (40)');
ok(!(await p.evaluate(()=>/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||''))),'no text field is focused: the phone keyboard never opens');
ok(!(await p.$('.sheet.on input')),'there is no text input in the weight sheet at all');
await typeKeys(['4']); ok(await val()==='4','first digit replaces the old value');
await typeKeys(['2','.','5']); ok(await val()==='42.5','typed 42.5');
await typeKeys(['.']); ok(await val()==='42.5','a second decimal point is ignored');
await typeKeys(['7']); ok(await val()==='42.57','two decimal places are allowed');
await typeKeys(['9']); ok(await val()==='42.57','a third decimal place is refused');
await typeKeys(['del','del','del']); ok(await val()==='42','backspace removes digits and the point');
await p.click('.sheet.on [data-act="inc"]'); ok(await val()==='44.5','+ nudges by 2.5');
await typeKeys(['1','0','0','0','0','0','0','0']); ok((await val()).length<=6,'length capped ('+await val()+')');
await typeKeys(['del','del','del','del','del','del','del']); ok(await val()==='—','empty shows a dash');
await typeKeys(['5','2','.','5']);
ok(await dockVis()==='visible/1','dock stays visible while entering a weight');
ok(await tabbarBottom()===852,'tab bar still at the bottom with the sheet open');
await p.click('.sheet.on [data-act="save"]'); await p.waitForTimeout(500);
ok((await p.$eval('[data-act="editset"][data-n="Incline machine chest press"]',e=>e.innerText.trim()))==='52.5kg','saved 52.5kg');
ok(await dockVis()==='visible/1','dock visible after saving');
ok(await tabbarBottom()===852,'tab bar at the bottom after saving');
ok(await p.evaluate(()=>document.documentElement.style.getPropertyValue('--kb')||'0px')==='0px','no keyboard lift left behind');
ok((await p.$$('.sheet.on')).length===0,'sheet closed');

// leading-decimal, empty save
await p.click('[data-act="editset"][data-n="Incline machine chest press"]'); await p.waitForTimeout(450);
await typeKeys(['.','5']); ok(await val()==='0.5','a leading point becomes 0.5');
await typeKeys(['del','del','del']); ok(await val()==='—','cleared');
await p.click('.sheet.on [data-act="save"]'); await p.waitForTimeout(400);
ok((await p.$eval('[data-act="editset"][data-n="Incline machine chest press"]',e=>e.innerText.trim()))==='✓','empty save = a plain tick');

// unstick: the recovery hook scrolls the FRAME by a pixel and returns, and never moves the document
await p.evaluate(()=>{ document.getElementById('app').scrollTop = 120; });
const r = await p.evaluate(async()=>{ const u=await import('./assets/js/core/ui.js'); const sc=document.getElementById('app'); const seen=[]; const d=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop'); Object.defineProperty(sc,'scrollTop',{configurable:true,get(){return d.get.call(this)},set(v){seen.push(Math.round(v)); d.set.call(this,v);}}); const y=sc.scrollTop; u.unstick(y); await new Promise(r=>setTimeout(r,250)); delete sc.scrollTop; return {y, seen, doc:window.scrollY, now:sc.scrollTop}; });
ok(r.seen[0]===r.y+1 && r.seen.at(-1)===r.y && r.now===r.y && r.doc===0,'unstick nudges the frame 1px and returns to the same spot '+JSON.stringify(r));
// the custom-name field is tucked away so the keyboard is not the default path
await p.click('[data-act="swap"][data-o="Incline machine chest press"]'); await p.waitForTimeout(400);
ok(await p.$eval('#cu-name',e=>e.hidden),'custom name field is hidden until asked for');
await p.click('.sheet.on [data-act="cgear"][data-g="dumbbell"]'); await p.click('.sheet.on [data-act="pickcustom"]'); await p.waitForTimeout(500);
ok(/Dumbbell|Incline/i.test(await p.$eval('#view',e=>e.innerText)),'custom swap works with no typed name');
ok(errs.length===0,'no js errors '+(errs[0]||'')); await b.close();
done('training: weight pad');
