/* ============================================================
   meds.js — a medication schedule that can hold a complicated day.

   Each medication: a name, a dose (as written, e.g. "100mg"), the times of
   day it is taken, optionally only on some weekdays, a note, whether it goes
   with food, or whether it is only taken as needed (no reminders for those).
   A "dose slot" is a time of day; several medications at 8am are one slot, so
   the Day tool shows one tap for "8am" and lists what is due then.

   Everything here is data and rules, no screens, so it can be tested. It
   reminds and records; it never suggests doses or changes. Dose decisions
   belong to the prescriber, and this file never invents one: anything it
   cannot read it leaves empty and says so.

   Stored on this device only (Slice 'meds'), never in the code or the repo.
   ============================================================ */

import { Slice, keyToDate } from './store.js';

export const medStore = new Slice('meds', {
  list: [],            // [{ id, name, dose, times:['08:00'], days:null|[0-6], note, withFood, asNeeded }]
  remind: false,       // reminders are OFF until asked for (iPhone app)
  showNames: false,    // lock screens are public: by default a reminder says "Time for your meds"
});

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---------------- times ---------------- */
const pad = n => String(n).padStart(2, '0');
const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** "20:00" -> "8:00 pm" */
export function fmtTime(t){
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
}
/** "20:00" -> "8pm", "09:30" -> "9:30am" (for a narrow button) */
export function fmtShort(t){
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}`;
}

/* ---------------- validating ---------------- */
let seq = 0;
const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Make anything medication-shaped safe to store, or null if it is not one. */
export function normaliseMed(raw){
  const name = String(raw?.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name) return null;
  const times = [...new Set((Array.isArray(raw.times) ? raw.times : []).map(String).filter(validTime))].sort().slice(0, 8);
  const asNeeded = !!raw.asNeeded;
  let days = Array.isArray(raw.days) ? [...new Set(raw.days.map(Number).filter(d => d >= 0 && d <= 6))].sort() : null;
  if (days && (days.length === 0 || days.length === 7)) days = null;
  return {
    id: raw.id || newId(),
    name: name.charAt(0).toUpperCase() + name.slice(1),
    dose: String(raw.dose || '').replace(/\s+/g, ' ').trim().slice(0, 30),
    times: asNeeded ? [] : times,
    days,
    note: String(raw.note || '').trim().slice(0, 160),
    withFood: !!raw.withFood,
    asNeeded,
  };
}

/* ---------------- what is due ---------------- */
/** Every scheduled dose on a day, soonest first. As-needed medication is never scheduled. */
export function dosesFor(list, dayKey){
  const wd = keyToDate(dayKey).getDay();
  return (list || []).filter(m => !m.asNeeded && (!m.days || m.days.includes(wd)))
    .flatMap(m => m.times.map(time => ({ medId: m.id, name: m.name, dose: m.dose, time, note: m.note, withFood: m.withFood })))
    .sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

/** The day as time slots: [{ time, doses:[...] }]. Two medications at 8am are one slot. */
export function slotsFor(list, dayKey){
  const out = [];
  for (const d of dosesFor(list, dayKey)){
    const last = out.at(-1);
    if (last && last.time === d.time) last.doses.push(d); else out.push({ time: d.time, doses: [d] });
  }
  return out;
}

/** "Lamotrigine 100mg, Sertraline 50mg (with food)" */
export const slotText = slot => slot.doses.map(d => `${d.name}${d.dose ? ' ' + d.dose : ''}`).join(', ') + (slot.doses.some(d => d.withFood) ? ' (with food)' : '');

/* ---------------- reminders ---------------- */
/** What to schedule on the phone. One reminder per time of day and weekday pattern, so a
    regimen of four times a day is four notifications, not twenty. */
export function reminderItems(list, { showNames = false } = {}){
  const groups = new Map();
  for (const m of (list || []).filter(x => !x.asNeeded)) for (const time of m.times){
    const sig = m.days ? m.days.join('') : 'all';
    const key = `${time}|${sig}`;
    if (!groups.has(key)) groups.set(key, { time, days: m.days, meds: [] });
    groups.get(key).meds.push(m);
  }
  return [...groups.values()].sort((a, b) => a.time.localeCompare(b.time)).map(g => {
    const [hour, minute] = g.time.split(':').map(Number);
    const names = g.meds.map(m => `${m.name}${m.dose ? ' ' + m.dose : ''}`).join(', ');
    const food = g.meds.some(m => m.withFood);
    return {
      id: `alexhq-med-${g.time.replace(':', '')}-${g.days ? g.days.join('') : 'all'}`,
      title: 'Meds',
      body: showNames ? `${names}${food ? ' · with food' : ''}` : 'Time for your meds.',
      hour, minute,
      ...(g.days && { weekdays: g.days.map(d => d + 1) }),     // iOS counts Sunday as 1
      route: 'day',
    };
  });
}

/* ---------------- reading plain English ---------------- */
const DOSE_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|ml|iu|units?|tablets?|tabs?|capsules?|caps?|drops?|puffs?)\b/gi;
const WORD_TIMES = [
  [/\b(?:before bed|bedtime|at night|nightly|every night|night)\b/i, '21:30'],
  [/\b(?:breakfast|morning|on waking|when i wake|waking)\b/i, '08:00'],
  [/\b(?:midday|noon|lunch(?:time)?)\b/i, '12:30'],
  [/\bafternoon\b/i, '15:00'],
  [/\b(?:evening|dinner|supper)\b/i, '18:30'],
];
const FREQUENCY = [
  [/\b(?:four times|4\s*x|qds|qid)\b/i, ['08:00', '12:00', '16:00', '20:00']],
  [/\b(?:three times|3\s*x|tds|tid)\b/i, ['08:00', '14:00', '20:00']],
  [/\b(?:twice|2\s*x|bd|bid)\b/i, ['08:00', '20:00']],
];
const WEEKDAY_RE = /\b(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?s?\b/gi;
const SCHEDULE_WORD = /\b(?:at|every|each|daily|once|twice|three|four|times?|morning|night|noon|midday|lunch|evening|dinner|breakfast|bed|bedtime|afternoon|with|before|after|as needed|when needed|prn|weekdays?|weekends?|am|pm|a day|per day|on)\b/i;

/** Times, weekdays and flags from the words after a dose. */
function readSchedule(text){
  let t = ' ' + text + ' ';
  const times = [];
  t = t.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi, (_, h, m, ap) => {
    let hh = Number(h) % 12;
    if (/^p/i.test(ap)) hh += 12;
    if (Number(h) >= 1 && Number(h) <= 12) times.push(`${pad(hh)}:${m || '00'}`);
    return ' ';
  });
  t = t.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, h, m) => { times.push(`${pad(Number(h))}:${m}`); return ' '; });
  const day = [];
  t = t.replace(WEEKDAY_RE, (_, d) => { day.push(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(d.toLowerCase().slice(0, 3))); return ' '; });
  if (/\bweekdays?\b/i.test(t)) day.push(1, 2, 3, 4, 5);
  if (/\bweekends?\b/i.test(t)) day.push(0, 6);

  let assumed = false;
  if (!times.length) for (const [re, tm] of WORD_TIMES) if (re.test(t)) times.push(tm);
  if (!times.length) for (const [re, tms] of FREQUENCY) if (re.test(t)){ times.push(...tms); break; }
  const asNeeded = /\b(?:as needed|when needed|if needed|prn|only when)\b/i.test(t);
  if (!times.length && !asNeeded){ times.push('08:00'); assumed = true; }

  const notes = [];
  if (/\b(?:every other day|alternate days?|every second day|every 3 days|fortnightly|weekly)\b/i.test(text)) notes.push('Not every day: set the weekdays by hand.');
  if (/\bevery\s+\d+\s*(?:hours?|hrs?)\b/i.test(text)) notes.push('Every few hours: add the times by hand.');
  if (/\b(?:empty stomach|before food|before eating)\b/i.test(text)) notes.push('Empty stomach');
  return {
    times, days: day.length ? [...new Set(day)] : null,
    withFood: /\bwith (?:food|meals?|breakfast|lunch|dinner|a meal)\b|\bafter (?:food|eating|meals?)\b/i.test(text),
    asNeeded, assumed, note: notes.join(' '),
  };
}

const cleanName = s => s.replace(/[^A-Za-z0-9' \-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Read a few lines of plain English into medications. Returns { meds, notes }; each med may
    carry `assumed: true` where no time was said and 8:00 am was filled in, for the screen to flag. */
export function parseMedText(text){
  const meds = [], notes = [];
  for (const chunk of String(text || '').split(/[;\n]+/).map(c => c.trim()).filter(Boolean)){
    const matches = [...chunk.matchAll(DOSE_RE)];
    if (!matches.length){
      // "ibuprofen when needed", "magnesium at night": the name runs up to the first schedule word
      const m = SCHEDULE_WORD.exec(chunk);
      const name = cleanName(m ? chunk.slice(0, m.index) : chunk);
      if (!name){ notes.push(`Could not read: "${chunk}"`); continue; }
      const sched = readSchedule(m ? chunk.slice(m.index) : '');
      meds.push({ name, dose: '', ...sched });
      continue;
    }
    // each dose anchors a medication; the words between two doses hold the first one's schedule and the next one's name
    let nameStart = 0;
    matches.forEach((dm, i) => {
      const nameText = chunk.slice(nameStart, dm.index);
      const name = cleanName(nameText.split(/\s*(?:,|\band\b)\s*/i).pop());
      const after = chunk.slice(dm.index + dm[0].length, matches[i + 1] ? matches[i + 1].index : undefined);
      let schedText = after;
      if (matches[i + 1]){
        const cut = Math.max(after.lastIndexOf(','), (/\band\b/gi.test(after) ? after.toLowerCase().lastIndexOf(' and ') : -1));
        if (cut > -1){ schedText = after.slice(0, cut); nameStart = dm.index + dm[0].length + cut + 1; }
        else nameStart = dm.index + dm[0].length;
      }
      if (!name){ notes.push(`Could not find the name before "${dm[0]}".`); return; }
      meds.push({ name, dose: `${dm[1].replace(',', '.')}${dm[2].toLowerCase()}`, ...readSchedule(schedText) });
    });
  }
  return { meds, notes };
}

/** The prompt for the AI path: it only structures what was written. */
export function medPrompt(text){
  return `Turn this person's own description of their medication into structured data. Only structure what is written. Do not add, suggest, change or correct any medication, dose or time, and give no medical advice. If something is not stated, leave it empty.

TEXT: "${String(text).replace(/"/g, "'")}"

Reply with ONLY this JSON:
{"meds":[{"name":"as written","dose":"as written, e.g. 100mg","times":["08:00","20:00"],"days":null,"withFood":false,"asNeeded":false,"note":"anything else they wrote, short"}],"notes":["anything you could not place"]}
"times" are 24-hour HH:MM. "days" is null for every day, or a list of weekday numbers (0 = Sunday ... 6 = Saturday). If a time is not stated, leave "times" empty rather than guessing.`;
}
