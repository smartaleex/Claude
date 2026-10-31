/* ============================================================
   cryptic-verify.js — proving a clue actually works.

   A cryptic clue is only worth showing if the wordplay is exact. Hand
   written clues were checked once, by script, when they were written. A
   model inventing clues on demand has no such safety net, so it does not
   get to hand over a finished clue: it hands over the clue AND the
   wordplay in structured form, and this module checks the arithmetic —
   every letter accounted for, indicators genuinely present in the clue,
   enumeration correct — before anything reaches the screen.

   What this CAN prove: letter-level mechanics (an anagram really is one,
   a hidden word really is hidden, reversals reverse, containers
   assemble, charades concatenate, deletions delete).
   What it CANNOT prove: that a synonym is a good synonym, that a
   definition means the answer, or that the answer is a real word. So
   machine-made clues are labelled as such, and can be flagged and
   removed. Pure: no DOM, no network.

   Structured form (`parse`):
     anagram   { fodder, indicator }
     hidden    { fodder, indicator }
     reversal  { fodder, indicator }            fodder = the word, forwards
     deletion  { source, removed, indicator }
     container { outer, inner, indicator }
     charade   { parts: ['CAR','PET'] }
     initials  { words, indicator }             first letters of `words`
     homophone { sounds, indicator }            what it sounds like
     double    {}                               two plain definitions
     compound  { parts: [ {t:'lit',v} | {t:'anag',fodder,result,indicator}
                        | {t:'rev',fodder,result,indicator}
                        | {t:'del',source,removed,result,indicator}
                        | {t:'cont',outer,inner,result,indicator} ] }
   ============================================================ */

export const DEVICE_LEVEL = {
  hidden:1, double:1, alternate:1, anagram:1,
  charade:2, reversal:2, deletion:2, container:2, homophone:2, initials:2,
  compound:3,
};

const up = s => String(s ?? '').toUpperCase().replace(/[^A-Z]/g, '');
const sorted = s => up(s).split('').sort().join('');
const has = (clue, phrase) => !!phrase && String(clue).toLowerCase().includes(String(phrase).toLowerCase().trim());

/** Every insertion of `inner` into `outer` — used to check containers. */
const insertions = (outer, inner) => {
  const o = up(outer), i = up(inner), out = [];
  for (let k = 1; k < o.length; k++) out.push(o.slice(0, k) + i + o.slice(k));
  return out;
};

const removals = (source, removed) => {
  const s = up(source), r = up(removed), out = [];
  // remove `r` as a contiguous piece, or (for a single letter) any one occurrence
  let idx = s.indexOf(r);
  while (idx !== -1){ out.push(s.slice(0, idx) + s.slice(idx + r.length)); idx = s.indexOf(r, idx + 1); }
  return out;
};

/** Result letters of one compound part, or null if the part is invalid. */
function partResult(p, clue, why){
  if (p.t === 'lit') return up(p.v) || null;
  const ind = () => { if (!has(clue, p.indicator)) { why.push(`indicator "${p.indicator}" is not in the clue`); return false; } return true; };
  if (p.t === 'anag'){
    if (!ind()) return null;
    if (sorted(p.fodder) !== sorted(p.result)){ why.push(`${up(p.fodder)} is not an anagram of ${up(p.result)}`); return null; }
    if (up(p.fodder) === up(p.result)){ why.push('anagram returns the same word'); return null; }
    return up(p.result);
  }
  if (p.t === 'rev'){
    if (!ind()) return null;
    if (up(p.fodder).split('').reverse().join('') !== up(p.result)){ why.push(`${up(p.fodder)} reversed is not ${up(p.result)}`); return null; }
    return up(p.result);
  }
  if (p.t === 'del'){
    if (!ind()) return null;
    if (!removals(p.source, p.removed).includes(up(p.result))){ why.push(`${up(p.source)} without ${up(p.removed)} is not ${up(p.result)}`); return null; }
    return up(p.result);
  }
  if (p.t === 'cont'){
    if (!ind()) return null;
    if (!insertions(p.outer, p.inner).includes(up(p.result))){ why.push(`${up(p.inner)} inside ${up(p.outer)} does not make ${up(p.result)}`); return null; }
    return up(p.result);
  }
  why.push(`unknown part type "${p.t}"`);
  return null;
}

/**
 * clue: { clue, answer, enumeration, def, device, parse }
 * returns { ok, reasons: [] }
 */
export function verifyClue(c){
  const why = [];
  const A = up(c?.answer);
  const P = c?.parse || {};

  // ---- things true of every clue ----
  if (!c || typeof c.clue !== 'string') return { ok:false, reasons:['no clue text'] };
  if (A.length < 3 || A.length > 15) why.push('answer length is out of range');
  const enumN = (String(c.enumeration || '').match(/\d+/g) || []).reduce((a, b) => a + +b, 0);
  if (enumN !== A.length) why.push(`enumeration ${c.enumeration} does not match ${A.length} letters`);
  if (!String(c.clue).includes(c.enumeration)) why.push('clue text does not end with its enumeration');
  const body = String(c.clue).replace(c.enumeration || '', '').trim();
  if (c.device !== 'double' && c.def !== 'both halves'){
    if (!has(body, c.def)) why.push('the definition is not actually in the clue');
    else {
      const l = body.toLowerCase(), d = String(c.def).toLowerCase().replace(/\[.*?\]/g, '').trim();
      // a definition belongs at one END of a cryptic clue
      if (!l.startsWith(d.slice(0, 6)) && !l.replace(/[^a-z]+$/g, '').endsWith(d.slice(-6)))
        why.push('the definition is not at either end of the clue');
    }
  }
  const bodyLetters = up(body);
  /* A giveaway check — except where it is inherent: a hidden-word clue hides
     the answer in the text on purpose, and a deletion clue starts from a word
     that contains the answer (STRIP -> TRIP), so the answer being a piece of
     the clue is the mechanism, not a leak. */
  const inherent = c.device === 'hidden' || (c.device === 'deletion' && up(P.source).includes(A));
  if (!inherent && bodyLetters.includes(A) && A.length >= 4)
    why.push('the answer appears inside the clue text');

  // ---- per device ----
  switch (c.device){
    case 'anagram':
      if (sorted(P.fodder) !== sorted(A)) why.push(`${up(P.fodder)} is not an anagram of ${A}`);
      if (up(P.fodder) === A) why.push('the fodder is already the answer');
      if (!has(body, P.fodder) && !up(body).includes(up(P.fodder))) why.push('the fodder is not in the clue');
      if (!has(body, P.indicator)) why.push('the anagram indicator is not in the clue');
      break;
    case 'hidden': {
      const f = up(P.fodder);
      if (!f.includes(A)) why.push(`${A} is not hidden in ${f}`);
      if (!up(body).includes(f)) why.push('the hiding words are not in the clue');
      if (f === A) why.push('the answer is not hidden — it is the whole word');
      if (!has(body, P.indicator)) why.push('the hidden-word indicator is not in the clue');
      break; }
    case 'reversal':
      if (up(P.fodder).split('').reverse().join('') !== A) why.push(`${up(P.fodder)} reversed is not ${A}`);
      if (up(P.fodder) === A) why.push('the word is a palindrome of itself');
      if (!has(body, P.indicator)) why.push('the reversal indicator is not in the clue');
      break;
    case 'deletion':
      if (!removals(P.source, P.removed).includes(A)) why.push(`${up(P.source)} without ${up(P.removed)} is not ${A}`);
      if (!has(body, P.indicator)) why.push('the deletion indicator is not in the clue');
      break;
    case 'container':
      if (!insertions(P.outer, P.inner).includes(A)) why.push(`${up(P.inner)} inside ${up(P.outer)} is not ${A}`);
      if (!has(body, P.indicator)) why.push('the container indicator is not in the clue');
      break;
    case 'charade':
      if (!Array.isArray(P.parts) || P.parts.length < 2) why.push('a charade needs at least two parts');
      else if (P.parts.map(up).join('') !== A) why.push(`${P.parts.map(up).join(' + ')} is not ${A}`);
      break;
    case 'initials': {
      const words = String(P.words || '').split(/\s+/).filter(Boolean);
      const first = words.map(w => up(w)[0] || '').join('');
      if (first !== A) why.push(`the first letters of "${P.words}" spell ${first}, not ${A}`);
      if (!has(body, P.words)) why.push('the words are not in the clue');
      if (!has(body, P.indicator)) why.push('the "initially" indicator is not in the clue');
      break; }
    case 'homophone':
      if (up(P.sounds) === A || !P.sounds) why.push('a homophone must sound like a DIFFERENT word');
      if (!has(body, P.indicator)) why.push('the "sounds like" indicator is not in the clue');
      break;
    case 'alternate': {
      const f = up(P.fodder);
      const odd = f.split('').filter((_, i) => i % 2 === 0).join(''), even = f.split('').filter((_, i) => i % 2 === 1).join('');
      if (odd !== A && even !== A) why.push(`neither odd nor even letters of ${f} spell ${A}`);
      if (!up(body).includes(f)) why.push('the fodder is not in the clue');
      break; }
    case 'compound': {
      if (!Array.isArray(P.parts) || P.parts.length < 2) { why.push('a compound clue needs at least two parts'); break; }
      const res = P.parts.map(p => partResult(p, body, why));
      if (res.some(r => r == null)) break;
      if (res.join('') !== A) why.push(`the parts spell ${res.join('')}, not ${A}`);
      break; }
    case 'double':
      break;
    default:
      why.push(`unknown device "${c.device}"`);
  }
  return { ok: why.length === 0, reasons: why };
}

/** Difficulty 1-3 for any clue, hand-written or machine-made. */
export function levelOf(c){
  if (c?.level) return c.level;
  if (c?.device === 'anagram' && up(c.answer).length > 8) return 2;
  return DEVICE_LEVEL[c?.device] || 2;
}

/**
 * Which level to serve next. Looks at how the last few clues actually
 * went — solved without help, with hints, or given up — rather than
 * asking you to pick. Moves up when it is comfortable, down when you are
 * struggling, and otherwise stays put.
 */
export function recommendLevel(history){
  const recent = (history || []).slice(-6);
  if (recent.length < 3) return 1;
  const cur = Math.round(recent.reduce((n, r) => n + (r.level || 1), 0) / recent.length) || 1;
  const solved = recent.filter(r => r.solved).length;
  const clean = recent.filter(r => r.solved && (r.hints || 0) === 0).length;
  const gaveUp = recent.filter(r => r.revealed).length;
  if (clean >= 4 && gaveUp === 0) return Math.min(3, cur + 1);
  if (solved <= 2 || gaveUp >= 3) return Math.max(1, cur - 1);
  return cur;
}
