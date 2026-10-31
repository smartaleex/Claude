import { launch, ok, done } from '../lib.mjs';
const { b, p, errs, url } = await launch();
const URL = url + 'index.html';
await p.goto(URL,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1000);
ok(await p.evaluate(()=>document.documentElement.dataset.skin)==='paper','defaults to Paper');
ok(await p.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('Public Sans')),'Paper body font is Public Sans');
await p.click('[data-act="settings"]'); await p.waitForTimeout(500);
ok((await p.$$('.sheet.on .skin-opt')).length===4,'four looks offered with live previews');
for (const sk of ['instrument','poster','lichen','paper']){
  await p.click(`.sheet.on [data-act="skin"][data-v="${sk}"]`); await p.waitForTimeout(500);
  const st = await p.evaluate(()=>({skin:document.documentElement.dataset.skin, saved:localStorage.getItem('alexhq:skin'), bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), meta:document.querySelector('meta[name="theme-color"]').content, disp:getComputedStyle(document.querySelector('.disp, .page-h1')||document.body).fontFamily.split(',')[0]}));
  ok(st.skin===sk && st.saved===sk,`${sk}: applied and saved`);
  ok(st.meta.toLowerCase()===st.bg.toLowerCase(),`${sk}: status-bar colour follows the page (${st.meta})`);
  console.log('   display font:', st.disp);
  ok(!!(await p.$('.sheet.on')),`${sk}: sheet stays open after switching`);
}
await p.click('.sheet.on [data-act="skin"][data-v="lichen"]'); await p.waitForTimeout(300);
await p.click('.sheet.on [data-act="theme"][data-v="dark"]'); await p.waitForTimeout(400);
ok(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())==='#101612','Lichen dark applies');
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(900);
ok(await p.evaluate(()=>document.documentElement.dataset.skin+'/'+document.documentElement.dataset.theme)==='lichen/dark','skin and theme survive a reload');
// no hard-coded purples left in the computed UI
await p.evaluate(()=>window.navigate('forge')); await p.waitForTimeout(500);
const old = await p.evaluate(()=>{ const bad=['rgb(88, 80, 236)','rgb(91, 108, 246)','rgb(139, 92, 246)','rgb(79, 70, 229)']; let n=0; document.querySelectorAll('#view *').forEach(e=>{const cs=getComputedStyle(e); [cs.color,cs.backgroundColor,cs.borderTopColor].forEach(c=>{ if(bad.includes(c)) n++; }); }); return n; });
ok(old===0,'no leftover indigo/violet from the old palette on Training ('+old+')');
ok(errs.length===0,'no js errors '+(errs[0]||'')); await b.close();
done('skins');
