/* ============================================================
   Shell: the More page. The tools that don't fit in the bottom bar, plus
   Settings. Order comes from registry.js.
   ============================================================ */

import { bindActions } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { APPS, moreApps } from './registry.js';
import { navigate } from './router.js';
import { openSettings } from './settings.js';

function moreHTML(){
  return `
  <header class="in">
    <div class="eyebrow">Alex HQ</div>
    <h1 class="page-h1">More</h1>
  </header>
  <div class="stack" style="margin-top:18px">
    ${moreApps().map(id => {
      const a = APPS[id];
      return `<button class="rowcard in" data-act="open" data-id="${id}" style="width:100%;text-align:left">
        <div class="av">${icon(a.icon, 19)}</div>
        <div class="grow"><b>${a.name}</b><span class="sub">${a.blurb}</span></div>
        <span class="caret">›</span>
      </button>`;
    }).join('')}
    <button class="rowcard in" data-act="settings" style="width:100%;text-align:left">
      <div class="av">${icon('settings',19)}</div>
      <div class="grow"><b>Settings</b><span class="sub">AI, backup, appearance</span></div>
      <span class="caret">›</span>
    </button>
  </div>`;
}

export const moreScreen = {
  html: moreHTML,
  bind: view => bindActions(view, { open: d => navigate(d.id), settings: openSettings }),
};
