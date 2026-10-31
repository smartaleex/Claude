/* "When I log a weight then do another set, it doesn't match the last one."
   A comeback week was easing every NEW set to 85% of last session's weight,
   even straight after logging one. A new set must copy the one before it. */
import { launch, open, go, ok, done, forgeSeed, liveSession, dayKey } from '../lib.mjs';

const { b, errs, url } = await launch();
const EX = 'Incline machine chest press';        // Phase 2, Chest + Triceps, first exercise

for (const [label, comeback] of [['comeback week', { start: dayKey(0), weeks: 3, off: false }], ['normal week', { off: true }]]){
  const pg = await b.contexts()[0].newPage();
  await open(pg, url, { 'alexhq:forge': forgeSeed({
    sessions: { old:{ id:'old', day:'d1', dayKey:dayKey(25), sets:{}, done:true }, act: liveSession('d2') }, activeId:'act',
    lastByEx: { [EX]: { w: 60 } }, comeback }) });
  await go(pg, 'forge', 700);
  // use this page for the helpers
  const P = pg;
  const chipsP = () => P.$$eval(`[data-act="editset"][data-n="${EX}"]`, els => els.map(e => e.innerText.trim()));
  const tapP = sel => P.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const addSet = async () => { await tapP(`[data-act="addset"][data-n="${EX}"]`); await P.waitForTimeout(250); };
  const first = label === 'comeback week' ? '50kg' : '60kg';

  await addSet();
  ok((await chipsP())[0] === first, `${label}: the first set opens at ${first} (last time 60kg${label === 'comeback week' ? ', eased' : ''})`);
  // type 40 into set 1
  await tapP(`[data-act="editset"][data-n="${EX}"][data-i="0"]`); await P.waitForTimeout(450);
  for (const k of ['4', '0']) await P.click(`.sheet.on .pad [data-k="${k}"]`);
  await P.click('.sheet.on [data-act="save"]'); await P.waitForTimeout(350);
  ok((await chipsP())[0] === '40kg', `${label}: set 1 saved at 40kg`);
  await addSet();
  ok(JSON.stringify(await chipsP()) === '["40kg","40kg"]', `${label}: set 2 matches set 1 (${JSON.stringify(await chipsP())})`);
  // change set 2 to 42.5, then the next one must follow set 2, not set 1
  await tapP(`[data-act="editset"][data-n="${EX}"][data-i="1"]`); await P.waitForTimeout(450);
  for (const k of ['4', '2', '.', '5']) await P.click(`.sheet.on .pad [data-k="${k}"]`);
  await P.click('.sheet.on [data-act="save"]'); await P.waitForTimeout(350);
  await addSet();
  ok(JSON.stringify(await chipsP()) === '["40kg","42.5kg","42.5kg"]', `${label}: set 3 follows the most recent set (${JSON.stringify(await chipsP())})`);
  const txt = await P.$eval('#view', e => e.innerText);
  ok(/next set 42\.5kg/.test(txt), `${label}: the exercise line says what the next set will be`);
  // "Log all" uses the same number
  const label2 = await P.evaluate(n => { const e = document.querySelector(`[data-act="fillsets"][data-n="${n}"]`); return e ? e.innerText.trim() : null; }, EX);
  ok(label2 === null || /42\.5kg/.test(label2), `${label}: "Log all" offers 42.5kg too (${label2})`);
  if (label2){ await tapP(`[data-act="fillsets"][data-n="${EX}"]`); await P.waitForTimeout(300);
    ok((await chipsP()).every(c => c === '40kg' || c === '42.5kg'), `${label}: Log all adds sets at the last weight, not an eased one (${JSON.stringify(await chipsP())})`); }
  await P.close();
}
ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('set weights carry over');
