/* The medication schedule: typed in plain words, checked, saved, shown on Day, and (in the iPhone app) turned
   into reminders only when asked for. */
import { launch, open, go, ok, done, enableAI, stubGemini } from '../lib.mjs';

const { b, ctx, p, errs, url } = await launch();
await open(p, url, { 'alexhq:day': { medTrack: true, anchors: undefined } });
await go(p, 'day', 700);
const text = () => p.$eval('#view', e => e.innerText);
const sheet = () => p.$eval('.sheet.on', e => e.innerText);
const meds = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('alexhq:meds')) || '{"list":[]}');

// ---- nothing set up yet: the old three-dose behaviour is untouched
ok(/Set up a medication schedule/.test(await text()), 'Day offers to set up a schedule');
ok(await p.$$eval('[data-act="dose"]', els => els.length) === 3, 'with no schedule there are still the three plain dose buttons');

await p.click('[data-act="medsched"]'); await p.waitForTimeout(500);
ok(/medication schedule/i.test(await sheet()) && /prescriber/i.test(await sheet()), 'the schedule opens, and says dose decisions are the prescriber\'s');
ok(/Reminders come from the iPhone app/.test(await sheet()), 'in a browser it explains reminders need the iPhone app');
ok(await p.$('[data-act="remind"]') === null, 'and offers no reminder switch that could not work');

// ---- type it in words; it is shown back for checking; nothing saved yet
await p.fill('#ms-q', 'Lamotrigine 100mg at 8am and 8pm with food; lithium 400mg at 9pm; ibuprofen 200mg as needed; vitamin d 1000iu');
await p.click('[data-act="read"]'); await p.waitForTimeout(700);
let s = await sheet();
ok(/read with simple rules/i.test(s) && /check it before adding/i.test(s), 'it says how it was read and asks you to check');
ok(/Lamotrigine 100mg/.test(s) && /8:00 am · 8:00 pm/.test(s) && /with food/i.test(s), 'Lamotrigine with two times and food');
ok(/Lithium 400mg/.test(s) && /9:00 pm/.test(s), 'lithium at 9pm');
ok(/Ibuprofen 200mg/.test(s) && /As needed/.test(s), 'ibuprofen as needed');
ok(/used 8:00 am/i.test(s), 'the medication with no time is flagged: "I used 8:00 am", change it if wrong');
ok((await meds()).list.length === 0, 'nothing is saved until you add it');
await p.click('[data-act="addread"]'); await p.waitForTimeout(500);
let m = await meds();
ok(m.list.length === 4 && m.remind === false && m.showNames === false, 'four saved; reminders and names default to OFF');
ok(/Lamotrigine 100mg/.test(await sheet()) && /As needed \(no reminders\)/.test(await sheet()), 'they are listed');

// ---- Day now shows the schedule
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(500);
s = await text();
ok(await p.$$eval('[data-act="dose"]', els => els.length) === 3, 'three times of day: 8am, 8pm, 9pm');
ok(/8am/.test(s) && /8pm/.test(s) && /9pm/.test(s), 'the buttons are the times: ' + (s.match(/\b\d+(am|pm)\b/g) || []).join(' '));
ok(/Lamotrigine 100mg, Vitamin d 1000iu \(with food\)|Lamotrigine 100mg, Vitamin D 1000iu \(with food\)/i.test(s), 'what is due at 8am is listed under the buttons');
ok(/0\/3/.test(s), 'the count is 0 of 3');
await p.click('[data-act="dose"][data-i="0"]'); await p.waitForTimeout(300);
ok(/1\/3/.test(await text()), 'tapping a time counts it (1 of 3)');

// ---- edit by hand
await p.click('[data-act="medsched"]'); await p.waitForTimeout(400);
await p.click('[data-act="edit"]'); await p.waitForTimeout(400);
await p.fill('#me-dose', '150mg');
await p.click('[data-act="day"][data-d="1"]'); await p.click('[data-act="day"][data-d="4"]'); await p.waitForTimeout(150);
await p.click('[data-act="addtime"]'); await p.waitForTimeout(150);
await p.click('[data-act="save"]'); await p.waitForTimeout(500);
m = await meds();
const lam = m.list[0];
ok(lam.dose === '150mg' && lam.days?.join() === '1,4' && lam.times.join() === '08:00,12:00,20:00', 'dose, weekdays and an extra time (a free one, not a duplicate) are saved: ' + JSON.stringify([lam.dose, lam.days, lam.times]));
ok(/Mon, Thu/.test(await sheet()), 'the list shows the weekdays');
await p.click('[data-act="edit"]'); await p.waitForTimeout(400);
await p.click('[data-act="del"]'); await p.waitForTimeout(500);
ok((await meds()).list.length === 3, 'a medication can be removed');
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);

// ---- the AI path structures; it is never allowed to advise
await enableAI(p);
const seen = await stubGemini(p, () => ({ meds: [{ name: 'quetiapine', dose: '25mg', times: ['21:30'], days: null, withFood: false, asNeeded: false, note: '' }, { name: 'magnesium', dose: '', times: [], asNeeded: false }], notes: ['Could not place "the usual"'] }));
await p.click('[data-act="medsched"]', { timeout: 3000 }).catch(() => {});
await p.evaluate(async () => { const d = await import('./assets/js/apps/day-meds.js'); d.openMedSchedule(); }); await p.waitForTimeout(500);
await p.fill('#ms-q', 'quetiapine 25mg at 9:30 at night, magnesium, and the usual');
await p.click('[data-act="read"]'); await p.waitForTimeout(1000);
s = await sheet();
ok(/read by gemini/i.test(s) && /Quetiapine 25mg/.test(s) && /9:30 pm/.test(s), 'Gemini\'s reading is shown for checking');
ok(/No time given, so there will be no reminder/.test(s), 'a medication with no time is flagged, not guessed');
ok(/the usual/.test(s), 'what it could not place is said out loud');
ok(/Do not add, suggest, change or correct/.test(seen.join(' ')), 'the prompt tells Gemini to structure only');
ok(!/Magnesium[\s\S]{0,40}8:00 am/.test(s), 'Gemini\'s "no time" is not turned into a made-up one');
await p.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await p.waitForTimeout(300);

// ---- backup holds it
const exported = await p.evaluate(async () => (await import('./assets/js/core/store.js')).exportAll());
ok(exported.meds?.list.length === 3 && exported.day, 'the backup holds the schedule and the Day data');
ok(errs.length === 0, 'no script errors in the browser: ' + (errs[0] || ''));

// ---- in the iPhone app: reminders are off until asked for, then scheduled on the phone
const q = await ctx.newPage();
const qerrs = []; q.on('pageerror', e => qerrs.push(e.message));
await q.addInitScript(() => {
  window.__calls = [];
  window.__NATIVE__ = { platform: 'ios', version: 'test' };
  const answers = { info: { platform: 'ios', health: true, lock: false, biometry: 'Face ID', notifications: true }, 'notify.permission': true, 'notify.sync': true };
  window.webkit = { messageHandlers: { native: { postMessage: async m => { window.__calls.push(m); return answers[m.cmd] ?? null; } } } };
});
await open(q, url, { 'alexhq:day': { medTrack: true }, 'alexhq:meds': { list: [
  { id: 'a', name: 'Lamotrigine', dose: '100mg', times: ['08:00', '20:00'], days: null, note: '', withFood: true, asNeeded: false },
  { id: 'b', name: 'Lithium', dose: '400mg', times: ['21:00'], days: null, note: '', withFood: false, asNeeded: false },
  { id: 'c', name: 'Vitamin D', dose: '1000iu', times: ['08:00'], days: [1, 4], note: '', withFood: false, asNeeded: false },
], remind: false, showNames: false } });
await q.waitForTimeout(500);
const calls = () => q.evaluate(() => window.__calls.slice());
const syncs = async () => (await calls()).filter(c => c.cmd === 'notify.sync');
const last = async () => (await syncs()).at(-1);

let sc = await last();
ok(sc && sc.prefix === 'alexhq-med-' && sc.items.length === 0, 'at start, with reminders off, the phone is told to hold none');
await go(q, 'day', 600);
await q.click('[data-act="medsched"]'); await q.waitForTimeout(500);
ok(await q.$('[data-act="remind"]') !== null, 'the app offers the reminder switch');
await q.click('[data-act="remind"]'); await q.waitForTimeout(500);
const all = await calls();
ok(all.some(c => c.cmd === 'notify.permission'), 'turning it on asks for notification permission');
sc = await last();
ok(sc.items.length === 4, 'one reminder per time and weekday pattern: ' + sc.items.map(i => i.id).join(', '));
ok(sc.items.every(i => i.body === 'Time for your meds.' && i.title === 'Meds' && i.route === 'day'), 'plain wording, no medication name on the lock screen');
ok(sc.items.some(i => i.hour === 8 && i.minute === 0 && !i.weekdays) && sc.items.some(i => i.weekdays?.join() === '2,5'), 'times are right and weekday reminders use the phone\'s numbering');
ok(JSON.parse(await q.evaluate(() => localStorage.getItem('alexhq:meds'))).remind === true, 'the choice is saved');
await q.click('[data-act="names"]'); await q.waitForTimeout(400);
sc = await last();
ok(sc.items.some(i => /Lamotrigine 100mg/.test(i.body) && /with food/.test(i.body)), 'names are sent only after that is switched on');
await q.click('[data-act="remind"]'); await q.waitForTimeout(400);
sc = await last();
ok(sc.items.length === 0, 'turning reminders off clears them from the phone');
await q.click('[data-act="remind"]'); await q.waitForTimeout(400);
await q.click('[data-act="edit"]'); await q.waitForTimeout(400);
await q.fill('#me-name', 'Lamotrigine XR'); await q.click('[data-act="save"]'); await q.waitForTimeout(500);
sc = await last();
ok(sc.items.length === 4, 'editing a medication re-syncs the reminders');
// ---- the simple 8am Meds reminder gives way to the schedule, so a dose is never reminded twice
await q.evaluate(() => document.querySelector('.sheet.on [data-act="close"]')?.click()); await q.waitForTimeout(300);
await go(q, 'home', 500);
await q.click('[data-act="settings"]'); await q.waitForTimeout(800);
const nb = await q.$eval('#native-block', e => e.innerText);
ok(/follow your schedule/i.test(nb) && !/\bMeds\b[\s\S]{0,20}(On|Off)/.test(nb.replace(/Medication reminders[^\n]*/g, '')), 'Settings points to the schedule and drops the simple Meds reminder: ' + nb.replace(/\s+/g, ' ').slice(0, 160));
ok(qerrs.length === 0, 'no script errors in the app: ' + (qerrs[0] || ''));

await b.close();
done('medication schedule and reminders');
