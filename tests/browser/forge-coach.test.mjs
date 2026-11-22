/* The session screen: 4 / 3 / 3 sets, a form diagram on every exercise, the muscle map that
   reshades when you swap, and the coach. Alex's own example: knees hurt after the RDLs. */
import { launch, open, go, ok, done, forgeSeed, dayKey, enableAI, stubGemini } from '../lib.mjs';

const { b, p, errs, url } = await launch();
await open(p, url, {
  'alexhq:forge': forgeSeed({
    blockIndex: 0, legs: 'original', comeback: { off: true },
    sessions: { old: { id: 'old', day: 'd1', dayKey: dayKey(2), sets: {}, done: true } },
    lastByEx: { 'Romanian deadlift': { w: 60 } },
  }),
});
await go(p, 'forge', 700);
const view = () => p.$eval('#view', e => e.innerText);
const sheet = () => p.$eval('.sheet.on', e => e.innerText);
const forge = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('alexhq:forge')));
const listText = () => p.$eval('.mm-card .mm-list', e => e.innerText.replace(/\s+/g, ' '));

// ---- the plan shows the week's balance
ok(await p.$('.mm-card svg.mm') !== null && /this week/i.test(await p.$eval('.mm-card', e => e.innerText)), 'the Plan shows the week on the muscle map');

// ---- the session
await p.click('[data-act="start"][data-d="d3"]'); await p.waitForTimeout(700);
let t = await view();
ok(/Romanian deadlift/.test(t), 'legs as first written, with the Romanian deadlift');
ok((t.match(/0\/4 sets/g) || []).length === 2 && (t.match(/0\/3 sets/g) || []).length === 4, 'sets run 4 / 3 / 3: two exercises at 4, four at 3');

// ---- form diagrams
const thumbs = await p.$$('[data-act="form"]');
ok(thumbs.length === 6, `every exercise has a form diagram (${thumbs.length})`);
await p.click('[data-act="form"][data-o="Romanian deadlift"]'); await p.waitForTimeout(500);
ok(await p.$('.sheet.on .form-stage svg.fm[data-form="hinge"]') !== null, 'tapping it opens the movement, drawn as a hinge');
ok(/start of the rep/i.test(await sheet()) && /ask the coach/i.test(await sheet()), 'with a key to the drawing and a way to ask the coach');

// ---- the muscle map
ok((await p.$$('.mm-card svg.mm')).length === 2, 'front and back on the session screen');
ok(await p.$$eval('.mm-card .mm-1, .mm-card .mm-2, .mm-card .mm-3, .mm-card .mm-4', e => e.length) > 0, 'muscles worked today are shaded');
const before = await listText();
ok(/Hamstrings 6/.test(before) && /Quads 7/.test(before), 'today: hamstrings 6, quads 7: ' + before.slice(0, 80));

// ---- the coach, without AI: asked from the exercise
await p.click('.sheet.on [data-act="fcoach"]'); await p.waitForTimeout(600);
ok(/About: Romanian deadlift/.test(await view()) && (await p.$eval('#co-q', e => e.value)).startsWith('Romanian deadlift'), 'the coach opens on that exercise');
await p.fill('#co-q', 'Romanian deadlift: my knees hurt after these, what should I do instead?');
await p.click('[data-act="coachask"]'); await p.waitForTimeout(900);
t = await view();
ok(/physio/i.test(t) && /simple rules/i.test(t), 'offline it answers with a swap and when to see a physio');
ok(/Romanian deadlift → /.test(t) && await p.$('[data-act="coachapply"]') !== null, 'and sets the swap up to apply: ' + (t.match(/Romanian deadlift → [^\n]*/) || [''])[0]);
await p.click('[data-act="coachapply"]'); await p.waitForTimeout(600);
let f = await forge();
const to = f.swaps['d3|Romanian deadlift'];
ok(!!to && to !== 'Romanian deadlift', 'applied: the RDL is swapped for ' + to);
ok(/Applied to Legs/.test(await view()) && /Swapped from Romanian deadlift/.test(await view()), 'the session shows it');
await p.click('[data-act="coachundo"]'); await p.waitForTimeout(500);
f = await forge();
ok(!f.swaps['d3|Romanian deadlift'], 'and undo puts the RDL back');

// ---- swapping reshades the map
await p.click('[data-act="swap"][data-o="Romanian deadlift"]'); await p.waitForTimeout(500);
await p.fill('#lib-q', 'hip thrust'); await p.waitForTimeout(200);
const pick = await p.$eval('#lib-res [data-act="libpick"]', e => e.dataset.n);
await p.click('#lib-res [data-act="libpick"]'); await p.waitForTimeout(300);
await p.click('[data-act="uselib"]'); await p.waitForTimeout(600);
const after = await listText();
ok(/Glutes 3/.test(after) && /Hamstrings 3/.test(after), `swapping to ${pick} moves 3 sets from hamstrings to glutes: ${after.slice(0, 80)}`);
await p.click('[data-act="mmview"][data-v="week"]'); await p.waitForTimeout(300);
ok(/sets this week/i.test(await p.$eval('.mm-card', e => e.innerText)), 'the Week switch shows the whole week');

// ---- the coach with AI: it gets the format and the injuries, and its answer shows
await enableAI(p);
const seen = await stubGemini(p, () => ({
  reply: 'Swap the leg extension for a leg press with your feet high. Same quads, less shear on the knee.',
  ops: [{ type: 'swap', day: 'd3', from: 'Leg extension', to: 'Leg press', gear: 'machine', why: 'Closed chain is kinder to knees that cave.' }],
}));
await p.fill('#co-q', 'the leg extension makes my knees ache');
await p.click('[data-act="coachask"]'); await p.waitForTimeout(1200);
t = await view();
ok(/less shear on the knee/.test(t) && /Leg extension → Leg press/.test(t), 'the AI answer and its swap show');
const prompt = seen.join(' ');
ok(/THE FORMAT IS FIXED/.test(prompt) && /first for 4 sets/.test(prompt), 'the prompt holds the 4 / 3 / 3 format');
ok(/hypermobile/.test(prompt) && /knees cave/.test(prompt) && /WEEKLY SETS BY MUSCLE/.test(prompt), 'and the injuries and the week');

ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('training: session coach, form and muscle map');
