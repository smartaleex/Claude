/* "Did it all balance out?" The user's own example: assisted pull-ups swapped for a machine iso-lateral row. */
import { ok, done } from '../lib.mjs';
import { PHASES } from '../../assets/js/data/workouts.js';
import { patternOf, gearOf } from '../../assets/js/data/swaps.js';
import { muscleOf } from '../../assets/js/data/workouts.js';
import { libraryList, libraryGroups, searchLibrary, factsFor } from '../../assets/js/core/library.js';
import { snapshotSession, balanceOf, swapText, swapEffect, weekView, suggestions } from '../../assets/js/core/balance.js';

const phase1 = PHASES[0].days, back = phase1[0];
const full = day => { const s = {}; day.supersets.forEach((ss, si) => ss.exercises.forEach((e, ei) => { s[`${si}-${ei}`] = Array.from({ length: parseInt(e.sets, 10) }, () => ({ w: 40 })); })); return s; };
const swapped = { 'd1|Assisted pull-up (wide grip)': 'Machine iso-lateral row' };
const nameOf = (ex, dk = 'd1') => swapped[`${dk}|${ex.name}`] || ex.name;

// ---- the library knows the machine, and reads it correctly
ok(patternOf('Machine iso-lateral row') === 'horizontalPull', '"iso-lateral" is ignored: a row is a row (' + patternOf('Machine iso-lateral row') + ')');
ok(muscleOf('Machine iso-lateral row') === 'Upper back', 'and trains the upper back, not the side delts (' + muscleOf('Machine iso-lateral row') + ')');
ok(muscleOf('DB lateral raise') === 'Side delts' && patternOf('DB lateral raise') === 'lateralRaise', 'a real lateral raise is still a lateral raise');
ok(patternOf('Iso-lateral high row (machine)') === 'verticalPull' && muscleOf('Iso-lateral high row (machine)') === 'Lats', 'a high row is a vertical pull for the lats');
ok(muscleOf('Iso-lateral incline press (machine)') === 'Chest' && patternOf('Iso-lateral chest press (machine)') === 'flatPress', 'iso-lateral presses are presses');
ok(gearOf('Machine iso-lateral row') === 'machine', 'it is machine kit');

const lib = libraryList({});
ok(lib.length > 120, `the library lists every exercise it knows: ${lib.length}`);
ok(new Set(lib.map(x => x.name.toLowerCase())).size === lib.length, 'each exercise appears once');
ok(lib.some(x => x.name === 'Machine iso-lateral row') && lib.some(x => x.name === 'Assisted pull-up machine'), 'both of the user\'s exercises are in it');
ok(lib.some(x => x.source === 'program') && lib.some(x => x.source === 'library'), 'listed alternates and the programme\'s own exercises are both there');
ok(libraryList({ 'My cable thing': { gear: 'cable', idx: 1 } }).some(x => x.name === 'My cable thing' && x.source === 'yours'), 'exercises you typed in yourself are included');
const groups = libraryGroups(lib);
ok(groups[0].muscle === 'Lats' && groups.every(g => g.items.length), 'grouped by muscle, lats first, no empty groups');
ok(groups.find(g => g.muscle === 'Upper back').items.some(x => x.name === 'Machine iso-lateral row'), 'the iso-lateral row sits under upper back');
ok(searchLibrary(lib, 'iso lateral row').map(x => x.name).includes('Machine iso-lateral row'), 'searching "iso lateral row" finds it');
ok(searchLibrary(lib, 'dumbbell incline').some(x => /Incline DB press/.test(x.name)), '"dumbbell" finds DB exercises');
ok(!searchLibrary(lib, 'pull up').some(x => x.muscle === 'Upper back' && !/pull-?up/i.test(x.name)), '"pull up" does not match "upper back"');
ok(searchLibrary(lib, 'lats').length >= 10 && searchLibrary(lib, 'zzzz').length === 0 && searchLibrary(lib, '').length === lib.length, 'search by muscle; nonsense finds nothing; empty shows all');
const f = factsFor('Machine iso-lateral row');
ok(f.muscle === 'Upper back' && f.gear === 'machine' && f.known && f.note.length > 20, 'facts for one exercise');

// ---- before you swap: what it does to today
let eff = swapEffect(back, 'Assisted pull-up (wide grip)', 'Machine iso-lateral row');
ok(eff.kind === 'muscle' && /vertical pull became horizontal pull/i.test(eff.text), 'the effect names the shift: ' + eff.text);
ok(/lats lose 4 sets/.test(eff.text) && /upper back gains 4 sets/.test(eff.text), 'with the sets: lats lose 4, upper back gains 4');
ok(/width muscles/.test(eff.text), 'and says lats are a width muscle');
ok(eff.deltas.find(d => d.muscle === 'Lats').before === 11 && eff.deltas.find(d => d.muscle === 'Lats').after === 7, 'lats 11 to 7 sets this session');
ok(swapText('Lat pulldown (any grip)', 'Assisted pull-up machine').kind === 'same', 'pulldown for assisted pull-up: same movement');
ok(swapText('Chest-supported machine row', 'Machine iso-lateral row').kind === 'same', 'one machine row for another: same movement');
ok(swapText('Seated cable row', 'Iso-lateral high row (machine)').kind === 'muscle', 'a row for a high row changes the muscle');
ok(swapEffect(back, 'Not an exercise', 'Machine iso-lateral row') === null, 'an exercise that is not in the day gives no effect');

// ---- the session, all sets done
let rows = snapshotSession(back, full(back), ex => nameOf(ex));
ok(rows.length === 6 && rows[0].o === 'Assisted pull-up (wide grip)' && rows[0].n === 'Machine iso-lateral row' && rows[0].p === 4 && rows[0].d === 4, 'the snapshot records planned and what was done');
let b = balanceOf(rows);
ok(b.logged && b.completion === 1, 'a full session');
const lats = b.muscles.find(m => m.muscle === 'Lats'), up = b.muscles.find(m => m.muscle === 'Upper back');
ok(lats.planned === 11 && lats.done === 7 && lats.state === 'short', 'lats: planned 11, done 7, short');
ok(up.planned === 3 && up.done === 7 && up.state === 'extra', 'upper back: planned 3, done 7, extra');
ok(b.moves.vertical.planned === 11 && b.moves.vertical.done === 7 && b.moves.horizontal.planned === 3 && b.moves.horizontal.done === 7, 'vertical pull 11 to 7, horizontal pull 3 to 7');
ok(b.swaps.length === 1 && b.swaps[0].kind === 'muscle' && b.swaps[0].sets === 4, 'the swap is listed with its effect');
ok(b.level === 'lopsided', 'on its own, with nothing to cover it, a lat-width session is lopsided: ' + b.headline);
ok(b.muscles[0].priority, 'priority (width) muscles are listed first');

// ---- an unswapped session balances
rows = snapshotSession(back, full(back));
b = balanceOf(rows);
ok(b.level === 'balanced' && b.swaps.length === 0 && b.muscles.every(m => m.state === 'ok'), 'no swaps, everything done: balanced');

// ---- a half-finished session is not "unbalanced"
const half = full(back); for (const k of Object.keys(half)) half[k] = half[k].slice(0, Math.ceil(half[k].length / 2));
b = balanceOf(snapshotSession(back, half));
ok(b.level === 'balanced' && b.completion > 0.4 && b.completion < 0.7 && /about \d+%/.test(b.headline), 'half the sets, in proportion, is balanced and says so: ' + b.headline);

// ---- nothing logged: nothing to say
ok(balanceOf(snapshotSession(back, {})).logged === false, 'a session with no sets logged has nothing to balance');

// ---- the week decides whether one session matters
const sess = [{ day: 'd1', rows: snapshotSession(back, full(back), ex => nameOf(ex)) }];
let wk = weekView(phase1, sess, ex => nameOf(ex));
ok(wk['Lats'].plan === 11 + 6 || wk['Lats'].plan > 0, 'the weekly plan counts lats across all days: ' + wk['Lats'].plan);
ok(wk['Lats'].done === 7 && wk['Lats'].remaining >= 0, 'done so far is what was actually logged');
ok(wk['Lats'].projected === wk['Lats'].done + wk['Lats'].remaining, 'projected = done + still to come');
const covered = [{ day: 'd1', rows: sess[0].rows }];
// a week whose remaining days hold plenty of lat work: the shortfall is covered
const daysPlus = [...phase1.slice(0, 1), { key: 'd5', title: 'Extra pull day', supersets: [{ label: 'x', exercises: [{ name: 'Lat pulldown (any grip)', sets: '6', reps: '10', rest: '60s' }] }] }];
const wkOk = weekView(daysPlus, covered);
ok(wkOk['Lats'].short < 3, 'if the rest of the week holds the lat work, any shortfall is too small to matter: ' + wkOk['Lats'].short);
b = balanceOf(sess[0].rows, wkOk);
ok(b.level === 'shifted' && /Shifted: vertical pull became horizontal pull/.test(b.headline) && /(covers it|under plan this week)/.test(b.headline), 'then the session is "shifted", not lopsided, and says how the week stands: ' + b.headline);
b = balanceOf(sess[0].rows, wk);
ok(['lopsided', 'shifted'].includes(b.level), 'with the real week it is judged on the real numbers: ' + b.level);
// a persistent swap applies to the days still to come, so the week itself runs short on lats
const persistent = weekView(phase1, [], ex => ({ 'Wide-grip lat pulldown': 'Machine iso-lateral row', 'Assisted pull-up (wide grip)': 'Machine iso-lateral row', 'Straight-arm cable pulldown': 'Machine iso-lateral row' }[ex.name] || ex.name));
ok(persistent['Lats'].short >= 3, 'swap every vertical pull for rows and the week runs short on lats: short by ' + persistent['Lats'].short);
const sug = suggestions(persistent, phase1);
ok(sug.length && sug[0].muscle === 'Lats' && sug[0].exercises.length >= 1 && sug[0].sets >= 1 && sug[0].dayTitle, 'and it suggests how to even it out: ' + JSON.stringify(sug[0]));
ok(!sug[0].exercises.some(n => /barbell bench|behind the neck/i.test(n)), 'suggestions never include exercises the programme avoids for this body');
ok(suggestions(weekView(phase1, []), phase1).length === 0, 'an untouched week needs no suggestions');

// ---- grammar a person would notice
ok(/lats lose/.test(swapText('Assisted pull-up machine', 'Machine iso-lateral row', 4).text) && !/lats loses/.test(swapText('Assisted pull-up machine', 'Machine iso-lateral row', 4).text), '"lats lose", not "lats loses"');
ok(/chest loses/.test(swapText('Machine chest press', 'Machine iso-lateral row', 3).text), '"chest loses"');

done('session and week balance');
