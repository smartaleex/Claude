/* The iPhone app, as far as the page can tell. The Swift side is replaced by a
   fake that records every message and answers like the phone would; this
   checks the page asks for the right things at the right moments, and that
   nothing at all happens in a plain browser. */
import { launch, open, go, ok, done } from '../lib.mjs';

const { b, ctx, p, errs, url } = await launch();

await p.addInitScript(() => {
  window.__calls = [];
  window.__NATIVE__ = { platform: 'ios', version: 'test' };
  const answers = {
    info: { platform:'ios', health:true, liveActivities:true, lock:false, biometry:'Face ID', notifications:true },
    'notify.permission': true, 'health.connect': true, 'health.sleep': { hours: 7.4 },
    'health.weight': { kg: 79.4 }, share: true, 'lock.set': true, backup: true, copy: true,
  };
  window.webkit = { messageHandlers: { native: { postMessage: async m => { window.__calls.push(m); return answers[m.cmd] ?? null; } } } };
});
await open(p, url, {});
await p.waitForTimeout(500);

const calls = () => p.evaluate(() => window.__calls.slice());
const since = async n => (await calls()).slice(n);
const count = async () => (await calls()).length;
const first = (list, cmd) => list.find(c => c.cmd === cmd);

// ---- boot: the page tells the phone its colour, and the widget its numbers
let all = await calls();
const th = first(all, 'theme');
ok(!!th && /^#[0-9a-f]{6}$/i.test(th.bg), 'tells the phone the page colour: ' + th?.bg);
ok(th?.dark === false, 'Paper is a light page');
const snap = first(all, 'snapshot');
ok(snap?.tiles?.map(t => t.label).join() === 'Eaten,Gym,Done,Zyn', 'home sends the four widget numbers');
ok(snap?.tiles?.every(t => typeof t.value === 'string' && typeof t.sub === 'string'), 'each tile has a value and a caption');

// ---- haptics
let n = await count();
await p.evaluate(async () => { const m = await import('./assets/js/core/ui.js'); m.haptic(6); m.haptic(12); m.haptic(20); });
await p.waitForTimeout(100);
let d = (await since(n)).filter(c => c.cmd === 'haptic').map(c => c.style).join();
ok(d === 'selection,light,medium', 'haptic strengths map to real taps: ' + d);

// ---- rest timer: a notification + lock-screen countdown while the phone is locked
n = await count();
await p.evaluate(async () => { const t = await import('./assets/js/core/timer.js'); t.startRest(90); });
await p.waitForTimeout(150);
let rs = first(await since(n), 'rest.start');
ok(!!rs && rs.seconds >= 88 && rs.seconds <= 90, 'starting a rest tells the phone how long: ' + rs?.seconds);
n = await count();
await p.evaluate(async () => { const t = await import('./assets/js/core/timer.js'); t.adjustRest(30); });
await p.waitForTimeout(100);
rs = first(await since(n), 'rest.start');
ok(!!rs && rs.seconds >= 117, 'adjusting the rest re-sends the new time: ' + rs?.seconds);
n = await count();
await p.evaluate(async () => { const t = await import('./assets/js/core/timer.js'); t.clearRest(); });
await p.waitForTimeout(100);
ok(!!first(await since(n), 'rest.stop'), 'clearing the rest stops the phone countdown');

// ---- Settings shows the iPhone block, and each control does the right thing
await go(p, 'home', 500);
await p.click('[data-act="settings"]'); await p.waitForTimeout(700);
ok(await p.$('#native-block') !== null, 'Settings has the iPhone block');
const txt = await p.$eval('#native-block', e => e.innerText);
ok(/Face ID lock/.test(txt) && /Reminders/.test(txt) && /Apple Health/.test(txt), 'it lists lock, reminders and Health');
ok(/Meds/.test(txt) && /Eat something/.test(txt) && /Evening check-in/.test(txt), 'three reminders');
ok(/Files app|Files/.test(txt), 'it explains the daily backup to Files');
ok(/Connect Apple Health/.test(txt), 'Health starts unconnected');

n = await count();
await p.click('#native-block [data-act="n-rem"][data-id="meds"]'); await p.waitForTimeout(400);
let c = await since(n);
ok(!!first(c, 'notify.permission'), 'turning a reminder on asks for notification permission');
const dl = first(c, 'notify.daily');
ok(dl?.id === 'alexhq-meds' && dl.hour === 8 && dl.minute === 0 && dl.route === 'day', 'schedules meds at 08:00 and opens Day when tapped');
ok(!/!/.test(dl?.body || '') && dl?.body.length > 5, 'the message is plain: ' + dl?.body);
ok(/On/.test(await p.$eval('#native-block [data-act="n-rem"][data-id="meds"]', e => e.innerText)), 'the chip now reads On');

n = await count();
await p.fill('#native-block input[type=time][data-id="meds"]', '07:15'); await p.waitForTimeout(300);
const re = first(await since(n), 'notify.daily');
ok(re?.hour === 7 && re.minute === 15, 'changing the time reschedules it: ' + re?.hour + ':' + re?.minute);

n = await count();
await p.click('#native-block [data-act="n-rem"][data-id="meds"]'); await p.waitForTimeout(300);
const cc = first(await since(n), 'notify.cancel');
ok(cc?.ids?.join() === 'alexhq-meds', 'turning it off cancels it');

n = await count();
await p.click('#native-block [data-act="n-lock"]'); await p.waitForTimeout(300);
const lk = first(await since(n), 'lock.set');
ok(lk?.enabled === true, 'the lock switch asks the phone to turn the lock on');

n = await count();
await p.click('#native-block [data-act="n-health"]'); await p.waitForTimeout(400);
ok(!!first(await since(n), 'health.connect'), 'Connect asks the phone for Health access');
const txt2 = await p.$eval('#native-block', e => e.innerText);
ok(/Save gym sessions to Health/.test(txt2) && !/Connect Apple Health/.test(txt2), 'after connecting it offers the workouts switch');
await p.click('#native-block [data-act="n-workouts"]'); await p.waitForTimeout(250);
const prefs = JSON.parse(await p.evaluate(() => localStorage.getItem('alexhq:native')));
ok(prefs.health === true && prefs.workouts === true, 'choices are saved');
ok(prefs.reminders.meds.on === false && prefs.reminders.meds.time === '07:15', 'reminder choices are saved');
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);

// ---- Health values are offered, never filled in silently
await go(p, 'day', 500);
await p.click('[data-act="sleep"]'); await p.waitForTimeout(700);
const chip = await p.$('.sheet.on .chip:not([data-act])');
ok(!!chip && /Use Apple Health: 7\.4 h/.test(await chip.innerText()), 'sleep sheet offers last night from Health');
const before = await p.$eval('#sl-h', e => e.value);
ok(before !== '7.4', 'the field is not changed until tapped (' + before + ')');
await chip.click();
ok(await p.$eval('#sl-h', e => e.value) === '7.4', 'tapping the chip fills the hours');
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);

await p.evaluate(async () => {
  document.body.insertAdjacentHTML('beforeend', '<input id="w-kg" type="number">');
  const m = await import('./assets/js/core/native-health.js'); await m.offerFromHealth('weight', 'w-kg');
});
ok(/Use Apple Health: 79\.4 kg/.test(await p.$eval('#w-kg + .chip', e => e.innerText)), 'weight sheet offers the Health weight');

// ---- finished sessions go to Health only when switched on, and only if plausible
n = await count();
await p.evaluate(async () => { const m = await import('./assets/js/core/native-health.js'); const now = Date.now(); await m.saveSessionToHealth(now - 50 * 60000, now); });
let w = first(await since(n), 'health.workout');
ok(!!w && w.end - w.start === 50 * 60000, 'a 50-minute session is saved to Health');
n = await count();
await p.evaluate(async () => { const m = await import('./assets/js/core/native-health.js'); const now = Date.now(); await m.saveSessionToHealth(now - 2 * 60000, now); await m.saveSessionToHealth(now - 600 * 60000, now); });
ok(!first(await since(n), 'health.workout'), 'a 2-minute or 10-hour "session" is not saved');
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('alexhq:native')); s.workouts = false; localStorage.setItem('alexhq:native', JSON.stringify(s)); });

// ---- backup: share sheet, plus one quiet copy a day
n = await count();
await p.evaluate(async () => { localStorage.removeItem('alexhq:autoBackupAt'); const m = await import('./assets/js/shell/backup.js'); window.__r1 = await m.autoBackup(); window.__r2 = await m.autoBackup(); });
await p.waitForTimeout(200);
c = await since(n);
const bk = c.filter(x => x.cmd === 'backup').map(x => x.name);
ok(bk.length === 2 && bk[0] === 'alex-hq-backup-latest.json' && /^alex-hq-backup-(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\.json$/.test(bk[1]), 'daily backup writes latest + a weekday copy: ' + bk);
ok(await p.evaluate(() => window.__r1 === true && window.__r2 === false), 'and only once a day');
ok(!!JSON.parse(c.find(x => x.cmd === 'backup').text), 'the backup is valid JSON');
n = await count();
await p.evaluate(async () => { const m = await import('./assets/js/shell/backup.js'); await m.doExport(); });
const sh = first(await since(n), 'share');
ok(/^alex-hq-backup-\d{4}-\d{2}-\d{2}\.json$/.test(sh?.name || ''), 'Download a backup opens the share sheet: ' + sh?.name);

// ---- copy
n = await count();
ok(await p.evaluate(async () => (await import('./assets/js/core/ui.js')).copyText('hello')) === true, 'copy succeeds');
ok(first(await since(n), 'copy')?.text === 'hello', 'copy goes through the phone clipboard');

// ---- a dark skin tells the phone to light the status bar
n = await count();
await p.evaluate(async () => { const m = await import('./assets/js/shell/look.js'); m.setSkin('instrument'); });
await p.waitForTimeout(400);
const t2 = (await since(n)).filter(x => x.cmd === 'theme').pop();
ok(t2?.dark === true, 'Instrument reports a dark page: ' + t2?.bg);

ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));

// ---- in a plain browser: no iPhone block, no messages, no errors
const q = await ctx.newPage();
const qerrs = []; q.on('pageerror', e => qerrs.push(e.message));
await open(q, url, {});
await q.click('[data-act="settings"]'); await q.waitForTimeout(500);
ok(await q.$('#native-block') === null, 'a browser has no iPhone block');
ok(!/Face ID|Apple Health/.test(await q.$eval('.sheet.on', e => e.innerText)), 'and no mention of it');
ok(await q.evaluate(async () => (await import('./assets/js/core/native.js')).isNative()) === false, 'isNative is false in a browser');
ok(qerrs.length === 0, 'no script errors in a browser ' + (qerrs[0] || ''));

await b.close();
done('native bridge (browser)');
