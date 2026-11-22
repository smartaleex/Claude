/* ============================================================
   Training: the muscle map. Front and back of the body shaded by sets,
   for today's session or the whole week, from the exercises actually
   being done (swaps included). On the session screen and the Plan.
   ============================================================ */

import { esc, haptic } from '../../core/ui.js';
import { countSets, bodySVG, shade } from '../../core/musclemap.js';
import { PROFILE } from '../../core/training-edit.js';
import { phase, render, resolve, targetSets, ui } from './state.js';

const nameOf = (ex, d) => resolve(ex, d.key).name;
const setsOf = (ex, d) => targetSets(ex, d.key, ex.name);
const WEEK_MIN = 10;            // sets a week a muscle needs to keep growing

/** day: today's session (shows a Day / Week switch). No day: the week only. */
export function musclesHTML(day = null){
  const week = !day || ui.mapView === 'week';
  const counts = countSets(week ? phase().days : [day], nameOf, setsOf);
  const scale = week ? 20 : 10;
  const names = Object.keys(counts);
  if (week) for (const m of PROFILE.priority) if (!names.includes(m)) names.push(m);
  const rows = names.map(m => [m, counts[m] || 0]).sort((a, b) => b[1] - a[1]).slice(0, week ? 9 : 7);
  const max = Math.max(scale, ...rows.map(r => r[1]));

  return `
  <div class="card in mm-card">
    <div class="spread" style="align-items:center">
      <div class="card-title">Muscles worked</div>
      ${day ? `<div class="seg seg-sm" role="group" aria-label="Range">
        <button class="${week ? '' : 'on'}" data-act="mmview" data-v="day">Today</button>
        <button class="${week ? 'on' : ''}" data-act="mmview" data-v="week">Week</button></div>` : '<span class="tiny muted">this week</span>'}
    </div>
    <div class="mm-grid">
      <figure>${bodySVG('front', counts, scale)}<figcaption>Front</figcaption></figure>
      <figure>${bodySVG('back', counts, scale)}<figcaption>Back</figcaption></figure>
      <div class="mm-list">${rows.map(([m, n]) => {
        const low = week && PROFILE.priority.includes(m) && n < WEEK_MIN;
        return `<div class="mm-row"><span class="mm-name">${esc(m)}${low ? ' <span class="mm-low">low</span>' : ''}</span><span class="mono">${n}</span>
          <span class="mm-bar"><i class="mm-${shade(n, scale)}" style="width:${Math.min(100, n / max * 100)}%"></i>${week ? `<b style="left:${WEEK_MIN / max * 100}%"></b>` : ''}</span></div>`;
      }).join('')}</div>
    </div>
    <div class="tiny muted" style="margin-top:8px">Sets ${week ? 'this week' : 'today'}, from what you are actually doing, swaps included.${week ? ` The tick is ${WEEK_MIN} sets, about the least a muscle needs a week to grow.` : ''}</div>
  </div>`;
}

export const actions = { mmview: d => { ui.mapView = d.v; haptic(4); render(); } };
