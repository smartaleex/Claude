import { ok, done } from '../lib.mjs';
import { readContext, quoteWeight, truthWeight, choose, hide, idOf, pickDaily, dailyFor, vetJoke } from '../../assets/js/core/mind.js';
import { JOKES, QUOTES, TRUTHS, DAILY } from '../../assets/js/data/lift.js';
const T='2026-09-30', Y='2026-09-29';

ok(readContext({}).flags.length===0,'empty ctx');
ok(readContext({day:{sleep:{[T]:{hours:4}}},todayKey:T,yesterdayKey:Y}).flags.includes('shortsleep'),'short sleep');
ok(readContext({day:{mood:{[Y]:{m:-2,e:0}}},todayKey:T,yesterdayKey:Y}).mood==='low','low');
ok(readContext({day:{mood:{[Y]:{m:-2,e:3}}},todayKey:T,yesterdayKey:Y}).mood==='mixed','mixed');
ok(readContext({day:{mood:{[T]:{m:3,e:3}}},todayKey:T,yesterdayKey:Y}).mood==='high','high');
ok(readContext({fuel:{days:{[Y]:[{kcal:900}]},targets:{kcal:2800}},todayKey:T,yesterdayKey:Y}).food==='low','low food');
ok(readContext({fuel:{days:{[Y]:[{kcal:80}]},targets:{kcal:2800}},todayKey:T,yesterdayKey:Y}).food==='unknown','forgot to log is not low food');
ok(readContext({fuel:{days:{[Y]:[{kcal:2600}]},targets:{kcal:2800}},todayKey:T,yesterdayKey:Y}).food==='ok','ok food');

const bad=/Martin Luther King|Jamie Anderson|Rumi|Be tolerant|nothing is more honourable/i;
ok(!QUOTES.some(q=>bad.test(q.a+q.t)),'dropped dubious quotes gone');
ok(new Set(QUOTES.map(q=>q.t)).size===QUOTES.length,'no dup quotes');
ok(QUOTES.every(q=>q.tags?.length && q.a),'all quotes tagged & attributed');
ok(DAILY.length>=25,'enough daily lines '+DAILY.length);
ok(new Set(JOKES).size===JOKES.length,'no dup jokes');
ok(JOKES.every(j=>vetJoke(j,[]).ok),'every stored joke passes its own screen');

const rnd=(seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32))(7);
const sample=(ctx,n=600)=>{const c={};for(let i=0;i<n;i++){const q=choose(QUOTES,{kind:'k'+i,mem:{recent:{},hidden:[]},textOf:q=>q.t,weightOf:q=>quoteWeight(q,ctx),rand:rnd});q.tags.forEach(t=>c[t]=(c[t]||0)+1);}return c;};
const base=sample({flags:[]}), hi=sample({flags:['high']}), lo=sample({flags:['low']});
const share=(c,ts)=>ts.reduce((n,t)=>n+(c[t]||0),0)/Object.values(c).reduce((a,b)=>a+b,0);
ok(share(hi,['action','courage','effort'])<share(base,['action','courage','effort'])*0.4,'elevated: hustle way down');
ok(share(hi,['restraint','rest','patience'])>share(base,['restraint','rest','patience'])*1.5,'elevated: restraint up');
ok(share(lo,['endure','selfcompassion','present'])>share(base,['endure','selfcompassion','present'])*1.3,'low: endure up');
ok(share(lo,['action','effort'])<share(base,['action','effort'])*0.5,'low: hustle down');
const food=sample({flags:['lowfood']});
ok((food.body||0)>(base.body||0)*1.8,'low food: body lines up');

const tw=(flags)=>TRUTHS.filter(t=>truthWeight(t,{flags})>0);
ok(tw([]).every(t=>!t.when),'no flags -> only unconditional truths');
ok(tw(['high']).some(t=>t.when?.includes('high')),'high -> high truths eligible');
ok(!tw(['high']).some(t=>t.when?.includes('low')),'high never gets low truths');
ok(!tw(['lowfood']).some(t=>t.when?.includes('high')),'lowfood never gets high truths');
let hiPicks=0; for(let i=0;i<300;i++){const t=choose(TRUTHS,{kind:'t',mem:{recent:{},hidden:[]},textOf:t=>t.t,weightOf:t=>truthWeight(t,{flags:['high']}),rand:rnd}); if(t.when?.includes('high'))hiPicks++;}
ok(hiPicks>200,'conditional truths dominate when they apply '+hiPicks);

const mem={recent:{},hidden:[]}; const seen=[];
for(let i=0;i<JOKES.length;i++) seen.push(choose(JOKES,{kind:'joke',mem,rand:rnd}));
const win=Math.floor(JOKES.length*0.6);
ok(new Set(seen.slice(0,win)).size===win,'no repeats within window');
hide(mem,seen[0]); ok(mem.hidden.includes(idOf(seen[0])),'hide recorded');
for(let i=0;i<400;i++) ok(choose(JOKES,{kind:'joke',mem,rand:rnd})!==seen[0],'hidden never returns');
ok(choose(['only'],{kind:'x',mem:{recent:{},hidden:[]}})==='only','single-item bank');
ok(choose([],{kind:'x',mem:{recent:{},hidden:[]}})===null,'empty bank -> null');
ok(choose(JOKES,{kind:'j',mem:{recent:{},hidden:JOKES.map(idOf)}})===null,'all hidden -> null');

const store=(()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}})();
const a=dailyFor(DAILY,T,{flags:[]},store), b=dailyFor(DAILY,T,{flags:['high']},store);
ok(a===b,'daily holds still once picked');
ok(pickDaily(DAILY,T,{flags:['low']})===pickDaily(DAILY,T,{flags:['low']}),'pickDaily deterministic');
const distinct=new Set(Array.from({length:60},(_,i)=>pickDaily(DAILY,`2026-10-${String(i%28+1).padStart(2,'0')}`,{flags:[]}).t)).size;
ok(distinct>=12,'daily varies across dates '+distinct);
const store2=(()=>{const m=new Map([['alexhq:liftmem',JSON.stringify({recent:{},hidden:[idOf(a.t)]})]]);return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}})();
ok(dailyFor(DAILY,T,{flags:[]},store2)!==a,'hidden quote is not the daily line');
const dh={hi:0,base:0}; for(let d=1;d<=28;d++){const k=`2026-10-${String(d).padStart(2,'0')}`; const H=['action','courage','effort']; if(pickDaily(DAILY,k,{flags:['high']}).tags.some(t=>H.includes(t)))dh.hi++; if(pickDaily(DAILY,k,{flags:[]}).tags.some(t=>H.includes(t)))dh.base++;}
ok(dh.hi<dh.base,'daily on elevated days has fewer hustle lines '+JSON.stringify(dh));

ok(!vetJoke('Why did the cancer patient cross the road? To get to the other side of things.',[]).ok,'blocks illness');
ok(!vetJoke('I dieted for a week and lost seven days of my life.',[]).ok,'blocks diet');
ok(!vetJoke(JOKES[0],[JOKES[0]]).ok,'blocks copy');
ok(!vetJoke('short',[]).ok,'blocks too short');
ok(vetJoke('I told the clock a joke. It said it was about time.',JOKES).ok,'allows clean new joke');

// the TikTok quotes
for (const frag of ['empathy rob people','hate the truth','negative thoughts in your head','cold water does not get warmer','Butterflies can’t see','Eventually everyone you love'])
  ok(QUOTES.some(q=>q.t.includes(frag)),'added: '+frag);
const heavy=QUOTES.find(q=>/Eventually everyone you love/.test(q.t));
ok(heavy.a.startsWith('Unknown'),'honestly attributed');
ok(!DAILY.includes(heavy),'never the line of the day');
for(const fl of [[],['low'],['high'],['mixed'],['shortsleep'],['lowfood']]) ok(quoteWeight(heavy,{flags:fl,mood:fl[0]||'unknown'})===0,'heavy line held back: '+JSON.stringify(fl));
ok(quoteWeight(heavy,{flags:[],mood:'steady',food:'ok',sleep:'ok'})>0,'shown on a logged steady day');
ok(/Orwell/.test(QUOTES.find(q=>/hate the truth/.test(q.t)).a),'Orwell misattribution flagged');
ok(QUOTES.length>=60,'quotes '+QUOTES.length);
let heavyHits=0; for(let i=0;i<2000;i++){const q=choose(QUOTES,{kind:'z'+i,mem:{recent:{},hidden:[]},textOf:q=>q.t,weightOf:q=>quoteWeight(q,{flags:['low'],mood:'low'}),rand:rnd}); if(q===heavy)heavyHits++;}
ok(heavyHits===0,'never drawn on a low day in 2000 draws');
done('mind');
