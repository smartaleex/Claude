/* ============================================================
   Shell: the router and the bottom tab bar.

   Routes are `app` or `app/sub`. 'home' and 'more' are screens the shell
   owns (registered at boot by main.js); anything else is a tool in
   registry.js, which draws itself into #view from its own mount().
   ============================================================ */

import { esc, $, haptic, scrollToTop } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { APPS, barApps, moreApps } from './registry.js';

const view = $('#view');
let current = 'home';
const screens = {};

/* A shell screen: { html(): string | Promise<string>, bind?(view) }. */
export function registerScreens(map){ Object.assign(screens, map); }

export const currentApp = () => current;

export async function navigate(route, opts = {}){
  const [appId] = route.split('/');
  current = appId;
  if (!opts.keepScroll) scrollToTop();

  if (screens[appId]){
    view.innerHTML = await screens[appId].html();
    screens[appId].bind?.(view);
  }
  else if (APPS[appId]) await APPS[appId].mod.mount(view, route.slice(appId.length + 1));
  else                  view.innerHTML = `<div class="empty">Nothing here.</div>`;

  renderTabs();
  if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route);
}
/* Used by the browser tests to jump to a tool without tapping. */
window.navigate = navigate;

/* Views call this after mutating their own state. */
export const rerender = () => navigate(location.hash.slice(1) || 'home', { keepScroll:true });

function renderTabs(){
  const tabs = ['home', ...barApps(), 'more'];
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

/* Tapping anything marked data-go2 (a tile, a card) opens that tool, unless
   it sits inside a button of its own (a chip handles itself). One listener
   on #view covers every screen. */
view.addEventListener('click', e => {
  if (e.target.closest('[data-act]')) return;
  const b = e.target.closest('[data-go2]');
  if (b) navigate(b.dataset.go2);
});

window.addEventListener('hashchange', () => {
  const r = location.hash.slice(1) || 'home';
  if (r !== current) navigate(r);
});
