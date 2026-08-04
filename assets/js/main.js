/* ============================================================
   main.js — app shell: registry, router, tab bar, home dashboard.
   ============================================================ */

import { initAI, aiStatus, setKey, aiSettings, testKey } from './core/ai.js';
import { exportAll, importAll, Slice, today } from './core/store.js';
import { esc, $, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from './core/ui.js';

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
  fuel:   { id:'fuel',   name:'Fuel',   tab:'Fuel',   icon:'🍳', title:'Fuel',
            blurb:'Macros & lean bulk', mod:fuel,
            accent:['#4F46E5','#7C3AED','#EEEBFE','rgba(88,70,235,.30)'] },
  forge:  { id:'forge',  name:'Forge',  tab:'Forge',  icon:'💪', title:'Forge',
            blurb:'Training & physique', mod:forge,
            accent:['#0EA5E9','#4F46E5','#E3F2FD','rgba(14,165,233,.30)'] },
  ledger: { id:'ledger', name:'Ledger', tab:'Ledger', icon:'💰', title:'Ledger',
            blurb:'Money & the house', mod:ledger,
            accent:['#0E9F6E','#0891B2','#E3F5EE','rgba(14,159,110,.28)'] },
  shout:  { id:'shout',  name:'Shout',  tab:'Shout',  icon:'🍻', title:'Shout',
            blurb:'Mates & plans', mod:shout,
            accent:['#F97316','#EC4899','#FDEDE3','rgba(249,115,22,.28)'] },
  clear:  { id:'clear',  name:'Clear',  tab:'Clear',  icon:'🌱', title:'Clear',
            blurb:'Nicotine taper', mod:clear,
            accent:['#14B8A6','#0E9F6E','#E0F5F2','rgba(20,184,166,.28)'] },
  vale:   { id:'vale',   name:'Vale',   tab:'Vale',   icon:'🇪🇸', title:'Vale',
            blurb:'Spanish, properly', mod:vale,
            accent:['#E11D48','#F59E0B','#FDE8EC','rgba(225,29,72,.28)'] },
};

const TABS = ['home','fuel','forge','ledger','shout','more'];
const MORE = ['clear','vale'];

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
  root.style.setProperty('--accent-tint', a[2]);
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
  const activeTab = TABS.includes(current) ? current : (MORE.includes(current) ? 'more' : 'home');
  $('#tabbar-inner').innerHTML = TABS.map(t => {
    const meta = t === 'home' ? { icon:'◈', tab:'HQ' }
               : t === 'more' ? { icon:'⋯', tab:'More' }
               : APPS[t];
    return `<button class="tab ${t===activeTab?'on':''}" data-go="${t}" aria-current="${t===activeTab}">
      <span class="ti">${meta.icon}</span><span class="tl">${meta.tab}</span></button>`;
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
  for (const id of ['fuel','forge','clear','shout','ledger','vale']){
    try{ cards.push({ id, ...(await APPS[id].mod.summary()) }); }
    catch{ cards.push({ id, headline:'—', detail:'Tap to set up' }); }
  }

  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 5 ? 'Still up' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const ai = aiStatus();

  return `
  <header class="in">
    <div class="spread">
      <div>
        <div class="eyebrow">${esc(now.toLocaleDateString('en-AU',{weekday:'long', day:'numeric', month:'long'}))}</div>
        <h1 class="page-h1">${greet}, Alex</h1>
      </div>
      <button class="chip" data-act="settings" aria-label="Settings">⚙</button>
    </div>
  </header>

  ${ai.tier === 3 ? `
  <div class="card in in-2" style="margin-top:16px;background:var(--warn-tint);border-color:transparent">
    <div class="spread">
      <div class="grow">
        <div class="card-title" style="color:var(--warn)">AI features are off</div>
        <div class="card-note" style="margin-top:4px">Add a free Gemini key to turn on food photos, suggestions and Spanish feedback.</div>
      </div>
    </div>
    <button class="btn btn-sm block" style="margin-top:12px;background:var(--warn);color:#fff" data-act="setup-ai">Set it up — 2 minutes</button>
  </div>` : ''}

  <div class="sec">Today</div>
  <div class="stack">
    ${cards.map((c,i) => tileHTML(c, i)).join('')}
  </div>

  <div class="sec">Everything</div>
  <div class="grid2" style="gap:10px">
    ${Object.values(APPS).map(a => `
      <button class="card tight in" data-go2="${a.id}" style="text-align:left">
        <div style="font-size:22px">${a.icon}</div>
        <div class="card-title" style="margin-top:8px">${a.name}</div>
        <div class="card-note" style="font-size:12.5px">${a.blurb}</div>
      </button>`).join('')}
  </div>

  <div class="center tiny muted" style="margin:28px 0 8px">
    Alex HQ · everything saves to this device
  </div>`;
}

function tileHTML(c, i){
  const a = APPS[c.id];
  const [c1, c2, tint] = a.accent;
  return `
  <button class="card in ${i<3?'in-'+(i+2):''}" data-go2="${c.id}"
          style="display:flex;align-items:center;gap:14px;text-align:left;width:100%">
    <div class="av" style="background:linear-gradient(135deg,${c1},${c2});font-size:19px">${a.icon}</div>
    <div class="grow">
      <div class="spread" style="align-items:baseline">
        <span style="font-weight:700;font-size:15.5px">${a.name}</span>
        ${c.badge ? `<span class="badge" style="background:${tint};color:${c1}">${esc(c.badge)}</span>` : ''}
      </div>
      <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:19px;letter-spacing:-.02em;margin-top:3px">${c.headline}</div>
      <div class="card-note" style="font-size:12.5px;margin-top:1px">${c.detail}</div>
    </div>
    <span class="caret">›</span>
  </button>`;
}

function bindHome(){
  bindActions(view, {
    settings: openSettings,
    'setup-ai': openAISetup,
  });
  view.addEventListener('click', e => {
    const b = e.target.closest('[data-go2]');
    if (b) navigate(b.dataset.go2);
  }, { once:true });
}

/* ---------------- more ---------------- */
function moreHTML(){
  return `
  <header class="in">
    <div class="eyebrow">Alex HQ</div>
    <h1 class="page-h1">More</h1>
  </header>
  <div class="stack" style="margin-top:18px">
    ${MORE.map(id => {
      const a = APPS[id];
      return `<button class="rowcard in" onclick="navigate('${id}')" style="width:100%;text-align:left">
        <div class="av" style="background:linear-gradient(135deg,${a.accent[0]},${a.accent[1]});font-size:18px">${a.icon}</div>
        <div class="grow"><b>${a.name}</b><span class="sub">${a.blurb}</span></div>
        <span class="caret">›</span>
      </button>`;
    }).join('')}
    <button class="rowcard in" onclick="window.__openSettings()" style="width:100%;text-align:left">
      <div class="av" style="background:linear-gradient(135deg,#6E7488,#3A3F52);font-size:18px">⚙</div>
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

    <div class="card tight" style="box-shadow:none;background:var(--surface-2)">
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

    <label class="label" style="margin-top:20px">Your data</label>
    <button class="btn btn-plain block" data-act="export">⬇ Download a backup</button>
    <button class="btn btn-plain block" style="margin-top:8px" data-act="import">⬆ Restore from backup</button>

    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Done</button>
  `);

  const root = document.querySelector('.sheet');
  bindActions(root, {
    ai: openAISetup,
    theme: d => {
      document.documentElement.dataset.theme = d.v;
      try{ localStorage.setItem('alexhq:theme', d.v); }catch{}
      openSettings();
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

    <div class="card tight" style="box-shadow:none;background:var(--surface-2);margin-bottom:16px">
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

    <button class="btn btn-plain block" style="margin-top:14px" data-act="test" id="test-btn">Test it</button>
    <div id="test-out"></div>

    <button class="btn btn-primary block" style="margin-top:10px" data-act="save">Save key</button>
    ${s.geminiKey ? `<button class="btn btn-ghost block" data-act="clear">Remove key</button>` : ''}
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  const showResult = r => {
    const out = document.getElementById('test-out');
    if (out) out.innerHTML = `
      <div class="card tight" style="box-shadow:none;margin-top:10px;
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
      btn.innerHTML = `<span class="spin dark"></span> Checking…`;
      showResult(await testKey(k));
      btn.disabled = false;
      btn.textContent = 'Test it';
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

  if ('serviceWorker' in navigator && location.protocol === 'https:'){
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
