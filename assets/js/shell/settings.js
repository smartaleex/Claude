/* ============================================================
   Shell: the Settings sheet. AI status, light/dark, the four looks, the
   order of the tools, backup and restore, and a force-update for when a
   stale build gets stuck. Each block is its own function below.
   ============================================================ */

import { aiStatus, aiSettings, setTabOrder } from '../core/ai.js';
import { esc, toast, openSheet, closeSheet, bindActions, haptic } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { APPS, BAR_SLOTS, appOrder } from './registry.js';
import { rerender } from './router.js';
import { SKINS, setSkin, setTheme } from './look.js';
import { openAISetup } from './ai-setup.js';
import { doExport, doImport } from './backup.js';

function aiBlockHTML(){
  const ai = aiStatus();
  const s = aiSettings();
  return `
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
    </div>`;
}

function themeHTML(theme){
  return `
    <label class="label" style="margin-top:20px">Appearance</label>
    <div class="seg">
      ${[['auto','Auto'],['light','Light'],['dark','Dark']].map(([v,l]) =>
        `<button class="${theme===v?'on':''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}
    </div>`;
}

/* Each option draws a little sample of the home screen in its own skin. */
function lookHTML(skin, theme){
  return `
    <label class="label" style="margin-top:20px">Look</label>
    <div class="stack" style="gap:10px">
      ${SKINS.map(([k, name, blurb]) => `
        <button class="skin-opt ${skin===k?'on':''}" data-act="skin" data-v="${k}" aria-label="${name}">
          <div class="skin-prev" data-skin="${k}" data-theme="${theme}">
            <span class="lbl">Tuesday 27 October</span>
            <div class="disp" style="font-size:22px;margin-top:3px">Morning, Alex</div>
            <div class="hero" style="padding:11px 13px;margin-top:9px">
              <div class="hero-num" style="font-size:30px">1,840</div>
              <div class="bar" style="margin-top:9px"><i style="width:62%"></i></div>
            </div>
            <div style="display:flex;gap:7px;margin-top:9px">
              <span class="btn btn-primary btn-sm" style="padding:7px 13px;font-size:12.5px">Log a meal</span>
              <span class="chip on" style="padding:7px 12px;font-size:12.5px">Today</span>
              <span class="chip" style="padding:7px 12px;font-size:12.5px">Week</span>
            </div>
          </div>
          <div class="skin-meta">
            <div class="spread"><b>${name}</b>${skin===k?'<span class="badge accent">In use</span>':''}</div>
            <div class="tiny muted" style="margin-top:3px;line-height:1.5">${blurb}</div>
          </div>
        </button>`).join('')}
    </div>`;
}

function orderHTML(){
  const order = appOrder();
  return `
    <label class="label" style="margin-top:20px">App order</label>
    <div class="tiny muted" style="margin:-2px 0 8px">
      The first ${BAR_SLOTS} sit in the bottom bar; the rest live under More.
    </div>
    <div class="stack" style="gap:6px">
      ${order.map((id,i) => {
        const a = APPS[id];
        return `<div class="rowcard" style="padding:10px 12px">
          <div class="av" style="width:32px;height:32px">${icon(a.icon,17)}</div>
          <div class="grow"><b style="font-size:14.5px">${esc(a.name)}</b>
            <span class="sub" style="font-size:11.5px">${i < BAR_SLOTS ? 'Bottom bar' : 'Under More'}</span></div>
          <button class="btn btn-sm btn-plain" data-act="mv" data-i="${i}" data-dir="-1" ${i===0?'disabled':''} aria-label="Move up">↑</button>
          <button class="btn btn-sm btn-plain" data-act="mv" data-i="${i}" data-dir="1" ${i===order.length-1?'disabled':''} aria-label="Move down">↓</button>
        </div>`;
      }).join('')}
    </div>`;
}

function dataHTML(){
  return `
    <label class="label" style="margin-top:20px">Your data</label>
    <button class="btn btn-plain block" data-act="export">Download a backup</button>
    <button class="btn btn-plain block" style="margin-top:8px" data-act="import">Restore from backup</button>`;
}

function buildHTML(){
  return `
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
    </div>`;
}

/* Ask the worker which build is actually running: that is the number that
   matters when something looks stale, not the one in the source. */
async function showBuild(){
  let v = 'unknown';
  try{
    const keys = await caches.keys();
    v = keys.find(k => k.startsWith('alexhq-')) || 'not cached';
  }catch{ v = 'unavailable'; }
  const el = document.getElementById('sw-ver');
  if (el) el.textContent = v;
}

async function forceUpdate(){
  try{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
  }catch{}
  try{ sessionStorage.removeItem('alexhq:reloaded'); }catch{}
  toast('Reinstalling…');
  setTimeout(() => location.reload(), 500);
}

/* Reopen the sheet in place after a change, keeping its scroll position. */
function reopen(){
  const y = document.querySelector('.sheet')?.scrollTop || 0;
  openSettings();
  const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = y;
}

export function openSettings(){
  const theme = document.documentElement.dataset.theme || 'auto';
  const skin = document.documentElement.dataset.skin || 'paper';
  openSheet(`
    <h2>Settings</h2>
    <p class="sub">Everything here stays on this device.</p>
    ${aiBlockHTML()}
    ${themeHTML(theme)}
    ${lookHTML(skin, theme)}
    ${orderHTML()}
    ${dataHTML()}
    ${buildHTML()}
    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Done</button>
  `);
  showBuild();

  bindActions(document.querySelector('.sheet'), {
    ai: openAISetup,
    theme: d => { setTheme(d.v); reopen(); },
    skin: d => { setSkin(d.v); haptic(6); reopen(); },
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
    update: forceUpdate,
    export: doExport,
    import: doImport,
    close: closeSheet,
  });
}
