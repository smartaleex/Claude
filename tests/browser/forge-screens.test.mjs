/* The Training screens that are not the live session: Goal, History, the
   settings and timer sheets, ask-the-coach, ticking a day off, finishing a
   session. Written to pin behaviour before forge.js was split into modules. */
import { launch, open, go, ok, done, forgeSeed, dayKey, enableAI, stubGemini, tapEl } from '../lib.mjs';

const { b, p, errs, url } = await launch();
const sessions = {
  a:{ id:'a', day:'d1', dayKey:dayKey(1), sets:{ '0-0':[{ w:45 }, { w:45 }, { w:40 }] }, done:true, mins:42 },
  b:{ id:'b', day:'d2', dayKey:dayKey(3), sets:{}, done:true, quick:true },
  c:{ id:'c', day:'d3', dayKey:dayKey(6), sets:{ '0-0':[{}, {}] }, done:true },
};
await open(p, url, {
  'alexhq:forge': forgeSeed({ sessions }),
  'alexhq:fuel': { targets:{ kcal:2800 }, days:{}, weights:{ [dayKey(21)]:72.0, [dayKey(1)]:73.5 } },
});
await go(p, 'forge');
const text = () => p.$eval('#view', e => e.innerText);
const sheet = () => p.$eval('.sheet.on', e => e.innerText);
const tab = async v => { await p.click(`[data-act="tab"][data-v="${v}"]`); await p.waitForTimeout(450); };

// ---- Plan
let t = await text();
ok(/Up next/i.test(t) && /Phase 2/.test(t), 'plan: up-next hero and phase');
ok(/Pick today's session/i.test(t) && /Back \+ Biceps/.test(t) && /Chest \+ Triceps/.test(t) && /Legs \+ Core/.test(t) && /Shoulders \+ Arms/.test(t), 'plan: all four days listed');
ok(/How to progress/i.test(t), 'plan: progression rules');
ok(/1 of 4 sessions done this week|0 of 4|2 of 4/.test(t), 'plan: weekly count (' + (t.match(/\d of \d sessions[^\n]*/) || [''])[0] + ')');

// ---- Goal
await tab('goal');
t = await text();
ok(/The goal/i.test(t) && /73\.5/.test(t) && /72/.test(t) || /73\.5/.test(t), 'goal: current weight from Food');
ok(/Rate of gain/i.test(t) && /kg\/week/.test(t), 'goal: rate of gain once there are two weigh-ins');
ok(/What actually closes the gap/i.test(t) && /Side & rear delts/i.test(t), 'goal: the reasoning is shown');
ok(/Weekly volume/i.test(t) && /Front delts/.test(t) && /Side delts/.test(t), 'goal: weekly volume lists front delts and side delts');
ok(/Back on track/i.test(t) && /days since your last session|in a rhythm/i.test(t), 'goal: back-on-track card');
ok(/Ask about form or a swap/i.test(t), 'goal: ask button');
ok(/Why this program|Why the program|reason/i.test(t) || /Phase 2/.test(t), 'goal: program reasoning section present');

// ---- History
await tab('log');
t = await text();
ok(/Sessions all time/i.test(t) && /\b3\b/.test(t), 'history: counts finished sessions (3)');
ok(/Back \+ Biceps/.test(t) && /Chest \+ Triceps/.test(t) && /Legs \+ Core/.test(t), 'history: each finished session is listed');
ok(/130kg total/.test(t), 'history: total weight lifted adds up (45+45+40 = 130kg)');
ok(/Ticked off/.test(t), 'history: a ticked-off day says so');
ok(/42 min/.test(t), 'history: duration shown');
ok(/2 sets/.test(t), 'history: set counts');

// ---- ticking a day off and undoing it
await tab('plan');
const before = (await text()).match(/(\d) of 4 sessions/)[1];
await tapEl(p, '[data-act="tick"][data-d="d4"]'); await p.waitForTimeout(400);
ok((await text()).match(/(\d) of 4 sessions/)[1] === String(+before + 1), 'tick: a quick tick counts as a session');
ok(await p.$('[data-act="undo"][data-d="d4"]') !== null, 'tick: an undo control appears');
await tapEl(p, '[data-act="undo"][data-d="d4"]'); await p.waitForTimeout(400);
ok((await text()).match(/(\d) of 4 sessions/)[1] === before, 'tick: undo takes it back');

// ---- settings sheet
await p.click('[data-act="settings"]'); await p.waitForTimeout(450);
let s = await sheet();
ok(/Training settings/i.test(s) && /Leg day/i.test(s) && /Comeback ramp/i.test(s) && /Cable and machine labels/i.test(s), 'settings: legs, comeback ramp, cable labels');
ok(/Phase 1/.test(s) && /Phase 2/.test(s) && /Phase 3/.test(s), 'settings: phases');
await p.click('.sheet.on [data-act="setblock"][data-i="2"]'); await p.waitForTimeout(500);
ok(/Phase 3/.test(await text()) && /Width Peak/.test(await text()), 'settings: switching phase changes the plan');
await p.click('[data-act="settings"]'); await p.waitForTimeout(400);
await p.click('.sheet.on [data-act="setblock"][data-i="1"]'); await p.waitForTimeout(500);
ok(/Specialisation/.test(await text()), 'settings: and back');
await p.click('[data-act="settings"]'); await p.waitForTimeout(400);
await p.click('.sheet.on [data-act="restart"]'); await p.waitForTimeout(400);
ok(/week 1 of 8/.test(await text()), 'settings: restarting the phase clock resets to week 1');

// ---- ask the coach (offline answer, then AI)
await tab('goal');
await p.click('[data-act="advice"]'); await p.waitForTimeout(400);
ok(/Ask about training/.test(await sheet()), 'advice: sheet opens');
await p.click('.sheet.on [data-act="go"]'); await p.waitForTimeout(200);
ok(/Type a question/i.test(await p.$eval('body', e => e.innerText)), 'advice: an empty question is refused');
await p.fill('#q', 'My shoulder clicks on incline press'); await p.click('.sheet.on [data-act="go"]'); await p.waitForTimeout(900);
ok(/standing rules|neutral grip/i.test(await p.$eval('#ans', e => e.innerText)), 'advice: with no AI, the offline rules answer');
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);
await enableAI(p);
const seen = await stubGemini(p, () => ({ answer:'Swap to the machine press and keep a neutral grip.', swaps:[{ instead:'Incline DB press', use:'Incline machine press', why:'Fixed path.' }] }));
await p.click('[data-act="advice"]'); await p.waitForTimeout(400);
await p.fill('#q', 'Shoulder clicks'); await p.click('.sheet.on [data-act="go"]'); await p.waitForTimeout(1200);
ok(/Swap to the machine press/.test(await p.$eval('#ans', e => e.innerText)) && /Incline DB press → Incline machine press/.test(await p.$eval('#ans', e => e.innerText)), 'advice: the AI answer and swap table are shown');
ok(seen.length >= 1 && /hypermobility/i.test(seen[0]), 'advice: the prompt carries his joint constraints');
await p.click('.sheet.on [data-act="close"]'); await p.waitForTimeout(300);

// ---- a live session: timer sheet, finishing
await tab('plan');
await p.click('[data-act="start"][data-d="d1"]'); await p.waitForTimeout(500);
await tapEl(p, '[data-act="addset"]'); await p.waitForTimeout(250);
await p.click('.tm-clock'); await p.waitForTimeout(400);
s = await sheet();
ok(/Timer/.test(s) && /Auto rest timer/.test(s) && /Keep the screen on/.test(s) && /Beep when rest ends/.test(s), 'timer sheet: the three options');
await p.click('.sheet.on [data-act="tm-beep"]'); await p.waitForTimeout(300);
ok((await p.evaluate(() => JSON.parse(localStorage.getItem('alexhq:forge')).timer.beep)) === false, 'timer sheet: toggling beep is saved');
await p.click('.sheet.on [data-act="tm-restart"]'); await p.waitForTimeout(400);
await tapEl(p, '[data-act="finish"]'); await p.waitForTimeout(500);
ok(!(await p.$('[data-act="abandon"]')) && !!(await p.$('[data-act="start"]')), 'finish: back to the plan');
ok(await p.evaluate(() => { const d = document.getElementById('tmdock'); return !d || d.hidden; }), 'finish: the timer dock goes away');
await tab('log');
ok(/Sessions all time/.test(await text()) && /4/.test((await text()).match(/Sessions all time[\s\S]{0,12}/)?.[0] || '') || /Back \+ Biceps/.test(await text()), 'finish: the session shows up in History');

// ---- exiting a session without finishing
await tab('plan');
await p.click('[data-act="start"][data-d="d2"]'); await p.waitForTimeout(500);
await tapEl(p, '[data-act="abandon"]'); await p.waitForTimeout(400);
ok(!!(await p.$('[data-act="start"]')) && !(await p.$('[data-act="abandon"]')), 'exit: leaves the session');
ok(errs.length === 0, 'no script errors ' + (errs[0] || ''));
await b.close();
done('training screens');
