/* ============================================================
   mind.js — choosing the right line, not a random one.

   The banks in data/lift.js are written by hand and tagged. This module
   decides which item to show, using what the app already knows: how you
   slept, what you have eaten, where your mood sits. Pure functions, no
   DOM, so the rules can be tested.

   The rules are deliberately bipolar-aware, not generically upbeat:
     · Low mood: no hustle. Push effort/action/courage lines down and
       bring endurance, self-compassion and the present up.
     · Elevated mood or very short sleep: the opposite risk. A "seize the
       day" line is fuel on the fire, so action/courage/effort are pushed
       right down and restraint, rest and patience come up.
     · Low food: body lines up, and the truths that name it.
   Nothing here diagnoses. It only leans the selection; with no data it
   is a fair shuffle.
   ============================================================ */

const NS = 'alexhq';

/* ---------------- context ---------------- */

const MIN_LOG = 300;   // below this a day's food log is "forgot to log", not "ate 200 kcal"
const sum = e => (e || []).reduce((n, x) => n + (+x.kcal || 0), 0);

/**
 * day = Day slice data, fuel = Fuel slice data (either may be null).
 * Returns flags the selectors understand.
 */
export function readContext({ day, fuel, todayKey, yesterdayKey, hour = 12 } = {}){
  const ctx = { food:'unknown', sleep:'unknown', mood:'unknown', flags:[] };

  const sl = day?.sleep?.[todayKey] || day?.sleep?.[yesterdayKey];
  if (sl && sl.hours > 0) ctx.sleep = sl.hours < 6 ? 'short' : 'ok';

  const mo = day?.mood?.[todayKey] || day?.mood?.[yesterdayKey];
  if (mo && typeof mo.m === 'number'){
    if (mo.m <= -1 && (mo.e ?? 0) >= 2) ctx.mood = 'mixed';
    else if (mo.m <= -1) ctx.mood = 'low';
    else if (mo.m >= 2) ctx.mood = 'high';
    else ctx.mood = 'steady';
  }

  if (fuel?.days){
    const y = sum(fuel.days[yesterdayKey]), t = sum(fuel.days[todayKey]);
    const target = fuel.targets?.kcal || 2800;
    if (y >= MIN_LOG && y < target * 0.55) ctx.food = 'low';
    else if (hour >= 15 && t < target * 0.3) ctx.food = 'low';
    else if (y >= MIN_LOG || t >= MIN_LOG) ctx.food = 'ok';
  }

  if (ctx.food === 'low') ctx.flags.push('lowfood');
  if (ctx.sleep === 'short') ctx.flags.push('shortsleep');
  if (ctx.mood === 'low') ctx.flags.push('low');
  if (ctx.mood === 'high') ctx.flags.push('high');
  if (ctx.mood === 'mixed') ctx.flags.push('mixed');
  return ctx;
}

/* ---------------- weights ---------------- */

/* theme -> multiplier, per state. Anything unlisted stays at 1. */
const THEME_BIAS = {
  low:       { endure:3, selfcompassion:3, present:2.5, connection:2, grief:2, body:1.6, acceptance:1.6, effort:0.25, action:0.25, courage:0.7 },
  high:      { restraint:4, rest:3.5, patience:3, perspective:2, body:1.6, present:1.5, effort:0.1, action:0.1, courage:0.15 },
  mixed:     { present:3, restraint:2.5, body:2.5, selfcompassion:2.5, rest:2, effort:0.15, action:0.15, courage:0.3 },
  shortsleep:{ rest:3, restraint:2, body:2, effort:0.2, action:0.2 },
  lowfood:   { body:4 },
};

export function quoteWeight(q, ctx){
  let w = 1;
  for (const f of ctx?.flags || []){
    const bias = THEME_BIAS[f]; if (!bias) continue;
    for (const t of q.tags || []) if (bias[t]) w *= bias[t];
  }
  return Math.max(0.02, Math.min(w, 60));
}

/** Truths: conditional ones only appear when the condition holds; when it
    does, they dominate. Unconditional ones are the fallback pool. */
export function truthWeight(t, ctx){
  const when = t.when || [];
  if (!when.length) return ctx?.flags?.length ? 0.6 : 1;
  const hit = when.some(f => (ctx?.flags || []).includes(f));
  return hit ? 8 : 0;
}

/* ---------------- ids and memory ---------------- */

export const idOf = s => {
  let h = 5381; const str = String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const MEM_KEY = `${NS}:liftmem`;
export function loadMem(storage = globalThis.localStorage){
  try { const m = JSON.parse(storage.getItem(MEM_KEY) || 'null'); if (m && typeof m === 'object') return { recent:m.recent || {}, hidden:m.hidden || [] }; }
  catch { /* fall through */ }
  return { recent:{}, hidden:[] };
}
export function saveMem(mem, storage = globalThis.localStorage){
  try { storage.setItem(MEM_KEY, JSON.stringify(mem)); } catch { /* blocked: memory is a nicety */ }
}

/* ---------------- choosing ---------------- */

/**
 * items: array; textOf(item) -> string; weightOf(item) -> number
 * mem.recent[kind]: ids shown lately; mem.hidden: ids never to show.
 * Nothing shown in the last ~60% of the bank repeats (capped at 40), so
 * a full lap goes by before anything returns. rand is injectable.
 */
export function choose(items, { kind, mem, weightOf = () => 1, textOf = x => x, rand = Math.random, remember = true } = {}){
  const hidden = new Set(mem?.hidden || []);
  const recent = (mem?.recent?.[kind] || []);
  const window = Math.min(40, Math.floor(items.length * 0.6));
  const recentSet = new Set(recent.slice(-window));

  const build = (skipRecent) => items
    .map(it => ({ it, id: idOf(textOf(it)), w: weightOf(it) }))
    .filter(x => !hidden.has(x.id) && x.w > 0 && !(skipRecent && recentSet.has(x.id)));

  let pool = build(true);
  if (!pool.length) pool = build(false);
  if (!pool.length) return null;

  let r = rand() * pool.reduce((n, x) => n + x.w, 0);
  let chosen = pool[pool.length - 1];
  for (const x of pool){ r -= x.w; if (r <= 0){ chosen = x; break; } }

  if (remember && mem){
    const list = (mem.recent[kind] = mem.recent[kind] || []);
    list.push(chosen.id);
    if (list.length > 60) list.splice(0, list.length - 60);
  }
  return chosen.it;
}

/** Mark something as not funny / not helpful: never shown again. */
export function hide(mem, text){
  const id = idOf(text);
  if (!mem.hidden.includes(id)) mem.hidden.push(id);
}

/* ---------------- daily line ---------------- */

/** Deterministic pick for a date, leaning on context. The caller
    persists the result so it holds still all day. */
export function pickDaily(quotes, dateKey, ctx, hidden = []){
  const n = Number(String(dateKey).replaceAll('-', '')) || 0;
  const pool = quotes.filter(q => q.on && !hidden.includes(idOf(q.t)));
  const ws = pool.map(q => quoteWeight(q, ctx));
  const total = ws.reduce((a, b) => a + b, 0);
  // a cheap deterministic hash of the date, spread over [0,1)
  const x = (((n * 2654435761) >>> 0) % 100000) / 100000;
  let r = x * total;
  for (let i = 0; i < pool.length; i++){ r -= ws[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/* ---------------- optional AI jokes, on a short lead ---------------- */

/* Topics that are wrong for this reader on any day. A joke touching
   these is dropped rather than softened. */
const BLOCK = /\b(?:cancer|tumou?r|chemo|dying|dead|death|die[sd]?|funeral|suicid|kill|murder|depress|bipolar|manic|mental|psychiatr|therap|asylum|hospital|sick|ill(ness)?|disease|terminal|hospice|overdose|meds?|pills?|drug|rehab|diet|fat|obese|anorex|eating disorder|starv|divorce|abus|rape|assault|racis|nazi|hitler|slave)\w*/i;

const words = s => new Set(String(s).toLowerCase().match(/[a-z']+/g) || []);
const jaccard = (a, b) => { const A = words(a), B = words(b); let i = 0; A.forEach(w => { if (B.has(w)) i++; }); return i / Math.max(1, A.size + B.size - i); };

/** Returns { ok, why }. bank = existing jokes it must not copy. */
export function vetJoke(text, bank = []){
  const t = String(text || '').trim();
  if (t.length < 20 || t.length > 220) return { ok:false, why:'wrong length' };
  if (BLOCK.test(t)) return { ok:false, why:'off-limits topic' };
  if (/[\n]/.test(t)) return { ok:false, why:'more than one joke' };
  if (bank.some(b => jaccard(t, b) > 0.55)) return { ok:false, why:'too close to one already in the bank' };
  return { ok:true };
}

/** The line of the day, chosen once and then held for the date. The
    first open of the day decides it (from last night's sleep and
    yesterday's mood), so logging a mood at 6pm does not swap it. */
export function dailyFor(quotes, dateKey, ctx, storage = globalThis.localStorage){
  const key = `${NS}:dailypick`, mem = loadMem(storage);
  try{
    const saved = JSON.parse(storage.getItem(key) || 'null');
    if (saved?.day === dateKey){
      const q = quotes.find(x => idOf(x.t) === saved.id);
      if (q && !mem.hidden.includes(saved.id)) return q;
    }
  }catch{ /* pick again */ }
  const q = pickDaily(quotes, dateKey, ctx, mem.hidden);
  try{ storage.setItem(key, JSON.stringify({ day:dateKey, id:idOf(q.t) })); }catch{ /* fine */ }
  return q;
}
