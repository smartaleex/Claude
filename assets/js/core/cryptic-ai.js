/* ============================================================
   cryptic-ai.js — unlimited clues, with the model on a short lead.

   The model is good at inventing wordplay and bad at arithmetic: left
   alone it will cheerfully produce an "anagram" that is missing a letter.
   So it never gets to decide whether its own clue works. It returns the
   clue together with the wordplay in structured form, and verifyClue()
   checks the letters. A clue that fails is not shown; the failures are
   fed back so the next attempt can fix them, up to a few tries.

   Honest limits, stated in the UI too: the verifier proves the mechanics,
   not that the answer is a common word or that a synonym is a good one.
   Machine-made clues are therefore labelled, and can be flagged and
   removed.
   ============================================================ */

import { ask } from './ai.js';
import { verifyClue } from '../data/cryptic-verify.js';
import { ALL } from '../data/cryptic.js';

const DEVICES_BY_LEVEL = {
  1: ['anagram', 'hidden'],
  2: ['charade', 'reversal', 'container', 'deletion', 'initials'],
  3: ['compound'],
};

const SCHEMA = {
  anagram:   `"parse":{"fodder":"the word(s) in the clue that get rearranged","indicator":"the word signalling it"}`,
  hidden:    `"parse":{"fodder":"the consecutive clue words the answer hides across","indicator":"e.g. 'buried in'"}`,
  charade:   `"parse":{"parts":["SHORT","PIECES"]}   (parts joined = the answer)`,
  reversal:  `"parse":{"fodder":"the word BEFORE reversing, forwards","indicator":"e.g. 'sent back'"}`,
  container: `"parse":{"outer":"OUTERPIECE","inner":"INNERPIECE","indicator":"e.g. 'held by'"}   (inner goes inside outer)`,
  deletion:  `"parse":{"source":"LONGERWORD","removed":"X","indicator":"e.g. 'without'"}`,
  initials:  `"parse":{"words":"consecutive clue words whose FIRST letters spell the answer","indicator":"initially"}`,
  compound:  `"parse":{"parts":[{"t":"anag","fodder":"WORD","result":"DROW","indicator":"wildly"},{"t":"lit","v":"ER"}]}   (part types: lit, anag, rev, del, cont; the parts' results joined = the answer)`,
};

const pick = a => a[Math.floor(Math.random() * a.length)];

function prompt({ device, level, example, avoid, feedback }){
  return `You are an expert cryptic crossword setter. Write ONE clue of type "${device}".

Return ONLY JSON:
{"clue":"the clue text ending with its enumeration e.g. (6)",
 "answer":"THEANSWER",
 "def":"the exact words in the clue that DEFINE the answer (must sit at the start or the end)",
 "device":"${device}",
 ${SCHEMA[device]},
 "nudge":"a one-line hint that points at the mechanism without giving the answer",
 "wordplay":"a plain explanation of how the wordplay builds the answer"}

RULES
- The answer is a single common English word of 4 to 9 letters that a general reader knows. No proper nouns, no obscure words.
- The wordplay must be EXACT: every letter accounted for. It will be checked by a program, letter by letter.
- The definition goes at one end of the clue. Every indicator word must actually appear in the clue.
- The answer must not appear written out in the clue (except hidden-word clues).
- Use only standard cryptic abbreviations (e.g. R = right, S = south, ER = the Queen).
- Do not reuse these answers: ${avoid.slice(0, 30).join(', ') || 'none'}.
- Difficulty ${level} of 3.

A CORRECT EXAMPLE of this type, for format only:
${JSON.stringify(example)}
${feedback ? `\nYOUR PREVIOUS ATTEMPT WAS REJECTED BY THE CHECKER: ${feedback}\nFix exactly those faults.` : ''}`;
}

/** Normalise whatever the model returned into our clue shape. */
export function shapeClue(raw, device, level){
  if (!raw || typeof raw !== 'object') return null;
  const answer = String(raw.answer || '').toUpperCase().replace(/[^A-Z]/g, '');
  let clue = String(raw.clue || '').trim();
  if (!answer || !clue) return null;
  const enumeration = `(${answer.length})`;
  if (!clue.includes(enumeration)) clue = clue.replace(/\s*\(\d+\)\s*$/, '') + ' ' + enumeration;
  return {
    clue, answer, enumeration,
    def: String(raw.def || '').trim(),
    device: raw.device === device ? device : device,
    level,
    parse: raw.parse && typeof raw.parse === 'object' ? raw.parse : {},
    nudge: String(raw.nudge || 'Look at how the wordplay builds the answer, letter by letter.').trim(),
    wordplay: String(raw.wordplay || '').trim(),
    ai: true, id: `ai-${Date.now().toString(36)}`,
  };
}

/**
 * Make one verified clue. Throws if none of the attempts pass.
 * `avoid` = answers already in the bank or banned.
 */
export async function generateClue({ level = 1, avoid = [], tries = 3 } = {}){
  const device = pick(DEVICES_BY_LEVEL[level] || DEVICES_BY_LEVEL[1]);
  const example = pick(ALL.filter(c => c.device === device && c.parse && Object.keys(c.parse).length))
               || ALL.find(c => c.device === device);
  const exampleJson = example && {
    clue: example.clue, answer: example.answer, def: example.def, device: example.device,
    parse: example.parse || {}, nudge: example.nudge, wordplay: example.wordplay };

  let feedback = '', lastWhy = '';
  for (let i = 0; i < tries; i++){
    const res = await ask({
      prompt: prompt({ device, level, example: exampleJson, avoid, feedback }),
      maxTokens: 700,
    });
    const c = shapeClue(res.data, device, level);
    if (!c){ feedback = 'The reply was not the JSON format requested.'; lastWhy = feedback; continue; }
    if (avoid.includes(c.answer)){ feedback = `${c.answer} is already used; choose a different answer.`; lastWhy = feedback; continue; }
    const v = verifyClue(c);
    if (v.ok) return c;
    lastWhy = v.reasons.join('; ');
    feedback = lastWhy;
  }
  const e = new Error(`Couldn't get a clue that checks out (${lastWhy || 'no reply'}). Try again.`);
  e.rejected = true;
  throw e;
}
