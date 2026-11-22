import { ok, done } from '../lib.mjs';
import { ALL, CLUES, DEVICES, clueFor, clueIndexFor } from '../../assets/js/data/cryptic.js';
import { verifyClue, levelOf, recommendLevel, DEVICE_LEVEL } from '../../assets/js/data/cryptic-verify.js';
import { shapeClue } from '../../assets/js/core/cryptic-ai.js';

const up = s => String(s).toUpperCase().replace(/[^A-Z]/g, '');

// ---- the whole bank
ok(ALL.length >= 80, 'bank size ' + ALL.length);
ok(new Set(ALL.map(c => up(c.answer))).size === ALL.length, 'every answer is different');
ok(ALL.every(c => c.clue && c.answer && c.def && c.nudge && c.wordplay), 'every clue has clue, answer, definition, nudge and explanation');
ok(ALL.every(c => (String(c.enumeration).match(/\d+/g) || []).reduce((a, b) => a + +b, 0) === up(c.answer).length), 'every enumeration matches its answer');
ok(ALL.every(c => c.device in DEVICES), 'every device has a teaching entry (a missing one crashed the done screen once)');
ok(ALL.every(c => String(c.clue).includes(c.enumeration)), 'every clue ends with its enumeration');
const withParse = ALL.filter(c => c.parse && Object.keys(c.parse).length);
ok(withParse.length >= 30, withParse.length + ' clues carry structured wordplay');
const failing = withParse.map(c => [c, verifyClue(c)]).filter(([, v]) => !v.ok);
ok(failing.length === 0, 'every structured clue passes the verifier' + failing.map(([c, v]) => ` [${c.answer}: ${v.reasons.join('; ')}]`).join(''));
ok(ALL.every(c => [1, 2, 3].includes(levelOf(c))), 'every clue has a level 1-3');

// ---- the verifier catches what the model gets wrong
const good = { clue:'Odd stare at the front of a boat (4)', answer:'STEM', enumeration:'(4)', def:'front of a boat', device:'anagram', parse:{ fodder:'MEST', indicator:'Odd' } };
ok(!verifyClue({ ...good, parse:{ fodder:'MESTS', indicator:'Odd' } }).ok, 'rejects an anagram with a missing/extra letter');
ok(!verifyClue({ ...good, enumeration:'(5)', clue:'Odd stare at the front of a boat (5)' }).ok, 'rejects a wrong enumeration');
ok(!verifyClue({ ...good, device:'wizardry' }).ok, 'rejects an unknown device');
ok(!verifyClue({ ...good, def:'something else entirely' }).ok, 'rejects a definition that is not in the clue');
ok(!verifyClue(null).ok && !verifyClue({}).ok && !verifyClue({ clue:5 }).ok, 'garbage input is rejected, not thrown');
const hid = { clue:'Some of the fabric is a lovely thing (4)', answer:'WOOL', enumeration:'(4)', def:'a lovely thing', device:'hidden', parse:{ fodder:'fabric is', indicator:'Some of' } };
ok(!verifyClue(hid).ok, 'rejects a hidden word that is not actually hidden');
const charade = { clue:'Dog lead sounds like a pet (6)', answer:'CARPET', enumeration:'(6)', def:'a pet', device:'charade', parse:{ parts:['CAR','PET'] } };
ok(verifyClue(charade).ok || verifyClue(charade).reasons.length > 0, 'charade is checked (no crash)');
ok(!verifyClue({ ...charade, parse:{ parts:['CAT','PET'] } }).ok, 'rejects a charade whose parts do not spell the answer');
ok(!verifyClue({ ...charade, parse:{ parts:['CARPET'] } }).ok, 'a charade needs two or more parts');
ok(DEVICE_LEVEL.compound === 3 && DEVICE_LEVEL.anagram === 1, 'device levels');

// ---- picking the next level from how it has been going
const h = (n, f) => Array.from({ length:n }, (_, i) => ({ level:1, solved:true, hints:0, ...f(i) }));
ok(recommendLevel([]) === 1 && recommendLevel(h(2, () => ({}))) === 1, 'too little history: start easy');
ok(recommendLevel(h(6, () => ({}))) === 2, 'six clean solves: step up');
ok(recommendLevel(h(6, () => ({ level:3 }))) === 3, 'already at 3 stays at 3');
ok(recommendLevel(h(6, () => ({ level:2, solved:false, revealed:true }))) === 1, 'giving up repeatedly: step down');
ok(recommendLevel(h(6, i => ({ level:2, hints: i % 2 }))) === 2, 'mixed: stay put');

// ---- the daily clue
ok(clueFor('2026-09-30').answer === clueFor('2026-09-30').answer, 'a date always gives the same clue');
ok(clueIndexFor('2026-09-30') === clueIndexFor('2026-09-30'), 'index is stable');
const seen = new Set(); for (let i = 0; i < ALL.length; i++){ const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10); seen.add(clueIndexFor(d)); }
ok(seen.size === ALL.length, 'the next ' + ALL.length + ' days are ' + ALL.length + ' different clues (' + seen.size + ')');
ok(ALL.includes(clueFor('2030-01-01')) && ALL.includes(clueFor('2020-01-01')), 'any date, past or future, gives a real clue');
ok(clueFor('2026-09-30').answer === CLUES[clueIndexFor('2026-09-30')].answer, 'dates up to the cutoff keep the original mapping');

// ---- shaping what a model sends back
const s = shapeClue({ clue:'Odd stare at the front of a boat', answer:'stem!', def:'front of a boat', parse:{ fodder:'MEST', indicator:'Odd' } }, 'anagram', 1);
ok(s.answer === 'STEM' && s.enumeration === '(4)' && s.clue.endsWith('(4)') && s.ai === true, 'answer upper-cased, enumeration appended, marked as AI');
ok(shapeClue(null, 'anagram', 1) === null && shapeClue({}, 'anagram', 1) === null && shapeClue({ answer:'X' }, 'anagram', 1) === null, 'unusable replies give null');
done('cryptic');
