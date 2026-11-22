/* ============================================================
   coach-chat.js — the coach on the session screen.

   You tell it what is going on ("my knees hurt after the RDLs", "the
   leg press is taken", "is today balanced?") and it answers, and when an
   exercise should change it proposes the change. The proposals go through
   the same checks and the same apply / undo as "Change it in your own
   words" (core/training-edit.js, apps/forge/edit-apply.js).

   It may only swap exercises or change reps and rest: the 4 / 3 / 3 format
   (FORMAT in data/workouts.js) is fixed. Pure: the prompt, the offline
   answer, and the filter. The panel is apps/forge/coach-panel.js.
   ============================================================ */

import { FORMAT } from '../data/workouts.js';
import { swapsFor, gearOf } from '../data/swaps.js';
import { PROFILE } from './training-edit.js';

export const COACH_TYPES = ['swap', 'reps', 'rest'];
/** Only the changes the coach is allowed to make. */
export const coachOps = ops => (ops || []).filter(o => COACH_TYPES.includes(o?.type));

const PAIN = /\b(hurts?|hurting|pain(ful)?|sore|aches?|aching|twinges?|clicks?|clicking|pinch(es|ing)?|niggle|tweak(ed)?|flare)/i;
const BUSY = /\b(taken|busy|occupied|in use|being used|no free|don'?t have|doesn'?t have|out of order|broken|full)\b/i;
const SWAP = /\b(swap|alternative|instead|else|replace|different|other option)\b/i;

const line = (ex, dk, swaps) => {
  const now = swaps[`${dk}|${ex.name}`];
  return `${ex.name}${now ? ` (currently swapped to ${now})` : ''} ${ex.reps}`;
};

/** The prompt. day = today's session; days = the phase; week = { muscle: sets } for the week as it stands. */
export function coachPrompt({ text, day, days, swaps = {}, body = {}, phase = {}, ramp = {}, focus = null, week = {} }){
  const today = day.supersets.map((ss, i) => `  SS${i + 1} (${FORMAT[i]} sets): ${ss.exercises.map(ex => line(ex, day.key, swaps)).join('  +  ')}`).join('\n');
  const rest = days.filter(d => d.key !== day.key).map(d => `  ${d.key} ${d.title}: ${d.supersets.flatMap(ss => ss.exercises).map(ex => swaps[`${d.key}|${ex.name}`] || ex.name).join(', ')}`).join('\n');
  const vol = Object.entries(week).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(', ');
  return `You are Alex's strength coach, inside his training app. He has written to you about today's session. Answer him, and when an exercise should change, propose it as a change he can apply with one tap.

THE PERSON: ${PROFILE.heightCm}cm, ${body.kg ? '~' + body.kg : '~' + PROFILE.startKg}kg, lean bulking towards ${PROFILE.goalKg}kg. Goal: a swimmer's build, wide delts and lats, high upper chest, small waist. Trains 4 days a week at Anytime Fitness Jannali (full cable and machine floor), about ${PROFILE.minutes} minutes a session.${ramp.active ? ' He is easing back in after time off.' : ''} Phase ${phase.phase || '?'} (${phase.name || ''}).
HIS BODY: unstable, hypermobile shoulders (no uncontrolled or heavy free-weight overhead work, nothing behind the neck, no deep barbell bench); distal triceps tendon pain (no skull crushers, no overhead triceps extensions); knees cave inward under load; tight glutes pull on the lower back. He prefers machines, cables and stable movements.
THE FORMAT IS FIXED: 3 supersets a session, the first for 4 sets, the second and third for 3. Never change sets, never add or remove an exercise. Keep each superset pairing muscles that do not compete.

TODAY: ${day.key} ${day.title}
${today}
THE REST OF THE WEEK:
${rest}
WEEKLY SETS BY MUSCLE: ${vol}
${focus ? `HE IS ASKING ABOUT: ${focus.name}${focus.orig && focus.orig !== focus.name ? ` (swapped in for ${focus.orig})` : ''} on ${focus.dk}.\n` : ''}
HE SAYS: "${String(text).replace(/"/g, "'").slice(0, 600)}"

Reply with ONLY this JSON:
{"reply":"2 to 4 short sentences answering him directly, plain Australian English, no em dashes. If something hurts, say what to change and that sharp, catching or lasting pain is a physio, not a different exercise.","ops":[]}
"ops" holds 0 to 3 changes, only when a change genuinely helps:
{"type":"swap","day":"${day.key}","from":"exact name from the program above","to":"replacement exercise","gear":"dumbbell|barbell|cable|machine|bodyweight","why":"one line about him"}
{"type":"reps","day":"${day.key}","exercise":"exact name","reps":"10–12","why":"one line"}
{"type":"rest","day":"${day.key}","exercise":"exact name","rest":"60s","why":"one line"}
Prefer a replacement that trains the same muscle, so the week stays balanced. For a machine that is taken, pick different kit for the same movement. If no change is needed, return "ops":[].`;
}

/** Without AI: the obvious answer when he is asking about one exercise that hurts or is taken. Null otherwise. */
export function offlineCoach({ text, focus }){
  if (!focus) return null;
  const pain = PAIN.test(text), busy = BUSY.test(text);
  if (!pain && !busy && !SWAP.test(text)) return null;
  const opts = (swapsFor(focus.orig || focus.name)?.options || []).filter(o => o.name !== focus.name && o.name !== focus.orig);
  const kit = gearOf(focus.name);
  const pick = busy ? opts.find(o => o.gear !== kit) : pain ? opts.find(o => o.gear === 'machine' || o.gear === 'cable') : null;
  const o = pick || opts[0];
  if (!o) return { reply: 'There is no listed alternative for that one. Tap the swap button on it and search the library for something that trains the same muscle.', ops: [] };
  return {
    reply: pain
      ? `Swap it for ${o.name} for now: it trains the same thing with a more controlled path. Keep the range short of where it hurts, and if it is sharp, catching or still there tomorrow, get a physio to look at it.`
      : `${o.name} does the same job on different kit, so the session stays balanced.`,
    ops: [{ type: 'swap', day: focus.dk, from: focus.name, to: o.name, gear: o.gear, why: o.note }],
  };
}

/** The standing answer when AI is off and nothing in the words could be acted on. */
export const OFFLINE_REPLY = 'AI is off, so this is the standing advice: if a movement hurts the shoulder, use a neutral grip and cut the range before the weight. If it is the elbow, add a second round of light pushdowns before pressing and stop short of lockout. For a machine that is taken, tap the swap button on that exercise.';
