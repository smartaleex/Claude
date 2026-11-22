/* A progress photo taken straight after a workout: tagged with the session automatically,
   changeable by hand, and allowed for in the comparison and the AI reading. */
import { launch, open, go, ok, done, forgeSeed, dayKey, enableAI, stubGemini, tapEl, PNG } from '../lib.mjs';

const now = Date.now();
const { b, p, errs, url } = await launch();
await open(p, url, {
  'alexhq:forge': forgeSeed({ comeback: { off: true }, photoAI: true, sessions: {
    s1: { id: 's1', day: 'd2', dayKey: dayKey(0), done: true, startedAt: now - 75 * 60e3, endedAt: now - 25 * 60e3,
          ex: [{ k: '0-0', o: 'Flat DB press', n: 'Flat DB press', p: 4, d: 4 }, { k: '0-1', o: 'Pec deck fly', n: 'Pec deck fly', p: 4, d: 4 },
               { k: '1-0', o: 'Cable lateral raise', n: 'Cable lateral raise', p: 3, d: 3 }, { k: '2-0', o: 'Rope pushdown', n: 'Rope pushdown', p: 3, d: 2 }] } } }),
});
await go(p, 'forge');
const text = () => p.$eval('#view', e => e.innerText);
const body = () => p.$eval('body', e => e.innerText);
await p.click('[data-act="tab"][data-v="photos"]'); await p.waitForTimeout(600);
const addPhoto = async name => {
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), tapEl(p, '[data-act="shoot"]')]);
  await fc.setFiles({ name, mimeType: 'image/png', buffer: PNG });
  await p.waitForTimeout(900);
};

await addPhoto('one.png');
ok(/marked after chest/i.test(await body()), 'a photo 25 minutes after Chest day is tagged with it: ' + ((await body()).match(/Added[^\n]*/) || [''])[0]);
ok(/After chest/i.test(await p.$eval('.ph-tag', e => e.textContent)), 'the thumbnail shows it');

await addPhoto('two.png');
// mark the older one rested by hand
const thumbs = await p.$$('[data-act="viewphoto"]');
await thumbs.at(-1).click(); await p.waitForTimeout(500);
ok(/Rested/.test(await p.$eval('.sheet.on', e => e.innerText)) && /After Chest \+ Triceps/.test(await p.$eval('.sheet.on', e => e.innerText)), 'the photo sheet offers rested or any day');
ok(await p.$('.sheet.on [data-act="tagset"].on') !== null, 'with the current tag picked');
await p.click('.sheet.on [data-act="tagset"][data-k="rest"]'); await p.waitForTimeout(800);
const t = await text();
ok(/after photo was taken after training chest/i.test(t) && /caution/.test(t), 'the before/after says the after photo is pumped');
ok((await p.$$('.ph-tag')).length === 1, 'only the post-workout photo carries a badge');

// the AI is told, with the rule
await enableAI(p);
const seen = await stubGemini(p, () => ({ headline: 'Similar.', comparability: 'Different conditions.', changes: [], answer: '', next: [] }));
await p.click('[data-act="tab"][data-v="photos"]'); await p.waitForTimeout(500);
await tapEl(p, '[data-act="readprogress"]'); await p.waitForTimeout(1500);
const prompt = seen.join(" ");
ok(/BEFORE, taken [^;]+, rested, no workout beforehand/.test(prompt), 'the before photo goes as rested');
ok(/AFTER, taken \w+, \d+ \w+, about 25 minutes after a Chest \+ Triceps session, so chest/.test(prompt), 'the after photo goes as 25 minutes after chest day');
ok(/do not count that extra fullness as progress/.test(prompt), 'with the rule to discount the pump');

ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('training: post-workout progress photos');
