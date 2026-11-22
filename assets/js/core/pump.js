/* ============================================================
   pump.js — "was this photo taken straight after training?"

   A pump is real but temporary: blood and fluid in the trained muscles
   make them look fuller and more defined for roughly one to three hours,
   then it is gone. A progress photo taken after chest day will show more
   chest than one taken rested, and that difference is not progress.

   So a photo can carry a tag: rested, or after a session (which areas it
   hit, how long after). It is set automatically when a photo is added
   within a few hours of finishing a workout, and can be changed by hand.
   The comparison and the AI reading then account for it: a pump is
   neither progress nor a problem, it just means those areas read a little
   bigger than they will tomorrow morning.

   Pure: no DOM, no storage.
   ============================================================ */

import { muscleOf } from '../data/workouts.js';

/* How long a pump plausibly shows. Beyond this a photo counts as rested. */
export const PUMP_HOURS = 3;

/* The areas a photo actually shows, from the program's muscle groups. */
export const AREA_OF = {
  'Chest': 'Chest', 'Front delts': 'Shoulders', 'Side delts': 'Shoulders', 'Rear delts & traps': 'Shoulders',
  'Lats': 'Back', 'Upper back': 'Back', 'Traps': 'Back',
  'Biceps': 'Arms', 'Triceps': 'Arms',
  'Quads': 'Legs', 'Hamstrings': 'Legs', 'Glutes': 'Legs', 'Calves': 'Legs',
  'Core': 'Core',
};
export const AREAS = ['Chest', 'Shoulders', 'Back', 'Arms', 'Legs', 'Core'];

/** The areas a session worked hard enough to pump, busiest first. rows: [{n, sets}].
    An area needs at least 6 sets, or a quarter of the session, to count: two sets of
    curls at the end of leg day do not make the arms look different. */
export function pumpedAreas(rows){
  const by = {};
  let total = 0;
  for (const r of rows){
    const a = AREA_OF[muscleOf(r.n)];
    if (!a || !r.sets) continue;
    by[a] = (by[a] || 0) + r.sets; total += r.sets;
  }
  return Object.entries(by)
    .filter(([, n]) => n >= 6 || n >= total / 4)
    .sort((x, y) => y[1] - x[1])
    .map(([a]) => a);
}

/** Rows for pumpedAreas from a stored session: what was done if anything was logged,
    otherwise what was planned (plenty of sessions are finished without logging a set). */
export function sessionRows(sess, planRows = []){
  const ex = sess?.ex || [];
  if (ex.some(r => r.d > 0)) return ex.map(r => ({ n: r.n, sets: r.d }));
  if (ex.length) return ex.map(r => ({ n: r.n, sets: r.p }));
  return planRows;
}

/** The session a photo taken at t most likely followed: finished up to PUMP_HOURS before
    it (or still running and at least 15 minutes in). Latest wins. null if none. */
export function sessionBefore(sessions, t){
  const win = PUMP_HOURS * 3600e3;
  let best = null;
  for (const s of sessions){
    /* A session still running counts once it has been going 15 minutes: before that there is no pump yet. */
    const end = s.endedAt || (s.done ? null : s.startedAt && t - s.startedAt >= 15 * 60e3 ? t : null);
    if (!end || end > t + 10 * 60e3 || t - end > win) continue;
    if (!best || end > best.end) best = { s, end };
  }
  return best ? { session: best.s, mins: Math.max(0, Math.round((t - best.end) / 60e3)) } : null;
}

/** The tag stored on a photo. null = rested. */
export const afterTag = ({ day, title, areas, mins = null }) => ({ day: day || null, title, areas: [...areas], mins });

/** Short label for a thumbnail or the comparison. undefined = never tagged. */
export function tagLabel(tag){
  if (tag === undefined) return '';
  if (tag === null) return 'Rested';
  return `After ${tag.areas.length ? tag.areas.slice(0, 2).join(' + ').toLowerCase() : tag.title.toLowerCase()}`;
}

const list = a => a.length < 2 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`;
const when = m => m == null ? 'shortly' : m < 15 ? 'straight' : m < 60 ? `about ${Math.round(m / 5) * 5} minutes` : `about ${Math.round(m / 30) / 2} hours`;

/** What the AI is told about one photo. Empty when unknown. */
export function promptNote(tag){
  if (tag === undefined) return '';
  if (tag === null) return 'rested, no workout beforehand';
  const areas = tag.areas.length ? list(tag.areas).toLowerCase() : 'the muscles trained';
  return `${when(tag.mins)} after a ${tag.title} session, so ${areas} will look fuller from the pump than at rest`;
}

const what = t => t.areas.length ? list(t.areas).toLowerCase() : t.title.toLowerCase();

/** One plain line under the before/after, or null when the pump does not change the read.
    before / after are the photos' tags (undefined = never tagged, null = rested). */
export function compareNote(before, after){
  const pa = !!before, pb = !!after;
  if (!pa && !pb) return null;
  if (pa && pb){
    return what(before) === what(after) ? `Both taken after ${what(before)} work, so they compare fairly.`
      : `Both are post-workout but after different sessions (${what(before)} vs ${what(after)}). Compare the areas both trained, or the ones neither did.`;
  }
  const t = pa ? before : after;
  return `The ${pa ? 'before' : 'after'} photo was taken after training ${what(t)}. The pump adds a little fullness there for an hour or two, so read ${t.areas.length === 1 ? 'that area' : 'those areas'} with some caution. Everything else compares as normal.`;
}

/** Rule for the AI prompts. */
export const PUMP_RULE = `- Some photos are taken straight after training. A pump makes the trained muscles look fuller and more defined for one to three hours. Where a photo is post-workout, do not count that extra fullness as progress and do not hold it against a rested photo either: say once, briefly, which areas it affects, and lean on the areas it does not. A rested morning photo is the fair baseline. Never treat a post-workout photo as a problem; it is just a different condition.`;
