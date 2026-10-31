/* Photos, the before/after slider, the consent gate, AI progress read, goal
   reference + benchmark, and applying focus boosts to the program. */
import { launch, open, go, ok, done, forgeSeed, dayKey, enableAI, stubGemini, tapEl, PNG } from '../lib.mjs';

const { b, p, errs, url } = await launch();
await open(p, url, { 'alexhq:forge': forgeSeed({ comeback:{ off:true } }), 'alexhq:fuel': { targets:{ kcal:2800 }, days:{}, weights:{ [dayKey(20)]:72, [dayKey(1)]:73 } } });
await go(p, 'forge');
const text = () => p.$eval('#view', e => e.innerText);
const sheet = () => p.$eval('.sheet.on', e => e.innerText);
const tab = async v => { await p.click(`[data-act="tab"][data-v="${v}"]`); await p.waitForTimeout(600); };
const addPhoto = async (btn, name) => {
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), tapEl(p, `[data-act="${btn}"]`)]);
  await fc.setFiles({ name, mimeType:'image/png', buffer:PNG });
  await p.waitForTimeout(900);
};

// ---- empty state
await tab('photos');
let t = await text();
ok(/No photos yet/i.test(t) && /Same pose, same light/i.test(t), 'photos: empty state explains how to shoot');
ok(/Add a goal photo|Take a progress photo first/i.test(t), 'photos: goal section asks for a progress photo first');

// ---- adding photos
await addPhoto('pick', 'one.png');
t = await text();
ok(/all 1\b/i.test(t), 'photos: first photo added (' + (t.match(/all \d+/i) || [''])[0] + ')');
ok(!(await p.$('.cmp')), 'photos: no slider until there are two');
await addPhoto('pick', 'two.png');
t = await text();
ok(/all 2\b/i.test(t) && !!(await p.$('.cmp')), 'photos: two photos give the before/after slider');
ok(/Then and now/i.test(t) && /day(s)? apart/.test(t), 'photos: says how many days apart');
await p.evaluate(() => { const r = document.querySelector('.cmp-range'); r.value = 80; r.dispatchEvent(new Event('input', { bubbles:true })); });
ok((await p.evaluate(() => document.getElementById('cmp').style.getPropertyValue('--pos'))) === '80%', 'photos: the slider moves the divider');

// ---- editing a photo: change its date, then delete
await tapEl(p, '[data-act="viewphoto"]'); await p.waitForTimeout(500);
ok(/Date taken/i.test(await sheet()) && /Delete this photo/i.test(await sheet()), 'photo sheet: date and delete');
await p.fill('#ph-date', '2099-01-01'); await p.click('.sheet.on [data-act="savedate"]'); await p.waitForTimeout(300);
ok(/Pick a date up to today/i.test(await p.$eval('body', e => e.innerText)), 'photo sheet: a future date is refused');
await p.fill('#ph-date', dayKey(12)); await p.click('.sheet.on [data-act="savedate"]'); await p.waitForTimeout(800);
ok(/12 days apart|1[0-2] days apart/.test(await text()), 'photo sheet: the new date changes the gap (' + ((await text()).match(/\d+ days? apart/) || [''])[0] + ')');
await tapEl(p, '[data-act="viewphoto"]'); await p.waitForTimeout(500);
await p.click('.sheet.on [data-act="rm"]'); await p.waitForTimeout(900);
ok(/all 1\b/i.test(await text()) && !(await p.$('.cmp')), 'photo sheet: delete removes it and the slider goes');
await addPhoto('pick', 'three.png');
ok(/all 2\b/i.test(await text()), 'photos: back to two');

// ---- no key: AI sections say so, nothing is sent
t = await text();
ok(/Needs a free Gemini key/i.test(t), 'progress read: says a key is needed when there is none');

// ---- with a key: consent gate, then the reading
await enableAI(p);
const progress = { headline:'Shoulders look a touch wider.', comparability:'Similar light.', changes:[{ area:'Shoulders', direction:'up', note:'Slightly broader.' }, { area:'Waist', direction:'same', note:'Unchanged.' }], answer:'Yes, a little.', next:['Keep the lateral raises.'] };
const benchmark = { summary:'Closer than it feels.', areas:[{ muscle:'Side delts', gap:'large', note:'Width is the gap.' }, { muscle:'Lats', gap:'moderate', note:'Some way to go.' }], frame:'Clavicle width is fixed.', realism:'Realistic over 12 months.', adjustments:[{ muscle:'Side delts', extraSets:2, why:'Width.' }, { muscle:'Front delts', extraSets:2, why:'Fuller front.' }, { muscle:'Triceps', extraSets:3, why:'Arms.' }] };
let mode = 'progress';
const seen = await stubGemini(p, prompt => mode === 'progress' ? progress : benchmark);
await tab('photos');
await p.fill('#ask-q', 'Are my shoulders getting wider?');
await tapEl(p, '[data-act="readprogress"]'); await p.waitForTimeout(500);
ok(/Send photos to Gemini\?/i.test(await sheet()) && /leave this device/i.test(await sheet()), 'consent: asked before any photo leaves the phone');
ok(seen.length === 0, 'consent: nothing has been sent yet');
await p.click('.sheet.on [data-act="no"]'); await p.waitForTimeout(300);
ok(seen.length === 0, 'consent: "Not now" sends nothing');
await tapEl(p, '[data-act="readprogress"]'); await p.waitForTimeout(500);
await p.click('.sheet.on [data-act="yes"]'); await p.waitForTimeout(1800);
t = await text();
ok(seen.length === 1, 'progress read: exactly one request');
ok(/inlineData|inline_data/.test(seen[0]), 'progress read: the photos went with it');
ok(/Are my shoulders getting wider\?/.test(seen[0]), 'progress read: your question went with it');
ok(/Shoulders look a touch wider/.test(t) && /Slightly broader/.test(t) && /Keep the lateral raises/.test(t), 'progress read: headline, changes and next step shown');
ok(/You asked: Are my shoulders/.test(t) && /Yes, a little/.test(t), 'progress read: shows your question and the answer');
ok((await p.evaluate(() => JSON.parse(localStorage.getItem('alexhq:forge')).photoAI)) === true, 'consent: remembered');
await tapEl(p, '[data-act="readprogress"]'); await p.waitForTimeout(1500);
ok(seen.length === 2 && !(await p.$('.sheet.on')), 'consent: a second read does not ask again');
await tapEl(p, '[data-act="photoaioff"]'); await p.waitForTimeout(400);
ok((await p.evaluate(() => JSON.parse(localStorage.getItem('alexhq:forge')).photoAI)) === false, 'consent: can be switched off again');

// ---- a reply in the wrong shape is survived
mode = 'bad';
await stubGemini(p, () => '{"nonsense": true}');
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('alexhq:forge')); });
await tapEl(p, '[data-act="readprogress"]'); await p.waitForTimeout(500);
if (await p.$('.sheet.on [data-act="yes"]')){ await p.click('.sheet.on [data-act="yes"]'); await p.waitForTimeout(1500); }
ok(/could not read|shape|Try again/i.test(await p.$eval('body', e => e.innerText)) && !(await p.$('[data-act="readprogress"][disabled]')), 'progress read: an unreadable reply says so and the button recovers');

// ---- goal reference + benchmark
mode = 'benchmark';
await p.unroute('**generativelanguage.googleapis.com/**');
const seen2 = await stubGemini(p, () => benchmark);
await addPhoto('pickgoal', 'goal.png');
t = await text();
ok(/Benchmark · send 2 photos/i.test(t), 'goal: with a reference photo, benchmark offers to send 2 photos');
ok(!!(await p.$('[data-act="rmgoal"]')), 'goal: reference photo shown with a remove control');
await tapEl(p, '[data-act="benchmark"]'); await p.waitForTimeout(500);
if (await p.$('.sheet.on [data-act="yes"]')){ await p.click('.sheet.on [data-act="yes"]'); }
await p.waitForTimeout(1800);
t = await text();
ok(seen2.length === 1 && /GOAL reference/.test(seen2[0]), 'benchmark: one request, labelled with the goal reference');
ok(/Closer than it feels/.test(t) && /Width is the gap/.test(t) && /furthest/i.test(t), 'benchmark: summary, areas and gap labels');
ok(/What training can and cannot change/i.test(t) && /Clavicle width is fixed/.test(t) && /How realistic/i.test(t), 'benchmark: frame and realism');
ok(/Suggested program changes/i.test(t) && /Side delts[\s\S]{0,40}\+2\/wk/.test(t), 'benchmark: side delts +2 a week suggested');
ok(/Triceps[\s\S]{0,40}\+1\/wk/.test(t) && !/Triceps[\s\S]{0,40}\+3\/wk/.test(t), 'benchmark: triceps capped to +1 (elbow tendon)');
ok(/Not adding front delts/i.test(t), 'benchmark: front delts refused, and says so');
// apply
await tapEl(p, '[data-act="applyfocus"]'); await p.waitForTimeout(500);
const focus = await p.evaluate(() => JSON.parse(localStorage.getItem('alexhq:forge')).focus);
ok(focus['Side delts'] === 2 && focus['Triceps'] === 1 && !('Front delts' in focus), 'apply: focus saved, clamped (' + JSON.stringify(focus) + ')');
ok(/Applied to your program/i.test(await text()), 'apply: button says it is applied');
await tab('goal');
t = await text();
ok(/Focus boosts/i.test(t) && /\+3 sets\/wk/.test(t) && /Side delts/.test(t), 'goal: focus boosts card shows +3 sets/wk');
// the boost lands on real exercises in a live session
await tab('plan');
await p.click('[data-act="start"][data-d="d4"]'); await p.waitForTimeout(600);
ok(/\+\d focus/i.test(await text()), 'session: exercises carry a "+N focus" badge');
await tapEl(p, '[data-act="abandon"]'); await p.waitForTimeout(400);
// remove one, then clear all
await tab('goal');
await tapEl(p, '[data-act="rmfocus"][data-m="Triceps"]'); await p.waitForTimeout(400);
{ const card = await p.$eval('#view', e => { const t=[...e.querySelectorAll('.card')].find(c => /Focus boosts/.test(c.innerText)); return t ? t.innerText : ''; }); ok(card && !/Triceps/.test(card) && /Side delts/.test(card), 'goal: a single boost can be removed (the card keeps the others)'); }
await tapEl(p, '[data-act="clearfocus"]'); await p.waitForTimeout(400);
ok(!/Focus boosts/.test(await text()), 'goal: clearing removes the card');
// remove the goal photo
await tab('photos');
await tapEl(p, '[data-act="rmgoal"]'); await p.waitForTimeout(900);
ok(!(await p.$('[data-act="rmgoal"]')), 'goal: reference photo removed');
ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('photos and benchmark');
