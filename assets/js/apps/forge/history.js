/* ============================================================
   Training: the History tab.
   ============================================================ */

import { fmtDayShort } from '../../core/store.js';
import { esc, num, empty, stat } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { PHASES } from '../../data/workouts.js';
import { doneCount, setWeight, store, thisWeekCount } from './state.js';

export function historyHTML(){
  const sess = Object.values(store.get().sessions).filter(s => s.done)
    .sort((a,b) => b.dayKey.localeCompare(a.dayKey));
  if (!sess.length) return empty(icon('training',34), 'No sessions logged yet.<br>Finish one and it will show up here.');

  const allDays = PHASES.flatMap(p => p.days);
  return `
  <div class="grid2 in" style="margin-bottom:14px">
    ${stat(num(doneCount()), 'Sessions all time')}
    ${stat(num(thisWeekCount()) + '<small>/4</small>', 'This week')}
  </div>
  <div class="stack" style="gap:9px">
    ${sess.slice(0,40).map(s => {
      const d = allDays.find(x => x.key === s.day);
      const nSets = Object.values(s.sets || {}).reduce((n,a) => n + a.length, 0);
      const weighted = Object.values(s.sets || {}).flat().filter(x => setWeight(x) != null);
      const vol = weighted.reduce((n,x) => n + setWeight(x), 0);
      const detail = s.quick || !nSets
        ? 'Ticked off'
        : `${nSets} set${nSets>1?'s':''}${weighted.length ? ` · ${num(vol)}kg total` : ''}`;
      const took = s.mins ? ` · ${s.mins} min` : '';
      return `<div class="rowcard" style="border-left:3px solid ${d?.color || 'var(--line)'}">
        <div class="grow"><b>${esc(d?.title || s.day)}</b>
          <span class="sub">${esc(fmtDayShort(s.dayKey))} · ${detail}${took}</span></div>
      </div>`;
    }).join('')}
  </div>`;
}
