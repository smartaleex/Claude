/* ============================================================
   main.js — app shell: registry, router, tab bar, home dashboard.
   ============================================================ */

import { initAI, aiStatus, setKey, aiSettings, setTabOrder, testKey, discoverModels } from './core/ai.js';
import { exportAll, importAll, Slice, today } from './core/store.js';
import { esc, $, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from './core/ui.js';
import { icon } from './core/icons.js';

import * as day    from './apps/day.js';
import * as fuel   from './apps/fuel.js';
import * as forge  from './apps/forge.js';
import * as ledger from './apps/ledger.js';
import * as shout  from './apps/shout.js';
import * as clear  from './apps/clear.js';
import * as vale   from './apps/vale.js';

/* ---------------- registry ----------------
   `accent` drives the whole page: hero gradients, primary buttons and
   the active tab all read these vars, so one entry re-themes a tool. */
export const APPS = {
  day:    { id:'day',    name:'Day',      icon:'day',      mod:day,
            blurb:'Meds, sleep, anchors',
            accent:['#0EA5A5','#14B8A6','#E0F5F4','rgba(14,165,165,.30)'] },
  fuel:   { id:'fuel',   name:'Food',     icon:'food',     mod:fuel,
            blurb:'Macros and the bulk',
            accent:['#5850EC','#8B5CF6','#ECEBFE','rgba(88,80,236,.30)'] },
  forge:  { id:'forge',  name:'Training', icon:'training', mod:forge,
            blurb:'The swimmer build',
            accent:['#2563EB','#4F46E5','#E4ECFE','rgba(37,99,235,.30)'] },
  clear:  { id:'clear',  name:'Nicotine', icon:'nicotine', mod:clear,
            blurb:'The taper',
            accent:['#F97316','#FBBF24','#FEF0E2','rgba(249,115,22,.30)'] },
  shout:  { id:'shout',  name:'People',   icon:'people',   mod:shout,
            blurb:'Mates and plans',
            accent:['#EC4899','#F43F5E','#FDEAF2','rgba(236,72,153,.28)'] },
  ledger: { id:'ledger', name:'Money',    icon:'money',    mod:ledger,
            blurb:'Budget and the house',
            accent:['#8B5CF6','#C026D3','#F3EAFD','rgba(139,92,246,.28)'] },
  vale:   { id:'vale',   name:'Spanish',  icon:'spanish',  mod:vale,
            blurb:'From rusty to fluent',
            accent:['#C026D3','#EC4899','#FBEAFB','rgba(192,38,211,.28)'] },
};

/* Order is user-editable in Settings. The first four sit in the bottom
   bar, the rest live under More — frequency of use should decide that,
   and only the person using it knows their own. */
const DEFAULT_ORDER = ['day','fuel','forge','clear','shout','ledger','vale'];
const BAR_SLOTS = 4;

function appOrder(){
  const saved = aiSettings()?.tabOrder;
  const valid = Array.isArray(saved) ? saved.filter(id => APPS[id]) : [];
  // Append anything missing so a new tool can't vanish behind stale prefs.
  return [...valid, ...DEFAULT_ORDER.filter(id => !valid.includes(id))];
}
const barApps  = () => appOrder().slice(0, BAR_SLOTS);
const moreApps = () => appOrder().slice(BAR_SLOTS);
const TABS = () => ['home', ...barApps(), 'more'];

const view = $('#view');
let current = 'home';

/* ---------------- accent theming ---------------- */
function applyAccent(appId){
  const root = document.documentElement;
  const a = APPS[appId]?.accent;
  if (!a){
    root.style.removeProperty('--accent-1');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--accent-tint');
    root.style.removeProperty('--accent-glow');
    root.style.removeProperty('--accent-grad');
    return;
  }
  root.style.setProperty('--accent-1', a[0]);
  root.style.setProperty('--accent-2', a[1]);
  /* Mixed against the live surface rather than the registry's fixed pale
     hex — otherwise every tinted thing (active tab, soft buttons, badges)
     stays daylight-coloured in dark mode and glares. */
  root.style.setProperty('--accent-tint', `color-mix(in srgb, ${a[0]} 17%, var(--surface))`);
  root.style.setProperty('--accent-glow', a[3]);
  root.style.setProperty('--accent-grad', `linear-gradient(118deg, ${a[0]} 6%, ${a[1]} 94%)`);
}

/* ---------------- router ---------------- */
export async function navigate(route, opts = {}){
  const [appId] = route.split('/');
  current = appId;
  applyAccent(appId);
  window.scrollTo({ top:0, behavior: opts.keepScroll ? 'auto' : 'instant' });

  if (appId === 'home')      { view.innerHTML = await homeHTML(); bindHome(); }
  else if (appId === 'more') { view.innerHTML = moreHTML(); }
  else if (APPS[appId])      { await APPS[appId].mod.mount(view, route.slice(appId.length+1)); }
  else                       { view.innerHTML = `<div class="empty">Nothing here.</div>`; }

  renderTabs();
  if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
}
window.navigate = navigate;

/* Views call this after mutating their own state. */
export const rerender = () => navigate(location.hash.slice(1) || 'home', { keepScroll:true });

/* ---------------- tab bar ---------------- */
function renderTabs(){
  const tabs = TABS();
  const activeTab = tabs.includes(current) ? current : (moreApps().includes(current) ? 'more' : 'home');
  $('#tabbar-inner').innerHTML = tabs.map(t => {
    const meta = t === 'home' ? { icon:'hq',   name:'HQ' }
               : t === 'more' ? { icon:'more', name:'More' }
               : APPS[t];
    return `<button class="tab ${t===activeTab?'on':''}" data-go="${t}" aria-current="${t===activeTab}">
      <span class="ti">${icon(meta.icon, 21)}</span><span class="tl">${esc(meta.name)}</span></button>`;
  }).join('');
}

$('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b){ haptic(8); navigate(b.dataset.go); }
});

/* ---------------- home dashboard ----------------
   The point of HQ is answering "what needs me today" in one glance,
   so each tool exports summary() and we show only what's live. */
async function homeHTML(){
  const cards = [];
  for (const id of appOrder()){
    try{ cards.push({ id, ...(await APPS[id].mod.summary()) }); }
    catch{ cards.push({ id, headline:'\u2014', detail:'Tap to set up' }); }
  }

  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 5 ? 'Still up' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const ai = aiStatus();

  // Day leads. Everything else is a tool you open when you want it —
  // a wall of six scoreboards is the last thing that helps on a bad day.
  const dayCard  = cards.find(c => c.id === 'day');
  const restCards = cards.filter(c => c.id !== 'day');

  return `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">${esc(now.toLocaleDateString('en-AU',{weekday:'long', day:'numeric', month:'long'}))}</div>
        <h1 class="page-h1">${greet}, Alex</h1>
      </div>
      <button class="chip" data-act="settings" aria-label="Settings">${icon('settings',18)}</button>
    </div>
  </header>

  ${dayCard ? `
  <div class="hero in" style="margin-top:14px;
       --accent-grad:linear-gradient(140deg,#0E9E9E 0%,#14B8A6 55%,#2FBF87 100%);
       --accent-glow:rgba(14,165,165,.38)">
    <div class="spread" style="align-items:flex-start" data-go2="day">
      <div class="grow">
        <div class="eyebrow" style="color:rgba(255,255,255,.82)">Today</div>
        <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:26px;letter-spacing:-.03em;margin-top:5px">
          ${esc(dayCard.headline)}
        </div>
        <div class="hero-cap" style="font-size:13.5px">${esc(dayCard.detail)}</div>
      </div>
      <span style="opacity:.8">${icon('chevron',20)}</span>
    </div>
    ${dayCard.pips?.length ? `
      <div class="chips scroll" style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.22)">
        ${dayCard.pips.map(pp => `<button data-act="day-anchor" data-id="${pp.id}"
          style="border-radius:999px;padding:9px 14px;font-size:12.5px;font-weight:700;white-space:nowrap;
                 background:${pp.on ? '#fff' : pp.partial ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.16)'};
                 color:${pp.on ? '#0E7C7C' : '#fff'};
                 box-shadow:${pp.on ? '0 4px 10px -4px rgba(0,0,0,.3)' : 'none'}">
          ${pp.on ? '&#10003; ' : ''}${esc(pp.label)}</button>`).join('')}
      </div>` : ''}
  </div>` : ''}

  ${ai.tier === 3 ? `
  <div class="card in in-2" style="margin-top:12px;background:var(--warn-tint);border-color:transparent">
    <div class="card-title" style="color:var(--warn)">AI features are off</div>
    <div class="card-note" style="margin-top:4px">A free Gemini key turns on food photos, suggestions and Spanish feedback.</div>
    <button class="btn btn-sm block" style="margin-top:12px;background:var(--warn);color:#fff" data-act="setup-ai">Set it up</button>
  </div>` : ''}

  <div class="sec">The rest</div>
  <div class="stack" style="gap:9px">
    ${restCards.map((c,i) => tileHTML(c, i)).join('')}
  </div>

  <div class="center tiny muted" style="margin:26px 0 8px">
    Everything saves to this device
  </div>`;
}

function tileHTML(c, i){
  const a = APPS[c.id];
  const [c1, c2] = a.accent;
  // A tile with chips can't be one big <button> — nested buttons are
  // invalid HTML and swallow the inner taps.
  // One line per tool. The six-stacked-dashboards version buried the
  // thing that actually needs attention under a wall of numbers.
  return `
  <div class="rowcard in ${i<3?'in-'+(i+2):''}" style="align-items:center">
    <div style="display:flex;align-items:center;gap:12px;width:100%;min-width:0" data-go2="${c.id}">
      <div class="av" style="background:linear-gradient(135deg,${c1},${c2});width:36px;height:36px">${icon(a.icon, 18)}</div>
      <div class="grow" style="text-align:left;min-width:0">
        <div class="spread" style="align-items:baseline;gap:8px">
          <b style="font-size:14.5px">${a.name}</b>
          ${c.badge ? `<span class="badge" style="background:color-mix(in srgb, ${c1} 15%, var(--surface));color:${c1}">${esc(c.badge)}</span>` : ''}
        </div>
        <span class="sub trunc" style="margin-top:2px">${c.headline} · ${c.detail}</span>
      </div>
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

function bindHome(){
  bindActions(view, {
    settings: openSettings,
    'setup-ai': openAISetup,
    // Start a specific training day straight from HQ.
    'forge-day': async d => {
      await APPS.forge.mod.startFromHome(d.d);
      navigate('forge');
    },
    'day-anchor': async d => {
      await APPS.day.mod.tickFromHome(d.id);
      haptic();
      navigate('home', { keepScroll:true });
    },
  });
  if (!view.__homeBound){
    view.__homeBound = true;
    view.addEventListener('click', e => {
      if (e.target.closest('[data-act]')) return;   // chips handle themselves
      const b = e.target.closest('[data-go2]');
      if (b) navigate(b.dataset.go2);
    });
  }
}

/* ---------------- more ---------------- */
function moreHTML(){
  return `
  <header class="in">
    <div class="eyebrow">Alex HQ</div>
    <h1 class="page-h1">More</h1>
  </header>
  <div class="stack" style="margin-top:18px">
    ${moreApps().map(id => {
      const a = APPS[id];
      return `<button class="rowcard in" onclick="navigate('${id}')" style="width:100%;text-align:left">
        <div class="av" style="background:linear-gradient(135deg,${a.accent[0]},${a.accent[1]})">${icon(a.icon, 19)}</div>
        <div class="grow"><b>${a.name}</b><span class="sub">${a.blurb}</span></div>
        <span class="caret">›</span>
      </button>`;
    }).join('')}
    <button class="rowcard in" onclick="window.__openSettings()" style="width:100%;text-align:left">
      <div class="av" style="background:linear-gradient(135deg,#6E7488,#3A3F52)">${icon('settings',19)}</div>
      <div class="grow"><b>Settings</b><span class="sub">AI, backup, appearance</span></div>
      <span class="caret">›</span>
    </button>
  </div>`;
}

/* ---------------- settings ---------------- */
function openSettings(){
  const ai = aiStatus();
  const s = aiSettings();
  const theme = document.documentElement.dataset.theme;
  openSheet(`
    <h2>Settings</h2>
    <p class="sub">Everything here stays on this device.</p>

    <div class="card tight sunk">
      <div class="spread">
        <div class="grow">
          <div class="card-title">AI · ${esc(ai.label)}</div>
          <div class="card-note" style="margin-top:3px">${esc(ai.detail)}</div>
        </div>
        <span class="badge ${ai.ok?'good':'warn'}">Tier ${ai.tier}</span>
      </div>
      ${s.callCount ? `<div class="tiny muted" style="margin-top:10px">${s.callCount} calls today</div>` : ''}
      <button class="btn btn-soft btn-sm block" style="margin-top:12px" data-act="ai">
        ${ai.tier===2 ? 'Change Gemini key' : 'Set up free AI'}
      </button>
    </div>

    <label class="label" style="margin-top:20px">Appearance</label>
    <div class="seg">
      ${[['auto','Auto'],['light','Light'],['dark','Dark']].map(([v,l]) =>
        `<button class="${theme===v?'on':''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}
    </div>

    <label class="label" style="margin-top:20px">App order</label>
    <div class="tiny muted" style="margin:-2px 0 8px">
      The first ${BAR_SLOTS} sit in the bottom bar; the rest live under More.
    </div>
    <div class="stack" style="gap:6px">
      ${appOrder().map((id,i) => {
        const a = APPS[id];
        return `<div class="rowcard" style="padding:10px 12px">
          <div class="av" style="background:linear-gradient(135deg,${a.accent[0]},${a.accent[1]});width:32px;height:32px">${icon(a.icon,17)}</div>
          <div class="grow"><b style="font-size:14.5px">${esc(a.name)}</b>
            <span class="sub" style="font-size:11.5px">${i < BAR_SLOTS ? 'Bottom bar' : 'Under More'}</span></div>
          <button class="btn btn-sm btn-plain" data-act="mv" data-i="${i}" data-dir="-1" ${i===0?'disabled':''} aria-label="Move up">↑</button>
          <button class="btn btn-sm btn-plain" data-act="mv" data-i="${i}" data-dir="1" ${i===appOrder().length-1?'disabled':''} aria-label="Move down">↓</button>
        </div>`;
      }).join('')}
    </div>

    <label class="label" style="margin-top:20px">Your data</label>
    <button class="btn btn-plain block" data-act="export">Download a backup</button>
    <button class="btn btn-plain block" style="margin-top:8px" data-act="import">Restore from backup</button>

    <label class="label" style="margin-top:20px">App</label>
    <div class="card tight sunk">
      <div class="spread">
        <div class="grow">
          <div class="tiny muted">Build</div>
          <b class="mono" id="sw-ver" style="font-size:14px">checking…</b>
        </div>
        <button class="btn btn-plain btn-sm" data-act="update">Force update</button>
      </div>
      <div class="tiny muted" style="margin-top:10px;line-height:1.55">
        If the app ever opens blank or stops responding, this reinstalls it. Your data is stored
        separately and is not touched.
      </div>
    </div>

    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Done</button>
  `);

  // Ask the worker which build is actually running — that is the number
  // that matters when something looks stale, not the one in the source.
  (async () => {
    let v = 'unknown';
    try{
      const keys = await caches.keys();
      v = keys.find(k => k.startsWith('alexhq-')) || 'not cached';
    }catch{ v = 'unavailable'; }
    const el = document.getElementById('sw-ver');
    if (el) el.textContent = v;
  })();

  const root = document.querySelector('.sheet');
  bindActions(root, {
    ai: openAISetup,
    theme: d => {
      document.documentElement.dataset.theme = d.v;
      try{ localStorage.setItem('alexhq:theme', d.v); }catch{}
      openSettings();
    },
    mv: d => {
      const order = appOrder();
      const i = +d.i, j = i + (+d.dir);
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      setTabOrder(order);
      haptic();
      openSettings();          // reopen so the list and labels refresh
      rerender();
    },
    update: async () => {
      try{
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
        await Promise.all(regs.map(r => r.unregister()));
      }catch{}
      try{ sessionStorage.removeItem('alexhq:reloaded'); }catch{}
      toast('Reinstalling…');
      setTimeout(() => location.reload(), 500);
    },
    export: doExport,
    import: doImport,
    close: closeSheet,
  });
}
window.__openSettings = openSettings;

function openAISetup(){
  const s = aiSettings();
  openSheet(`
    <h2>Free AI, no tokens</h2>
    <p class="sub">Google's Gemini free tier runs the smart features. No card, no cost.</p>

    <div class="card tight sunk" style="margin-bottom:16px">
      <ol style="margin:0;padding-left:19px;font-size:14px;line-height:1.85;color:var(--ink-2)">
        <li>Open <b>aistudio.google.com/apikey</b></li>
        <li>Sign in with any Google account</li>
        <li>Tap <b>Create API key</b></li>
        <li>Copy it and paste below</li>
      </ol>
    </div>

    <a class="btn btn-plain block" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
      Open Google AI Studio ↗
    </a>

    <label class="label" style="margin-top:18px">Your key</label>
    <input class="input" id="gk" type="password" autocomplete="off" spellcheck="false"
           placeholder="Paste your key" value="${esc(s.geminiKey||'')}">
    <div class="tiny muted" style="margin-top:8px">
      Paste whatever AI Studio gives you — keys start with <b>AQ.</b> or <b>AIza</b> depending on
      when they were made, and both work. Hit Test if you want to be sure.
    </div>
    <div class="tiny muted" style="margin-top:6px">
      Stored only in this browser. Sent to Google when you use an AI feature, and nowhere else.
    </div>

    <div class="grid2" style="margin-top:14px;gap:8px">
      <button class="btn btn-plain" data-act="test" id="test-btn">Test it</button>
      <button class="btn btn-plain" data-act="discover" id="disc-btn">Find a model</button>
    </div>
    <div class="tiny muted" style="margin-top:8px">
      Getting "quota" errors on the first try? That means the model has no free allowance on your
      Google project. <b>Find a model</b> checks each one and picks a working one.
    </div>
    <div id="test-out"></div>

    <button class="btn btn-primary block" style="margin-top:10px" data-act="save">Save key</button>
    ${s.geminiKey ? `<button class="btn btn-ghost block" data-act="clear">Remove key</button>` : ''}
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  const showResult = r => {
    const out = document.getElementById('test-out');
    if (out) out.innerHTML = `
      <div class="card tight sunk" style="margin-top:10px;
           background:${r.ok ? 'var(--good-tint)' : 'var(--bad-tint)'};border-color:transparent">
        <div class="tiny" style="color:${r.ok ? 'var(--good)' : 'var(--bad)'};line-height:1.55">
          ${r.ok ? '✓ ' : ''}${esc(r.message)}
        </div>
      </div>`;
  };

  bindActions(document.querySelector('.sheet'), {
    test: async () => {
      const k = sheetVal('gk').trim();
      if (!k){ toast('Paste a key first'); return; }
      const btn = document.getElementById('test-btn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spin dark"></span>`;
      setKey(k);                       // so the working model gets remembered
      showResult(await testKey(k));
      btn.disabled = false;
      btn.textContent = 'Test it';
    },

    discover: async () => {
      const k = sheetVal('gk').trim();
      if (!k){ toast('Paste a key first'); return; }
      const btn = document.getElementById('disc-btn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spin dark"></span>`;
      const out = document.getElementById('test-out');
      try{
        setKey(k);
        const { results, picked } = await discoverModels(k);
        out.innerHTML = `
          <div class="card tight sunk" style="margin-top:10px;">
            <div class="tiny" style="font-weight:700;margin-bottom:8px;color:${picked?'var(--good)':'var(--bad)'}">
              ${picked ? `✓ Using ${esc(picked)}` : 'No model has free quota right now'}
            </div>
            ${results.map(r => `
              <div class="spread" style="padding:5px 0">
                <span class="tiny mono" style="opacity:${r.ok?1:.55}">${esc(r.model)}</span>
                <span class="tiny" style="color:${r.ok?'var(--good)':'var(--muted)'}">${esc(r.note)}</span>
              </div>`).join('')}
            ${!picked ? `<div class="tiny muted" style="margin-top:8px;line-height:1.55">
              Free quota resets at midnight US Pacific. Everything except photo analysis and
              open-ended text keeps working in the meantime.</div>` : ''}
          </div>`;
      }catch(e){
        showResult({ ok:false, message:e.message });
      }finally{
        btn.disabled = false;
        btn.textContent = 'Find a model';
      }
    },
    // Never block on format — Google is the authority on whether a
    // credential works, not a regex here.
    save: () => {
      const k = sheetVal('gk').trim();
      setKey(k);
      closeSheet();
      toast(k ? 'Key saved ✓' : 'Key removed');
      rerender();
    },
    clear: () => { setKey(''); closeSheet(); toast('Key removed'); rerender(); },
    close: closeSheet,
  });
}

async function doExport(){
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `alex-hq-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

function doImport(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0];
    if (!f) return;
    try{
      await importAll(JSON.parse(await f.text()));
      closeSheet();
      toast('Restored ✓');
      setTimeout(() => location.reload(), 600);
    }catch(e){ toast(e.message || 'Could not read that file'); }
  };
  inp.click();
}

/* ---------------- boot ---------------- */
(async function boot(){
  try{
    const t = localStorage.getItem('alexhq:theme');
    if (t) document.documentElement.dataset.theme = t;
  }catch{}

  await initAI();
  await navigate(location.hash.slice(1) || 'home');

  window.addEventListener('hashchange', () => {
    const r = location.hash.slice(1) || 'home';
    if (r !== current) navigate(r);
  });

  // Tell the boot watchdog in index.html we made it.
  window.__booted?.();

  if ('serviceWorker' in navigator && location.protocol === 'https:'){
    navigator.serviceWorker.register('./sw.js').catch(() => {});

    /* When a new build activates it takes over this already-running page.
       Reloading once is the only way to guarantee old and new code never
       mix — that mixing is what froze the app on the previous update.
       The guard stops a reload loop if anything ever goes wrong here. */
    navigator.serviceWorker.addEventListener('message', ev => {
      if (ev.data?.type !== 'sw-updated') return;
      try{
        if (sessionStorage.getItem('alexhq:reloaded') === ev.data.cache) return;
        sessionStorage.setItem('alexhq:reloaded', ev.data.cache);
      }catch{}
      location.reload();
    });
  }
})();
