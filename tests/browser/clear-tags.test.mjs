/* Logging a Zyn: the reason is picked on the page first, not hunted for afterwards. */
import { launch, open, go, ok, done } from '../lib.mjs';

const { b, p, errs, url } = await launch();
await open(p, url, {});
await go(p, 'clear', 700);

const tags = () => p.$$eval('[data-act="why"]', els => els.map(e => e.innerText.trim()));
const logs = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('alexhq:clear')) || '{"logs":[]}').logs;
const text = () => p.$eval('#view', e => e.innerText);

// ---- the reasons are on the page before anything is logged
const t0 = await tags();
ok(t0.length >= 8, 'the reasons are visible up front: ' + t0.join(', '));
ok(/What prompted it/i.test(await text()), 'with a heading that says what they are for');
ok(await p.$('.sheet.on') === null, 'and no sheet had to be opened to see them');

// ---- pick a reason, then log: one flow, one tag
await p.click('[data-act="why"][data-t="stress"]'); await p.waitForTimeout(250);
ok(await p.$eval('[data-act="why"][data-t="stress"]', e => e.classList.contains('on')), 'the chosen reason lights up');
ok(/Log one\s*·\s*stress/i.test(await text()), 'and the log buttons say what they will be logged as');
await p.click('[data-act="log"][data-mg="9"]'); await p.waitForTimeout(350);
let l = await logs();
ok(l.length === 1 && l[0].mg === 9 && l[0].tag === 'stress', 'the pouch is saved with its reason: ' + JSON.stringify(l[0]));
ok(/stress/.test(await p.$eval('.rowcard', e => e.innerText)), 'and the log row shows it');
ok(!(await p.$eval('[data-act="why"][data-t="stress"]', e => e.classList.contains('on'))), 'the reason clears, so it cannot stick to the wrong pouch');

// ---- no reason chosen: still logs, untagged, and can be tagged later
await p.click('[data-act="log"][data-mg="6"]'); await p.waitForTimeout(300);
l = await logs();
ok(l.length === 2 && l[1].tag === null, 'logging without a reason still works');
ok(await p.$('[data-act="tag"]') !== null, 'and the after-the-fact Tag button is still there');

// ---- tapping the same reason twice un-picks it
await p.click('[data-act="why"][data-t="coffee"]'); await p.waitForTimeout(150);
await p.click('[data-act="why"][data-t="coffee"]'); await p.waitForTimeout(150);
ok(!(await p.$eval('[data-act="why"][data-t="coffee"]', e => e.classList.contains('on'))), 'tapping a reason again clears it');

// ---- the "Other…" strength takes the reason too
await p.click('[data-act="why"][data-t="boredom"]'); await p.waitForTimeout(150);
await p.click('[data-act="custom"]'); await p.waitForTimeout(400);
await p.fill('#c-mg', '14');
await p.click('.sheet.on [data-act="save"]'); await p.waitForTimeout(400);
l = await logs();
ok(l.length === 3 && l[2].mg === 14 && l[2].tag === 'boredom', 'a custom strength is tagged too: ' + JSON.stringify(l[2]));

ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('zyn: reason picked while logging');
