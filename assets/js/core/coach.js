/* ============================================================
   coach.js — reading physique photos, and what may change because of it.

   A vision model looking at a phone photo is giving an opinion, not a
   measurement. Lighting, pose, distance, pump and time of day all move
   what a photo shows more than a month of training does. So the whole
   module is built around that:

     · the prompt makes the model say when two photos are not
       comparable, and forbids body-fat and weight estimates outright
     · the prompt forbids cutting advice, because the current problem is
       under-eating and a "trim the waist" nudge is exactly the wrong
       message for this person right now
     · nothing the model returns can touch the program directly. Every
       suggested change passes through sanitiseBenchmark(), which clamps
       it to muscles that exist, caps it per muscle, caps the weekly
       total, and refuses the ones that would aggravate a known injury.

   Everything here is pure — no DOM, no network — so the guardrails can
   be tested without a phone or an API key.
   ============================================================ */

import { muscleOf } from '../data/workouts.js';

/* The only muscles a suggestion may name. Matches muscleOf()'s labels so
   an accepted suggestion maps onto real exercises. */
export const MUSCLES = [
  'Side delts', 'Rear delts & traps', 'Lats', 'Upper back', 'Chest',
  'Biceps', 'Triceps', 'Calves', 'Core', 'Quads', 'Hamstrings',
];

/* Per-muscle ceiling on extra weekly sets. Zero means "never add".
     Front delts — the shoulder is unstable and every press already loads it.
     Traps       — heavy traps narrow the shoulder line, working against the taper.
     Triceps     — distal triceps tendinopathy; one extra set at most.        */
export const CAPS = { 'Front delts':0, 'Traps':0, 'Triceps':1 };
export const DEFAULT_CAP = 3;
export const MAX_TOTAL = 6;          // extra sets per WEEK across everything
export const MAX_PER_EXERCISE = 2;   // never pile more than +2 onto one movement

const GAPS = ['close', 'moderate', 'large'];
const DIRS = ['up', 'same', 'down', 'unclear'];

/* ---------------- context from the log ---------------- */

/** Nearest logged weight to a date, within `within` days, else null. */
export function weightNear(weights, dateKey, within = 7){
  const t = Date.parse(dateKey + 'T12:00:00');
  let best = null, bestGap = Infinity;
  for (const [k, kg] of Object.entries(weights || {})){
    const gap = Math.abs(Date.parse(k + 'T12:00:00') - t) / 86400000;
    if (gap <= within && gap < bestGap && Number.isFinite(+kg)){ best = { k, kg:+kg }; bestGap = gap; }
  }
  return best;
}

/** Facts the model should reason from, so it is grounded in what actually
    happened rather than guessing from the photos alone. */
export function buildContext({ weights, fuelDays, targetKcal, sessions, fromKey, toKey, phaseName, week }){
  const L = [];
  if (phaseName) L.push(`Current program: ${phaseName}${week ? `, week ${week} of 8` : ''}.`);

  const w0 = weightNear(weights, fromKey), w1 = weightNear(weights, toKey);
  if (w0 && w1 && w0.k !== w1.k) L.push(`Logged bodyweight: ${w0.kg}kg (${w0.k}) to ${w1.kg}kg (${w1.k}).`);
  else if (w1) L.push(`Latest logged bodyweight: ${w1.kg}kg (${w1.k}).`);
  else {
    // Weight is logged rarely, so a strict window would leave the model
    // blind to it most of the time. Fall back to the most recent one on
    // or before the photo, and say when it was rather than implying it is current.
    const prior = Object.entries(weights || {})
      .filter(([k, kg]) => k <= toKey && Number.isFinite(+kg))
      .sort((a, b) => b[0].localeCompare(a[0]))[0];
    if (prior && (Date.parse(toKey + 'T12:00:00') - Date.parse(prior[0] + 'T12:00:00')) / 86400000 <= 45)
      L.push(`Most recent logged bodyweight before these photos: ${+prior[1]}kg (${prior[0]}) — may be out of date.`);
  }

  const done = (sessions || []).filter(s => s.done && s.dayKey >= fromKey && s.dayKey <= toKey);
  if (fromKey !== toKey) L.push(`${done.length} training sessions logged between the photos.`);

  // Average intake over days with a real amount logged — a coffee and
  // nothing else is a missing day, not a 200 kcal day.
  const days = Object.entries(fuelDays || {})
    .map(([k, es]) => [k, (es || []).reduce((n, e) => n + (+e.kcal || 0), 0)])
    .filter(([, kcal]) => kcal >= 800).slice(-14);
  if (days.length >= 3 && targetKcal){
    const avg = Math.round(days.reduce((n, [, k]) => n + k, 0) / days.length);
    L.push(`Average logged intake: about ${avg} kcal over ${days.length} logged days, against a target of ${targetKcal}.`);
  }
  return L.join('\n');
}

/* ---------------- prompts ---------------- */

const ABOUT = `He is 185cm, about 75kg, already lean. He wants a swimmer's build: broad shoulders and lats, a small waist, a full upper chest, bigger arms. He trains 4 days a week for about 40 minutes and is on a lean bulk, which means he needs to eat MORE. Limits: an unstable shoulder, distal triceps tendinopathy, knee valgus.`;

const RULES = `RULES
- Describe only what is actually visible. If the photos are not comparable (pose, lighting, distance, pump, time of day), say that first and lower your confidence instead of guessing. Say "unclear" whenever you cannot tell.
- Never estimate body-fat percentage or bodyweight. Never comment on attractiveness. Never identify anyone.
- Never recommend cutting, a calorie deficit, fasting or restricting food. If the logged intake is below target, say eating enough is the first lever.
- Be honest rather than flattering, and kind rather than harsh. No shaming language.
- Respect his limits: do not suggest more pressing volume, front-delt work or heavy triceps work.
- Plain sentences. No emoji.`;

export function progressPrompt({ context, question, labels }){
  return `You are a strength and physique coach reading progress photos for one person.
${ABOUT}

The photos attached, in order: ${labels.join('; ')}.

FACTS FROM HIS LOG
${context || '(none available)'}

HIS QUESTION: ${question ? `"${question}"` : 'none — give a general progress read'}

${RULES}

Respond with ONLY this JSON:
{"headline":"one honest sentence",
 "comparability":"how comparable these photos are and what that limits, one or two sentences",
 "changes":[{"area":"Shoulders|Arms|Chest|Back|Waist|Legs","direction":"up|same|down|unclear","note":"short, specific"}],
 "answer":"a direct answer to his question, or empty string if he asked none",
 "next":["one or two concrete things to do, max"]}`;
}

export function benchmarkPrompt({ context, volume, labels }){
  return `You are a strength and physique coach comparing a person's current physique with a goal reference photo.
${ABOUT}

The photos attached, in order: ${labels.join('; ')}.
The first is him now. The rest are a REFERENCE of the look he is aiming at — someone else. Treat them only as a reference for proportions, never as a verdict on him.

FACTS FROM HIS LOG
${context || '(none available)'}

HIS CURRENT WEEKLY SETS PER MUSCLE
${volume}

${RULES}
- Separate what is trainable (muscle size, lat and delt width, arm size) from what is skeletal or genetic (clavicle width, height, muscle insertions). Be plain about what will not change.
- Be honest about whether the reference is realistic and roughly over what timeframe. If it looks beyond what is naturally achievable, say so.
- Only suggest extra sets for muscles where the gap is real and the muscle is trainable. Extra sets are per WEEK, 1 to 3 each, at most 4 muscles.

Muscle names must be exactly one of: ${MUSCLES.join(', ')}.

Respond with ONLY this JSON:
{"summary":"two honest sentences",
 "areas":[{"muscle":"<name>","gap":"close|moderate|large","note":"short"}],
 "frame":"what is mostly skeletal or genetic here, one or two sentences",
 "realism":"is this realistic and over what timeframe, one or two sentences",
 "adjustments":[{"muscle":"<name>","extraSets":1,"why":"short"}]}`;
}

/* ---------------- tolerant parsing ----------------
   The lesson from Plan ideas: a model can return perfectly valid JSON in
   the wrong shape. Take what is usable, drop what is not, and let the
   caller say so plainly when nothing usable is left. */

const str = v => (typeof v === 'string' ? v.trim() : '');
const list = v => (Array.isArray(v) ? v : []);

export function sanitiseProgress(raw){
  const r = raw && typeof raw === 'object' ? raw : {};
  const changes = list(r.changes)
    .filter(c => c && str(c.note))
    .map(c => ({
      area: str(c.area) || 'Overall',
      direction: DIRS.includes(str(c.direction).toLowerCase()) ? str(c.direction).toLowerCase() : 'unclear',
      note: str(c.note),
    })).slice(0, 6);
  const out = {
    headline: str(r.headline),
    comparability: str(r.comparability),
    changes,
    answer: str(r.answer),
    next: list(r.next).map(str).filter(Boolean).slice(0, 2),
  };
  out.usable = !!(out.headline || out.changes.length || out.answer);
  return out;
}

/** The muscles a suggestion may name, matched forgivingly ("side delt",
    "Lateral delts") onto the canonical list. */
export function canonMuscle(name){
  const n = str(name).toLowerCase();
  if (!n) return null;
  const direct = MUSCLES.find(m => m.toLowerCase() === n);
  if (direct) return direct;
  if (/side|lateral|medial/.test(n) && /delt|shoulder/.test(n)) return 'Side delts';
  if (/rear|posterior/.test(n))  return 'Rear delts & traps';
  if (/\blats?\b|latissimus/.test(n)) return 'Lats';
  if (/upper back|mid.?back|rhomboid/.test(n)) return 'Upper back';
  if (/chest|pec/.test(n))       return 'Chest';
  if (/bicep/.test(n))           return 'Biceps';
  if (/tricep/.test(n))          return 'Triceps';
  if (/front delt|anterior/.test(n)) return 'Front delts';   // recognised so the cap can refuse it
  if (/trap/.test(n))            return 'Traps';
  if (/calf|calves/.test(n))     return 'Calves';
  if (/core|abs?\b|abdominal/.test(n)) return 'Core';
  if (/quad/.test(n))            return 'Quads';
  if (/hamstring/.test(n))       return 'Hamstrings';
  return null;
}

/** Clamp the model's suggested adjustments to what is safe. Returns the
    accepted list plus what was refused and why, so the UI can say so
    instead of silently dropping things. */
export function clampAdjustments(items){
  const accepted = [], refused = [];
  let total = 0;
  const seen = new Set();

  for (const it of list(items)){
    const muscle = canonMuscle(it?.muscle);
    const asked = Math.round(Number(it?.extraSets));
    if (!muscle || !Number.isFinite(asked) || asked < 1) continue;
    if (seen.has(muscle)) continue;
    seen.add(muscle);

    const cap = muscle in CAPS ? CAPS[muscle] : DEFAULT_CAP;
    if (cap === 0){
      refused.push({ muscle, reason:
        muscle === 'Front delts' ? 'your shoulder is unstable and every press already loads it'
      : muscle === 'Traps'       ? 'heavy traps narrow the shoulder line, which works against the taper'
      :                            'that would aggravate a known problem' });
      continue;
    }
    let sets = Math.min(asked, cap);
    if (sets < asked) refused.push({ muscle, reason:
      muscle === 'Triceps' ? `capped at ${cap} because of the elbow tendon` : `capped at ${cap} per muscle`, partial:true });
    if (total + sets > MAX_TOTAL){
      const room = MAX_TOTAL - total;
      if (room <= 0){ refused.push({ muscle, reason:`the weekly limit of ${MAX_TOTAL} extra sets is already used` }); continue; }
      refused.push({ muscle, reason:`trimmed to ${room} to stay inside the weekly limit of ${MAX_TOTAL}`, partial:true });
      sets = room;
    }
    total += sets;
    accepted.push({ muscle, extraSets: sets, why: str(it.why) });
  }
  return { accepted, refused, total };
}

export function sanitiseBenchmark(raw){
  const r = raw && typeof raw === 'object' ? raw : {};
  const areas = list(r.areas).map(a => {
    const muscle = canonMuscle(a?.muscle);
    const gap = GAPS.includes(str(a?.gap).toLowerCase()) ? str(a.gap).toLowerCase() : 'moderate';
    return muscle && str(a?.note) ? { muscle, gap, note: str(a.note) } : null;
  }).filter(Boolean).slice(0, 6);

  const { accepted, refused, total } = clampAdjustments(r.adjustments);
  const out = {
    summary: str(r.summary), frame: str(r.frame), realism: str(r.realism),
    areas, adjustments: accepted, refused, total,
  };
  out.usable = !!(out.summary || out.areas.length || out.adjustments.length);
  return out;
}

/* ---------------- applying focus to the program ----------------
   "+2 sets of side delts a week" has to land on actual exercises. Spread
   it round-robin across the matching movements in program order, so it
   raises training frequency rather than piling onto one lift, and never
   put more than MAX_PER_EXERCISE on any single exercise. */
export function bonusMap(phase, focus){
  const out = {};
  if (!phase || !focus) return out;

  const byMuscle = {};
  for (const d of phase.days) for (const ss of d.supersets) for (const ex of ss.exercises){
    const m = muscleOf(ex.name);
    (byMuscle[m] ||= []).push(`${d.key}|${ex.name}`);
  }
  for (const [muscle, extra] of Object.entries(focus)){
    const slots = byMuscle[muscle] || [];
    if (!slots.length) continue;
    let left = Math.max(0, Math.round(extra));
    for (let i = 0; left > 0 && i < slots.length * MAX_PER_EXERCISE; i++){
      const key = slots[i % slots.length];
      if ((out[key] || 0) >= MAX_PER_EXERCISE) continue;
      out[key] = (out[key] || 0) + 1;
      left--;
    }
  }
  return out;
}

export const bonusFor = (map, dayKey, name) => map[`${dayKey}|${name}`] || 0;

/** Sets actually added to the program per muscle — can be less than asked
    if the phase has too few matching exercises to hold them. */
export function appliedTotals(phase, focus){
  const map = bonusMap(phase, focus);
  const out = {};
  for (const [key, n] of Object.entries(map)){
    const m = muscleOf(key.split('|')[1]);
    out[m] = (out[m] || 0) + n;
  }
  return out;
}
