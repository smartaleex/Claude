/* A medication schedule that can hold a complicated day, read from plain English, never inventing anything. */
import { ok, done } from '../lib.mjs';
import { parseMedText, normaliseMed, dosesFor, slotsFor, slotText, reminderItems, fmtTime, fmtShort, medPrompt } from '../../assets/js/core/meds.js';

const read = text => { const r = parseMedText(text); return { meds: r.meds.map(m => normaliseMed(m) && { ...normaliseMed(m), assumed: m.assumed }), notes: r.notes }; };
const one = text => read(text).meds[0];

// ---- one medication, said different ways
let m = one('Lamotrigine 100mg at 8am and 8pm with food');
ok(m.name === 'Lamotrigine' && m.dose === '100mg' && m.times.join() === '08:00,20:00' && m.withFood, 'name, dose, two clock times, with food: ' + JSON.stringify(m));
m = one('lithium 400 mg every night');
ok(m.name === 'Lithium' && m.dose === '400mg' && m.times.join() === '21:30', '"every night": ' + m.times);
m = one('sertraline 50mg in the morning');
ok(m.times.join() === '08:00' && !m.assumed, '"in the morning" is 8:00 and not marked as a guess');
m = one('quetiapine 25mg at 9:30pm');
ok(m.times.join() === '21:30', '9:30pm -> 21:30');
m = one('magnesium 300mg twice a day');
ok(m.times.join() === '08:00,20:00', '"twice a day"');
m = one('vitamin c 500mg three times a day');
ok(m.times.length === 3, '"three times a day"');
m = one('aspirin 100mg at 7:15 and 19:15');
ok(m.times.join() === '07:15,19:15', 'mixed 12 and 24 hour: ' + m.times);
m = one('thyroxine 75mcg on waking, empty stomach');
ok(m.dose === '75mcg' && m.times.join() === '08:00' && /empty stomach/i.test(m.note), 'waking + a note: ' + JSON.stringify([m.times, m.note]));
m = one('vitamin d 1000iu mondays and thursdays at 8am');
ok(m.days?.join() === '1,4' && m.times.join() === '08:00', 'weekdays: ' + m.days);
m = one('b12 1000mcg weekdays morning');
ok(m.days?.join() === '1,2,3,4,5', '"weekdays"');
m = one('ibuprofen 200mg as needed');
ok(m.asNeeded && m.times.length === 0, 'as needed means no times and no reminders');
m = one('ibuprofen when needed');
ok(m.name === 'Ibuprofen' && m.asNeeded, 'as needed with no dose');
m = one('lamotrigine 100mg');
ok(m.assumed === true && m.times.join() === '08:00', 'no time said: 8:00 filled in AND flagged so it can be checked');
m = one('lithium 400mg every other day at 9pm');
ok(/every day|weekdays by hand|Not every day/i.test(m.note), 'every-other-day is not supported, and says so instead of silently getting it wrong: ' + m.note);

// ---- several at once
let r = read('Lamotrigine 100mg at 8am and 8pm with food; lithium 400mg at 9pm; ibuprofen 200mg as needed');
ok(r.meds.length === 3 && r.meds[1].name === 'Lithium' && r.meds[1].times.join() === '21:00' && r.meds[2].asNeeded, 'three on separate lines/semicolons');
r = read('sertraline 50mg morning, quetiapine 25mg night');
ok(r.meds.length === 2 && r.meds[0].name === 'Sertraline' && r.meds[0].times.join() === '08:00' && r.meds[1].name === 'Quetiapine' && r.meds[1].times.join() === '21:30', 'two in one sentence: ' + JSON.stringify(r.meds.map(x => [x.name, x.times])));
r = read('lamotrigine 100mg at 8am and 8pm with food and sertraline 50mg in the morning');
ok(r.meds.length === 2 && r.meds[0].times.join() === '08:00,20:00' && r.meds[1].name === 'Sertraline', 'joined with "and": ' + JSON.stringify(r.meds.map(x => [x.name, x.times])));
r = read('');
ok(r.meds.length === 0, 'nothing in, nothing out');
r = read('at 8am');
ok(r.meds.length === 0 && r.notes.length === 1, 'a time with no medication is a note, not a medication');

// ---- validating
ok(normaliseMed({ name: '' }) === null && normaliseMed(null) === null, 'no name is not a medication');
const n = normaliseMed({ name: 'x'.repeat(200), times: ['25:00', '8am', '08:00', '08:00', '20:00'], days: [1, 1, 9, -1] });
ok(n.name.length === 60 && n.times.join() === '08:00,20:00' && n.days?.join() === '1', 'long names are cut, bad and duplicate times dropped, weekdays cleaned');
ok(normaliseMed({ name: 'a', days: [0, 1, 2, 3, 4, 5, 6] }).days === null, 'all seven days means every day');
ok(normaliseMed({ name: 'a', asNeeded: true, times: ['08:00'] }).times.length === 0, 'as needed carries no times');
ok(normaliseMed({ name: 'a', times: Array.from({ length: 12 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`) }).times.length === 8, 'at most eight times a day');

// ---- the day as slots
const list = [
  normaliseMed({ id: 'a', name: 'Lamotrigine', dose: '100mg', times: ['08:00', '20:00'], withFood: true }),
  normaliseMed({ id: 'b', name: 'Sertraline', dose: '50mg', times: ['08:00'] }),
  normaliseMed({ id: 'c', name: 'Vitamin D', dose: '1000iu', times: ['08:00'], days: [1, 4] }),
  normaliseMed({ id: 'd', name: 'Ibuprofen', asNeeded: true }),
];
const monday = '2026-11-02', tuesday = '2026-11-03';      // 2026-11-02 is a Monday
ok(dosesFor(list, monday).length === 4 && dosesFor(list, tuesday).length === 3, 'a weekday-only medication appears only on its days');
let slots = slotsFor(list, monday);
ok(slots.length === 2 && slots[0].time === '08:00' && slots[0].doses.length === 3, 'three medications at 8am are one slot');
ok(slotText(slots[0]) === 'Lamotrigine 100mg, Sertraline 50mg, Vitamin D 1000iu (with food)', 'and read out in one line: ' + slotText(slots[0]));
ok(slotsFor(list, tuesday)[0].doses.length === 2, 'Tuesday: no vitamin D');
ok(slotsFor([], monday).length === 0, 'no schedule, no slots');
ok(!dosesFor(list, monday).some(d => d.name === 'Ibuprofen'), 'as-needed is never scheduled');
ok(fmtTime('20:00') === '8:00 pm' && fmtTime('00:30') === '12:30 am' && fmtTime('12:00') === '12:00 pm', '12-hour clock edges');
ok(fmtShort('20:00') === '8pm' && fmtShort('09:30') === '9:30am', 'compact times for buttons');

// ---- what goes to the phone
let items = reminderItems(list);
ok(items.length === 3, 'one reminder per time and weekday pattern, not per medication: ' + items.map(i => i.id).join(', '));
ok(items.every(i => i.body === 'Time for your meds.'), 'by default the lock screen never shows a medication name');
ok(items.find(i => i.id.endsWith('-14')) && items.find(i => i.id.endsWith('-14')).weekdays.join() === '2,5', 'weekday reminders use the phone\'s numbering (Sunday = 1)');
items = reminderItems(list, { showNames: true });
ok(items[0].body.includes('Lamotrigine 100mg') && items[0].body.includes('with food'), 'names appear only when switched on');
ok(reminderItems(list).every(i => i.hour >= 0 && i.hour < 24 && i.route === 'day'), 'each has a clock time and opens Day');
ok(reminderItems([normaliseMed({ name: 'x', asNeeded: true })]).length === 0, 'nothing to remind for as-needed medication');

// ---- the AI prompt only structures
const p = medPrompt('lamotrigine 100mg at 8am');
ok(/Do not add, suggest, change or correct/.test(p) && /no medical advice/i.test(p) && /leave "times" empty rather than guessing/.test(p), 'the AI is told to structure only, never advise or guess');

done('medication schedule');
