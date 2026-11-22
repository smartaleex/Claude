/* The user's own example: assisted pull-ups swapped for a machine iso-lateral row, found by typing into a search of the whole
   library, then at the end of the workout: did it all balance out? */
import { launch, open, go, ok, done, forgeSeed, dayKey } from '../lib.mjs';

const { b, p, errs, url } = await launch();
await open(p, url, {
  'alexhq:forge': forgeSeed({
    blockIndex: 0,                                     // Phase 1: Back + Biceps opens with the assisted pull-up
    sessions: { old: { id: 'old', day: 'd2', dayKey: dayKey(2), sets: {}, done: true } },
    lastByEx: { 'Assisted pull-up (wide grip)': { w: 20 }, 'Wide-grip lat pulldown': { w: 50 } },
    comeback: { off: true },
  }),
});
await go(p, 'forge', 700);
const sheet = () => p.$eval('.sheet.on', e => e.innerText);
const view = () => p.$eval('#view', e => e.innerText);
const forge = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('alexhq:forge')));
// each "log all" redraws the screen, so click the first one left until there are none
const logEverything = () => p.evaluate(() => { for (let i = 0; i < 20; i++){ const b = document.querySelector('[data-act="fillsets"]'); if (!b) break; b.click(); } });
const closeSheet = async () => { await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300); };

await p.click('[data-act="start"][data-d="d1"]'); await p.waitForTimeout(700);
ok(/Assisted pull-up \(wide grip\)/.test(await view()), 'the session opens on Back + Biceps with the assisted pull-up');

// ---- the search: suggestions before you type, a live list as you type
const rows = () => p.$$eval('#lib-res [data-act="libpick"]', els => els.map(e => e.dataset.n));
await p.click('[data-act="swap"][data-o="Assisted pull-up (wide grip)"]'); await p.waitForTimeout(500);
ok(await p.$('#lib-q') !== null && await p.$('#lib-pick') === null, 'the swap sheet has a search box, no dropdown');
let r = await rows();
ok(/suggested/i.test(await sheet()) && r.length >= 4 && r.length <= 8, 'before typing it suggests swaps: ' + r.slice(0, 4).join(' | '));
ok(/pull-?up|pulldown/i.test(r[0]), 'same movement first: ' + r[0]);
ok(await p.$$eval('#lib-res svg.fm', e => e.length) === r.length, 'every row has a form diagram');
await p.type('#lib-q', 'iso'); await p.waitForTimeout(200);
r = await rows();
ok(r.length >= 3 && r.every(n => /iso/i.test(n)), 'three letters already narrow it: ' + r.join(' | '));
await p.fill('#lib-q', 'iso lateral row'); await p.waitForTimeout(200);
r = await rows();
ok(r.length <= 4 && r.includes('Machine iso-lateral row'), 'typing narrows the list: ' + r.join(' | '));
await p.fill('#lib-q', 'zzzz'); await p.waitForTimeout(150);
ok((await rows()).length === 0 && /nothing matches/i.test(await sheet()), 'nonsense says nothing matches');
await p.fill('#lib-q', 'iso lateral row'); await p.waitForTimeout(150);

// ---- before committing: what does it change?
await p.click('#lib-res [data-n="Machine iso-lateral row"]'); await p.waitForTimeout(400);
ok(await p.$('#lib-detail svg.fm') !== null, 'opening one shows its form');
let s = await sheet();
ok(/what this changes/i.test(s) && /vertical pull became horizontal pull/i.test(s), 'picking it explains the change: vertical pull becomes horizontal pull');
ok(/lats lose 4 sets/.test(s) && /upper back gains 4 sets/.test(s), 'lats lose 4 sets, upper back gains 4');
ok(/Lats today\s*11 → 7 sets/.test(s.replace(/\s+/g, ' ')) && /Upper back today\s*3 → 7 sets/.test(s.replace(/\s+/g, ' ')), 'with the session totals before and after');
ok(/no weight carries over/i.test(s), 'and, as it is a different movement, no weight is guessed');
ok(/width muscles/.test(s), 'it says lats are a width muscle');
ok(/Upper back · Horizontal pull/.test(s), 'it says what the exercise is');

await p.click('[data-act="uselib"]'); await p.waitForTimeout(600);
let f = await forge();
ok(f.swaps['d1|Assisted pull-up (wide grip)'] === 'Machine iso-lateral row', 'the swap is saved: ' + JSON.stringify(f.swaps));
ok(/Swapped from Assisted pull-up \(wide grip\)/.test(await view()) && /Machine iso-lateral row/.test(await view()), 'and shows in the session');

// ---- a same-movement pick does convert the weight
await p.click('[data-act="swap"][data-o="Wide-grip lat pulldown"]'); await p.waitForTimeout(500);
await p.fill('#lib-q', 'high row'); await p.waitForTimeout(200);
await p.click('#lib-res [data-n="Iso-lateral high row (machine)"]'); await p.waitForTimeout(400);
s = await sheet();
ok(/Start around 50kg \(est\.\)/.test(s) && /Same movement, different kit/.test(s), 'same movement: starts around 50kg and says nothing shifts');
await closeSheet();

// ---- an exercise with no listed alternates can still be swapped from the library
await p.evaluate(async () => { const m = await import('./assets/js/apps/forge/swap.js'); m.openSwap('Farmer carry', 'Farmer carry', 'd1'); });
await p.waitForTimeout(500);
ok(await p.$('#lib-q') !== null, 'an exercise with no alternates still gets the library search');
await p.fill('#lib-q', 'lat'); await p.waitForTimeout(150);
ok((await rows()).length > 0, 'and finds anything you type');
await closeSheet();

// ---- do the session, then finish
await logEverything(); await p.waitForTimeout(400);
await p.click('[data-act="finish"]'); await p.waitForTimeout(800);

// ---- how it balanced
s = await sheet();
ok(/how it balanced/i.test(s), 'finishing the workout opens "How it balanced"');
ok(/Back \+ Biceps/.test(s), 'for the session just done');
ok(/shifted|lopsided/i.test(s) && !/balanced\.\s/i.test(s.split('\n').slice(0, 8).join(' ')), 'it does not call a swapped-away lat session balanced: ' + (s.match(/(Shifted|Lopsided)[^\n]*/i) || [''])[0]);
ok(/what you swapped/i.test(s) && /Assisted pull-up \(wide grip\)\s*→\s*Machine iso-lateral row/.test(s.replace(/\s+/g, ' ')), 'it lists the swap');
const flat = s.replace(/\s+/g, ' ');
ok(/Lats[^\d]*11 → 7/.test(flat) && /Upper back[^\d]*3 → 7/.test(flat), 'lats 11 → 7, upper back 3 → 7 by muscle');
ok(/Vertical pull \(lat width\)\s*11 → 7/.test(flat) && /Horizontal pull \(thickness\)\s*3 → 7/.test(flat), 'vertical pull 11 → 7, horizontal pull 3 → 7 by movement');
ok(/4 short/.test(flat) && /width/.test(flat), 'lats are marked 4 short, and as a width muscle');
ok(/the rest of your week/i.test(s), 'and it looks at the rest of the week');
f = await forge();
const sess = Object.values(f.sessions).find(x => x.day === 'd1' && x.done);
ok(sess?.ex?.length === 6 && sess.ex[0].n === 'Machine iso-lateral row' && sess.ex[0].o === 'Assisted pull-up (wide grip)' && sess.ex[0].d === 4, 'the record of what was planned and done is saved on the session');
await closeSheet();

// ---- later, from History
await p.click('[data-act="tab"][data-v="log"]'); await p.waitForTimeout(500);
ok(/balance/i.test(await view()) && await p.$('[data-act="balance"]') !== null, 'History offers the balance for each session');
await p.click('[data-act="balance"]'); await p.waitForTimeout(500);
ok(/how it balanced/i.test(await sheet()) && /Machine iso-lateral row/.test(await sheet()), 'tapping it reopens the same picture');
await closeSheet();

// ---- a session with no swaps and every set done is simply balanced
await p.click('[data-act="tab"][data-v="plan"]'); await p.waitForTimeout(400);
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('alexhq:forge')); s.swaps = {}; localStorage.setItem('alexhq:forge', JSON.stringify(s)); });
await p.reload(); await p.waitForTimeout(900); await go(p, 'forge', 600);
await p.click('[data-act="start"][data-d="d3"]'); await p.waitForTimeout(600);
await logEverything(); await p.waitForTimeout(300);
await p.click('[data-act="finish"]'); await p.waitForTimeout(700);
s = await sheet();
ok(/how it balanced/i.test(s) && /balanced/i.test(s) && !/what you swapped/i.test(s), 'no swaps, everything done: balanced, with no swap section');
await closeSheet();

// ---- ticking a session off without logging has nothing to balance, and does not pop a sheet
ok(await p.$('.sheet.on') === null, 'no sheet left open');
ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('training: library search and session balance');
