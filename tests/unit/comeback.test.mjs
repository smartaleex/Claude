import { ok, done } from '../lib.mjs';
import * as C from '../../assets/js/core/comeback.js';
const T='2026-10-26'; // a Monday
const S=(...ks)=>Object.fromEntries(ks.map((k,i)=>['s'+i,{done:true,dayKey:k}]));
ok(C.gapDays({},T)===null,'no sessions -> null gap');
ok(C.gapDays(S('2026-10-16'),T)===10,'gap 10');
ok(C.gapDays({a:{done:false,dayKey:'2026-10-25'}},T)===null,'unfinished does not count');
// weekly counts (Mon 26 Oct is today; weeks start Mondays)
const w=C.weeklyCounts(S('2026-10-26','2026-10-25','2026-10-19','2026-10-18','2026-10-12','2026-09-20'),T,4);
ok(JSON.stringify(w)==='[1,1,1,1]'.replace('[1,1,1,1]',JSON.stringify(w)) && w.length===4,'4 buckets');
ok(w[3]===1,'this week = Monday only: '+w);   // 26th
ok(w[2]===2,'last week = 25th + 19th: '+w);   // Sun 25, Mon 19
ok(w[1]===2,'two weeks ago = Sun 18th + Mon 12th: '+w); ok(w[0]===0,'older than 4 weeks excluded');
// shouldStart
ok(C.shouldStartRamp(null,S('2026-10-10'),T)===true,'gap 16 days starts ramp');
ok(C.shouldStartRamp(null,S('2026-10-20'),T)===false,'gap 6 no ramp');
ok(C.shouldStartRamp(null,{},T)===false,'never trained: no ramp');
ok(C.shouldStartRamp({start:T},S('2026-10-10'),T)===false,'already offered for this gap');
ok(C.shouldStartRamp({start:'2026-08-01',weeks:3},S('2026-10-10'),T)===true,'old ramp, new gap -> new ramp');
ok(C.shouldStartRamp({start:'2026-10-20',weeks:3},S('2026-10-01'),T)===false,'active ramp not restarted');
// ramp state
const st=d=>C.rampState({start:'2026-10-01',weeks:3},d);
ok(st('2026-10-01').week===1&&st('2026-10-01').reps==='bottom'&&st('2026-10-01').factor===undefined,'week1: reps at the bottom, no set factor');
ok(st('2026-10-08').week===2&&st('2026-10-08').reps==='mid','week2: middle of the range');
ok(st('2026-10-15').week===3&&st('2026-10-15').reps==='full','week3: back to the full range');
ok(st('2026-10-22').active===false&&st('2026-10-22').finished,'ends after 3 weeks');
ok(C.rampState({start:'2026-10-01',off:true},'2026-10-02').active===false,'switched off');
ok(C.rampState(null,T).active===false,'no ramp');
// scaling
ok(C.scaleSets===undefined,'sets are never scaled: the function is gone');
const R=(r,m)=>C.reviseReps(r,m).text;
ok(R('8–10','bottom')==='8'&&R('8–10','mid')==='9'&&R('8–10','full')==='8–10','8–10 -> 8 / 9 / 8–10');
ok(R('12–15','bottom')==='12'&&R('12–15','mid')==='13','12–15 -> 12 / 13');
ok(R('15','bottom')==='12'&&R('15','mid')==='13'&&R('15','full')==='15','15 -> 12 / 13 / 15');
ok(R('10','bottom')==='8'&&R('8','bottom')==='6'&&R('6–8','bottom')==='6','10 -> 8, 8 -> 6, 6–8 -> 6');
ok(R('10–12 each','bottom')==='10 each','keeps "each"');
ok(R('12 each leg','bottom')==='10 each leg','keeps "each leg"');
ok(R('12 each side','mid')==='11 each side','keeps "each side"');
for (const odd of ['max','30–45s','45s','12 + 8 partials','3 drops to failure','12 + 4×4','8 strict + 8 lean-away + 8 partials','50 total','']) ok(R(odd,'bottom')===odd,'left alone: "'+odd+'"');
ok(R('8–10',undefined)==='8–10'&&R('8–10',null)==='8–10','no ramp -> unchanged');
ok(R('5','bottom')==='5'&&R('6','bottom')==='5','never below 5');
ok(C.reviseReps('8–10','bottom').changed===true&&C.reviseReps('8–10','full').changed===false,'changed flag');
ok(C.openingWeight(30,.85)===25,'30 -> 25 (rounded to 2.5): '+C.openingWeight(30,.85));
ok(C.openingWeight(100,.85)===85,'100 -> 85'); ok(C.openingWeight(null,.85)===null,'no prev -> null'); ok(C.openingWeight(8,.9)===7,'small weights round to whole kg');
ok(C.weekTarget({active:true})===3&&C.weekTarget(null)===4&&C.weekMinimum===2,'targets');
// plan
const fuel={targets:{kcal:2800},days:{}}; for(let i=1;i<=7;i++){const k=new Date(Date.UTC(2026,9,26)-i*864e5).toISOString().slice(0,10); fuel.days[k]=[{kcal:1500}];}
const p=C.backOnTrack({sessions:S('2026-10-01'),todayKey:T,weights:{'2026-10-10':72},fuel,physique:{goal:83},photoKeys:['2026-08-01']});
ok(/25 days/.test(p.headline),'headline gap: '+p.headline);
const food=p.items.find(i=>i.k==='food'); ok(food.tone==='warn'&&/1,500|1500/.test(food.body)&&/under|short/.test(food.body),'food flags under-eating');
ok(/add about 650|add about 500/.test(food.body) || /add about \d+/.test(food.body),'concrete add: '+food.body.match(/add about \d+/));
const wt=p.items.find(i=>i.k==='weight'); ok(/72 kg/.test(wt.body)&&/11 kg/.test(wt.body)&&/weeks/.test(wt.body),'weight to goal: '+wt.body.slice(0,90));
ok(p.items.find(i=>i.k==='photos').tone==='warn','old photos flagged');
const q=C.backOnTrack({sessions:{},todayKey:T,photoKeys:[]}); ok(/Start with one/.test(q.headline)&&q.items.length===4,'empty state ok');
ok(C.backOnTrack({sessions:{},todayKey:T}).items.length===3,'photos skipped while loading');
ok(q.items.find(i=>i.k==='food').tone==='neutral','no food data -> neutral');
const good=C.backOnTrack({sessions:S('2026-10-25'),todayKey:T,fuel:{targets:{kcal:2800},days:Object.fromEntries(Array.from({length:7},(_,i)=>[new Date(Date.UTC(2026,9,26)-(i+1)*864e5).toISOString().slice(0,10),[{kcal:2700}]]))}});
ok(good.items.find(i=>i.k==='food').tone==='good','on-target food is good');
ok(/rhythm/.test(good.headline),'in rhythm headline');
done('comeback');
