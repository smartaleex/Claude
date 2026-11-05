/* "Change it in your own words": type it, see the verdict and reasons, apply, see the program change, undo. */
import { launch, open, go, ok, done, forgeSeed, dayKey, enableAI, stubGemini } from '../lib.mjs';

const { b, p, errs, url } = await launch();
const sessions = { old: { id: 'old', day: 'd1', dayKey: dayKey(2), sets: {}, done: true } };
await open(p, url, {
  'alexhq:forge': forgeSeed({ blockIndex: 1, sessions, comeback: { off: true } }),
  'alexhq:fuel': { targets: { kcal: 2800 }, days: {}, weights: { [dayKey(1)]: 74.5 } },
});
await go(p, 'forge', 700);
const text = () => p.$eval('#view', e => e.innerText);
const sheet = () => p.$eval('.sheet.on', e => e.innerText);
const forge = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('alexhq:forge')));

ok(/change it in your own words/i.test(await text()), 'the Plan tab offers it');
await p.click('[data-act="editwords"]'); await p.waitForTimeout(500);
ok(/change it in your own words/i.test(await sheet()) && await p.$('#ed-q') !== null, 'the sheet opens with a box to type in');
ok((await p.$$('[data-act="ex"]')).length >= 3, 'with examples to tap');

// ---- a good change: more of a width muscle
await p.fill('#ed-q', 'make side delts 5 sets on shoulders day');
await p.click('[data-act="check"]'); await p.waitForTimeout(900);
let s = await sheet();
ok(/DB lateral raise \+ partials: 5 sets/.test(s), 'it reads the words into a change: ' + (s.match(/DB lateral[^\n]*/) || [''])[0]);
ok(/good fit/i.test(s), 'and calls it a good fit');
ok(/Side delts[^\n]*4 → 5 sets|Side delts\s*4\s*→\s*5/.test(s.replace(/\s+/g, ' ')), 'it shows the weekly sets it changes');
ok(/Shoulders \+ Arms[\s\S]*min/.test(s), 'and the session length');
ok(/read with simple rules/i.test(s), 'it says how it read it (AI is off here)');
ok(/eating|74\.5kg/.test(s), 'it says what it checked against');

// ---- a change that should be questioned
await p.fill('#ed-q', 'swap incline machine chest press for barbell bench press');
await p.click('[data-act="check"]'); await p.waitForTimeout(900);
s = await sheet();
ok(/not advised for you/i.test(s) && /shoulder/i.test(s), 'barbell bench is not advised, with the reason: ' + (s.match(/not advised[^\n]*/i) || [''])[0]);
ok(await p.$eval('[data-act="tog"]', e => !e.classList.contains('on')), 'and it is not ticked by default');
ok(await p.$('[data-act="apply"]') === null, 'so there is nothing to apply until you choose to');
await p.click('[data-act="tog"]'); await p.waitForTimeout(200);
ok(await p.$('[data-act="apply"]') !== null, 'tapping it opts in');

// ---- ambiguity and nonsense are said out loud
await p.fill('#ed-q', 'pushdown to 4 sets');
await p.click('[data-act="check"]'); await p.waitForTimeout(700);
ok(/could be[\s\S]*pushdown/i.test(await sheet()), 'an ambiguous exercise is asked about, not guessed');
await p.fill('#ed-q', 'make it better somehow');
await p.click('[data-act="check"]'); await p.waitForTimeout(700);
ok(/Could not read/.test(await sheet()) && await p.$('[data-act="apply"]') === null, 'nonsense is a note, never a change');

// ---- apply a real change and see the program change
await p.fill('#ed-q', 'make side delts 5 sets on shoulders day and set pec deck rest to 2 minutes');
await p.click('[data-act="check"]'); await p.waitForTimeout(900);
ok(/Apply 2 changes/.test(await sheet()), 'two changes in one sentence: ' + (await sheet()).match(/Apply[^\n]*/));
await p.click('[data-act="apply"]'); await p.waitForTimeout(600);
let f = await forge();
ok((f.edits || []).length === 1 && f.edits[0].ops.length === 2, 'saved as one batch');
await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300);
await p.click('[data-act="start"][data-d="d4"]'); await p.waitForTimeout(700);
ok(/5 sets/.test(await text()) || /0\/5|5 sets/.test(await p.$eval('#view', e => e.innerHTML)), 'the lateral raise now shows 5 sets in the session');
await p.click('[data-act="abandon"]').catch(() => {}); await p.waitForTimeout(300);
await p.evaluate(() => { const b = document.querySelector('[data-act="abandon"]'); if (b) b.click(); });
await p.waitForTimeout(300);

// ---- history and undo
await go(p, 'forge', 600);
ok(/1 made/.test(await text()), 'the Plan tab says one change has been made');
await p.click('[data-act="editwords"]'); await p.waitForTimeout(500);
ok(/changes you have made/i.test(await sheet()) && await p.$('[data-act="undo"]') !== null, 'the sheet lists it with an Undo');
await p.click('[data-act="undo"]'); await p.waitForTimeout(400);
f = await forge();
ok((f.edits || []).length === 0, 'undo removes the batch');
await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300);

// ---- a swap goes through the same swap maps, and undoes cleanly
await p.click('[data-act="editwords"]'); await p.waitForTimeout(400);
await p.fill('#ed-q', 'swap lying leg curl for seated leg curl');
await p.click('[data-act="check"]'); await p.waitForTimeout(900);
ok(/good fit/i.test(await sheet()), 'a like-for-like swap is a good fit');
await p.click('[data-act="apply"]'); await p.waitForTimeout(500);
f = await forge();
ok(Object.values(f.swaps || {}).includes('Seated leg curl') || Object.values(f.swaps || {}).some(v => /seated leg curl/i.test(v)), 'the swap is saved where the swap sheet saves it: ' + JSON.stringify(f.swaps));
await p.click('[data-act="editwords"]'); await p.waitForTimeout(400);
await p.click('[data-act="undo"]'); await p.waitForTimeout(400);
f = await forge();
ok(Object.keys(f.swaps || {}).length === 0, 'undoing the swap puts the original back');
await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300);

// ---- the stack setting
await p.click('[data-act="editwords"]'); await p.waitForTimeout(400);
await p.fill('#ed-q', 'cable stack reads in lb and is 2:1');
await p.click('[data-act="check"]'); await p.waitForTimeout(800);
await p.click('[data-act="apply"]'); await p.waitForTimeout(500);
f = await forge();
ok(f.stack?.cable?.unit === 'lb' && f.stack?.cable?.ratio === 2, 'the cable stack is saved in lb at 2:1: ' + JSON.stringify(f.stack?.cable));
await p.click('[data-act="editwords"]'); await p.waitForTimeout(400);
await p.click('[data-act="undo"]'); await p.waitForTimeout(400);
f = await forge();
ok(f.stack?.cable?.unit === 'kg' && f.stack.cable.ratio === 1, 'undo puts the stack back');
await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300);

// ---- structural changes wait while a session is open
await go(p, 'forge', 600);
await p.click('[data-act="start"][data-d="d4"]'); await p.waitForTimeout(700);
await p.evaluate(async () => { const m = await import('./assets/js/apps/forge/edit.js'); m.openEdit(); }); await p.waitForTimeout(500);
await p.fill('#ed-q', 'drop the face pulls');
await p.click('[data-act="check"]'); await p.waitForTimeout(800);
ok(/finish or exit your open session/i.test(await sheet()) && await p.$('[data-act="apply"]') === null, 'removing an exercise waits until the open session is finished');
await p.fill('#ed-q', 'make side delts 4 sets');
await p.click('[data-act="check"]'); await p.waitForTimeout(800);
ok(await p.$('[data-act="apply"]') !== null, 'but changing sets, reps and rest is fine mid-session');

// ---- with Gemini on: it is asked with your context, and its reasoning shows next to the rule-based check
await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300);
await enableAI(p);
const seen = await stubGemini(p, () => ({
  ops: [{ type: 'swap', day: 'd2', from: 'Pec deck fly', to: 'Cable crossover (high to low)', gear: 'cable', why: 'Keeps tension on the chest without the deep stretch that bothers your shoulder.' }],
  say: 'Swapping the pec deck for a cable version.',
}));
await p.evaluate(async () => { const m = await import('./assets/js/apps/forge/edit.js'); m.openEdit(); }); await p.waitForTimeout(500);
await p.fill('#ed-q', 'the pec deck is always taken, do something cabley instead');
await p.click('[data-act="check"]'); await p.waitForTimeout(1200);
s = await sheet();
ok(/read by gemini/i.test(s), 'it says Gemini read it');
ok(/deep stretch that bothers your shoulder/.test(s), "and shows Gemini's reasoning");
ok(/Pec deck fly → Cable crossover/.test(s), 'the change is checked against the real program');
ok(/good fit|worth a look/i.test(s), 'and still gets the rule-based verdict');
const prompt = seen.join(' ');
ok(seen.length >= 1 && /unstable/.test(prompt) && /distal triceps/.test(prompt) && /knees cave/.test(prompt), 'the prompt carries the injuries');
ok(/swimmer|wide lats|wide delts/.test(prompt) && /Phase 2/.test(prompt), 'and the goal and the phase');
ok(/Pec deck fly/.test(prompt) && /Lying leg curl/.test(prompt), 'and the program with its exact exercise names');
ok(/74\.5kg/.test(prompt), 'and the latest bodyweight');

ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('training: change it in your own words');
