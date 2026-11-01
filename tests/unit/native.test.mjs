/* The phone bridge must be invisible in a browser and faithful in the app. */
import { ok, done } from '../lib.mjs';
import * as native from '../../assets/js/core/native.js';
import { parseTime, reminderId, REMINDERS } from '../../assets/js/core/native-prefs.js';
import { isDarkColor } from '../../assets/js/core/ui.js';

// ---- in a browser (here: no window at all) everything is a quiet no-op
ok(native.isNative() === false, 'not native without the app');
ok(await native.send('info') === null, 'send returns null');
ok(await native.copyText('hi') === false, 'copy fails quietly with no clipboard');
let threw = false;
try{ native.haptic('light'); native.restStart(90, 'x'); native.restStop(); native.snapshot([]); native.theme('#fff', false); }catch{ threw = true; }
ok(!threw, 'fire-and-forget calls never throw outside the app');

// ---- inside the app: a fake bridge
const calls = [];
globalThis.window = {
  __NATIVE__: { platform: 'ios' },
  webkit: { messageHandlers: { native: {
    postMessage: async m => {
      calls.push(m);
      if (m.cmd === 'boom') throw new Error('nope');
      if (m.cmd === 'info') return { health: true };
      return true;
    },
  } } },
};
ok(native.isNative() === true, 'native when the bridge and marker exist');
ok((await native.info()).health === true, 'replies come back to the caller');
native.haptic('success');
native.restStart(75, 'Next set');
native.restStop();
await native.scheduleDaily({ id: 'a', hour: 8, minute: 5 });
await native.shareFile('x.json', '{}');
await new Promise(r => setTimeout(r, 5));
const by = c => calls.find(x => x.cmd === c);
ok(by('haptic').style === 'success', 'haptic carries its style');
ok(by('rest.start').seconds === 75 && by('rest.start').label === 'Next set', 'rest.start carries seconds and label');
ok(!!by('rest.stop'), 'rest.stop is sent');
ok(by('notify.daily').hour === 8 && by('notify.daily').minute === 5, 'daily reminder carries the time');
ok(by('share').name === 'x.json' && by('share').text === '{}', 'share carries name and text');
ok(await native.send('boom') === null, 'a failing command resolves to null instead of throwing');
delete globalThis.window;

// ---- reminders
ok(parseTime('08:30').hour === 8 && parseTime('08:30').minute === 30, 'parseTime reads HH:MM');
ok(parseTime('21:05').hour === 21 && parseTime('21:05').minute === 5, 'parseTime reads evening');
ok(parseTime('').hour === 8 && parseTime(undefined).minute === 0, 'parseTime falls back to 08:00');
ok(reminderId('meds') === 'alexhq-meds', 'reminder ids are namespaced');
ok(REMINDERS.map(r => r.id).join() === 'meds,food,mood', 'three reminders on offer');
ok(REMINDERS.every(r => !/!|urgent|must|overdue/i.test(r.body)), 'reminder wording is calm, no pressure words');

// ---- is the page dark? (drives the status bar text)
ok(isDarkColor('#15130E') === true,  'near-black is dark');
ok(isDarkColor('#EEE9DD') === false, 'paper is light');
ok(isDarkColor('#0B0C0A') === true,  'instrument black is dark');
ok(isDarkColor('#F3F3EF') === false, 'poster white is light');
ok(isDarkColor('#fff') === false && isDarkColor('#000') === true, 'three-digit hex works');
ok(isDarkColor('rgb(20, 20, 20)') === true && isDarkColor('rgb(240,240,240)') === false, 'rgb() works');
ok(isDarkColor('') === false && isDarkColor('banana') === false, 'junk is treated as light');

done('native bridge (unit)');
