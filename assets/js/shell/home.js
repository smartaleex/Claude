/* ============================================================
   Shell: the HQ home screen.

   The point of HQ is answering "what needs me today" in one glance, so each
   tool exports summary() and we show only what is live. One function per
   block of the page; homeHTML() at the bottom lists them in order.
   ============================================================ */

import { aiStatus } from '../core/ai.js';
import { today } from '../core/store.js';
import { esc, toast, bindActions, haptic } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { openLift } from '../core/lift.js';
import { DAILY } from '../data/lift.js';
import { readContext, dailyFor } from '../core/mind.js';
import { APPS, appOrder } from './registry.js';
import { navigate } from './router.js';
import { loadItems, openItems, tickItem, openDump } from './dump.js';
import { openSettings } from './settings.js';
import { openAISetup } from './ai-setup.js';

/* The line of the day leans on last night's sleep and yesterday's mood
   and food (see core/mind.js), then holds still for the date. */
function todaysLine(){
  try{
    const read = k => { try { return JSON.parse(localStorage.getItem('alexhq:' + k) || 'null'); } catch { return null; } };
    const d = new Date(), y = new Date(d.getTime() - 864e5);
    const key = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    const ctx = readContext({ day:read('day'), fuel:read('fuel'), todayKey:key(d), yesterdayKey:key(y), hour:d.getHours() });
    return dailyFor(DAILY, today(), ctx);
  }catch{ return DAILY[0]; }
}

/* ---------------- blocks, top to bottom ---------------- */

function headerHTML(now){
  const hour = now.getHours();
  const greet = hour < 5 ? 'Still up' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">${esc(now.toLocaleDateString('en-AU',{weekday:'long', day:'numeric', month:'long'}))}</div>
        <h1 class="page-h1">${greet}, Alex</h1>
      </div>
      <button class="chip" data-act="settings" aria-label="Settings">${icon('settings',18)}</button>
    </div>
  </header>`;
}

/* Today's cryptic, front and centre: the clue itself, so it can be read
   (and mulled over) without opening anything. */
function crypticCardHTML(cards){
  const cx = cards.find(c => c.id === 'cryptic');
  if (!cx) return '';
  const done = cx.headline === 'Solved' || cx.headline === 'Answer shown';
  return `
  <div class="card in" data-go2="cryptic" style="margin-top:14px;padding:17px 18px;cursor:pointer">
    <div class="spread">
      <div class="tiny muted lbl" >Today's cryptic</div>
      <span class="badge ${done ? 'good' : 'accent'}">${done ? esc(cx.headline) : 'Unsolved'}</span>
    </div>
    <div class="disp" style="font-size:18px;line-height:1.4;margin-top:9px">
      ${esc(cx.detail)}
    </div>
    <div class="tiny" style="margin-top:9px;color:var(--accent-1);font-weight:700">${done ? 'Practise another →' : 'Tap to solve →'}</div>
  </div>`;
}

/* One instruction, not six dashboards. Every tool nominates what it would
   most like done and how loudly; the loudest wins and the rest stay quiet.
   On a flat day a single sentence is actionable where a wall of numbers is
   just evidence that you are behind. */
function nowCardHTML(cards){
  const top = cards.map(c => c.next).filter(Boolean).sort((a,b) => b.urgency - a.urgency)[0];
  if (!top) return `
  <div class="nowcard in calm" style="margin-top:16px" data-act="lift">
    <div class="nowcard-ico">${icon('check',22)}</div>
    <div class="grow">
      <div class="tiny lbl" style="opacity:.75">Right now</div>
      <div class="disp" style="font-size:19px;margin-top:3px">Nothing needs you</div>
      <div style="font-size:13px;opacity:.85;margin-top:3px">Everything due today is logged.</div>
    </div>
  </div>`;
  return `
  <div class="nowcard in" style="margin-top:16px" data-act="${esc(top.act)}">
    <div class="nowcard-ico">${icon(top.icon || 'spark', 22)}</div>
    <div class="grow" style="min-width:0">
      <div class="tiny lbl" style="opacity:.75">Right now</div>
      <div class="disp" style="font-size:19px;margin-top:3px">
        ${esc(top.label)}
      </div>
      <div style="font-size:13px;opacity:.85;margin-top:3px" class="trunc">${esc(top.sub || '')}</div>
    </div>
    <span style="opacity:.8;flex:none">${icon('chevron',18)}</span>
  </div>`;
}

/* Three things within reach at all times. These are the ones that fall
   over first in a bad stretch: eating, remembering, and mood. */
function quickRowHTML(){
  return `
  <div class="quickrow in in-2">
    <button class="quick" data-act="lift">
      <span class="qi">${icon('spark',19)}</span>
      <span>Lift me</span>
    </button>
    <button class="quick" data-act="fuel-snap">
      <span class="qi">${icon('camera',19)}</span>
      <span>Snap food</span>
    </button>
    <button class="quick" data-act="dump">
      <span class="qi">${icon('note',19)}</span>
      <span>Brain dump</span>
    </button>
  </div>`;
}

function onMindHTML(todo){
  if (!todo.length) return '';
  return `
  <div class="sec">On your mind</div>
  <div class="stack" style="gap:8px">
    ${todo.slice(0, 6).map(i => `
      <button class="rowcard" data-act="tick" data-id="${i.id}" style="width:100%;text-align:left;padding:12px 15px">
        <span style="width:24px;height:24px;border-radius:var(--r-av);flex:none;background:var(--bg-sunk);
                     box-shadow:var(--clay-in)"></span>
        <span class="grow" style="font-size:14.5px">${esc(i.text)}</span>
      </button>`).join('')}
    ${todo.length > 6 ? `<div class="tiny muted center">and ${todo.length - 6} more</div>` : ''}
  </div>`;
}

/* Four tiles, fixed order, always the same shape, so you learn where to
   look instead of reading it fresh each time. Numbers only; anything that
   needs a sentence belongs further down the page. */
function glanceHTML(cards){
  const get = id => cards.find(c => c.id === id) || {};
  const fuel = get('fuel'), forge = get('forge'), clear = get('clear'), day = get('day');

  const items = [
    // One short word each — anything longer ellipsises at four across.
    { label:'Eaten', value: (fuel.headline || '—').split('/')[0].trim(), sub:'kcal',   go:'fuel' },
    { label:'Gym',   value: (forge.badge || '—'),                        sub:'wk',     go:'forge' },
    { label:'Done',  value: (day.headline || '—').replace(' done','').replace(' of ','/'), sub:'anchors', go:'day' },
    { label:'Zyn',   value: (clear.detail || '').match(/(\d+)\s*pouch/)?.[1] ?? '—', sub:'today', go:'clear' },
  ];

  return `
  <div class="glance in in-2">
    ${items.map(i => `
    <button class="gtile" data-go2="${i.go}">
      <span class="tiny lbl">${esc(i.label)}</span>
      <b class="disp" style="font-size:19px;">${esc(i.value)}</b>
      <span class="tiny muted">${esc(i.sub)}</span>
    </button>`).join('')}
  </div>`;
}

function lineOfTheDayHTML(){
  const line = todaysLine();
  return `
  <div class="sec">Today</div>
  <div class="card in" data-act="daily" style="padding:17px 18px">
    <div class="tiny muted lbl" >
      Something to sit with
    </div>
    <div style="font-size:15.5px;line-height:1.6;margin-top:8px">${esc(line.t)}</div>
    <div class="tiny muted" style="margin-top:8px">— ${esc(line.a)}</div>
    ${line.on ? `<div class="tiny" style="margin-top:8px;line-height:1.55;opacity:.85">${esc(line.on)}</div>` : ''}
  </div>`;
}

function dayHeroHTML(dayCard){
  if (!dayCard) return '';
  return `
  <div class="hero in" style="margin-top:11px">
    <div class="spread" style="align-items:flex-start" data-go2="day">
      <div class="grow">
        <div class="disp" style="font-size:26px">
          ${esc(dayCard.headline)}
        </div>
        <div class="hero-cap" style="font-size:13.5px">${esc(dayCard.detail)}</div>
      </div>
      <span style="opacity:.8">${icon('chevron',20)}</span>
    </div>
    ${dayCard.pips?.length ? `
      <div class="chips scroll" style="margin-top:14px;padding-top:14px;border-top:1px solid color-mix(in srgb, currentColor 24%, transparent)">
        ${dayCard.pips.map(pp => `<button data-act="day-anchor" data-id="${pp.id}"
          style="border-radius:var(--r-ctl);padding:9px 14px;font-size:12.5px;font-weight:700;white-space:nowrap;
                 background:${pp.on ? 'var(--hero-fg)' : pp.partial ? 'color-mix(in srgb, currentColor 38%, transparent)' : 'color-mix(in srgb, currentColor 16%, transparent)'};
                 color:${pp.on ? 'var(--hero-bg)' : 'inherit'};
                 ">
          ${pp.on ? '&#10003; ' : ''}${esc(pp.label)}</button>`).join('')}
      </div>` : ''}
  </div>`;
}

function aiNudgeHTML(){
  if (aiStatus().tier !== 3) return '';
  return `
  <div class="card in" style="margin-top:12px;background:var(--warn-tint);border-color:transparent">
    <div class="card-title" style="color:var(--warn)">AI features are off</div>
    <div class="card-note" style="margin-top:4px">A free Gemini key turns on food photos, suggestions and Spanish feedback.</div>
    <button class="btn btn-sm block" style="margin-top:12px;background:var(--warn);color:var(--bg)" data-act="setup-ai">Set it up</button>
  </div>`;
}

/* One line per tool. The six-stacked-dashboards version buried the thing
   that actually needs attention under a wall of numbers. */
function tileHTML(c, i){
  const a = APPS[c.id];
  // A tile with chips can't be one big <button> — nested buttons are
  // invalid HTML and swallow the inner taps. .rowcard is display:flex, so a
  // chips row added as a second child lines up BESIDE the content and runs
  // off the right edge; the tile is stacked instead.
  return `
  <div class="rowcard in ${i<3?'in-'+(i+2):''}" style="flex-direction:column;align-items:stretch;gap:0">
    <div style="display:flex;align-items:center;gap:12px;width:100%;min-width:0" data-go2="${c.id}">
      <div class="av" style="width:36px;height:36px">${icon(a.icon, 18)}</div>
      <div class="grow" style="text-align:left;min-width:0">
        <b style="font-size:14.5px;display:block">${a.name}</b>
        <span class="sub trunc" style="margin-top:2px">${c.headline} · ${c.detail}</span>
      </div>
      <!-- The badge is a sibling of the text block, not a child of it, so
           every row's badge sits at the same distance from the caret no
           matter how long the title is. Inside the text block it floated
           to wherever that row's title ended, which read as misaligned. -->
      ${c.badge ? `<span class="badge accent">${esc(c.badge)}</span>` : ''}
      <span class="caret">${icon('chevron',15)}</span>
    </div>
    ${c.chips?.length ? `
      <div class="chips scroll" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft)">
        ${c.chips.map(ch => `<button class="chip ${ch.on?'on':''}" style="font-size:12.5px;padding:8px 13px"
            data-act="${esc(ch.act)}" ${Object.entries(ch.data||{}).map(([k,v]) => `data-${k}="${esc(v)}"`).join(' ')}
          >${ch.on ? '&#10003; ' : ''}${esc(ch.label)}</button>`).join('')}
      </div>` : ''}
  </div>`;
}

/* ---------------- the page ---------------- */

async function homeHTML(){
  await loadItems();
  const cards = [];
  for (const id of appOrder()){
    try{ cards.push({ id, ...(await APPS[id].mod.summary()) }); }
    catch{ cards.push({ id, headline:'—', detail:'Tap to set up' }); }
  }
  const rest = cards.filter(c => c.id !== 'day');

  return `
  ${headerHTML(new Date())}
  ${crypticCardHTML(cards)}
  ${nowCardHTML(cards)}
  ${quickRowHTML()}
  ${onMindHTML(openItems())}
  ${glanceHTML(cards)}
  ${lineOfTheDayHTML()}
  ${dayHeroHTML(cards.find(c => c.id === 'day'))}
  ${aiNudgeHTML()}

  <div class="sec">Everything else</div>
  <div class="stack" style="gap:9px">
    ${rest.map((c,i) => tileHTML(c, i)).join('')}
  </div>

  <div class="center tiny muted" style="margin:26px 0 8px">
    Everything saves to this device
  </div>`;
}

const stay = () => navigate('home', { keepScroll:true });

function bindHome(view){
  bindActions(view, {
    settings: openSettings,
    'setup-ai': openAISetup,
    // Start a specific training day straight from HQ.
    'forge-day': async d => {
      await APPS.forge.mod.startFromHome(d.d);
      navigate('forge');
    },
    // Camera straight from HQ — Fuel opens with the shutter already up.
    'fuel-snap': () => navigate('fuel', 'snap'),
    'cryptic-go': () => navigate('cryptic'),
    'cryptic-practice': () => navigate('cryptic', 'practice'),
    lift: () => openLift('joke'),
    daily: () => openLift('line'),

    // The next-action shortcuts open their sheet in place rather than
    // navigating away: one tap should finish the job, not start it.
    'day-meds':  async () => { await APPS.day.mod.openFromHome('meds'); toast('Dose logged'); stay(); },
    'day-mood':  () => APPS.day.mod.openFromHome('mood'),
    'day-sleep': () => APPS.day.mod.openFromHome('sleep'),

    dump: openDump,
    tick: async d => { await tickItem(d.id); haptic(); stay(); },
    'day-anchor': async d => { await APPS.day.mod.tickFromHome(d.id); haptic(); stay(); },
  });
}

export const homeScreen = { html: homeHTML, bind: bindHome };
