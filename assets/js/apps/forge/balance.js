/* ============================================================
   Training: "How it balanced". Opens when you finish a session, and from
   any past session in History. Shows what you planned against what you
   did, by muscle and by movement; what each swap changed; and whether the
   rest of the week still covers it. The reasoning is in core/balance.js.
   ============================================================ */

import { fmtDayShort, dayKey } from '../../core/store.js';
import { esc, openSheet, closeSheet, bindActions } from '../../core/ui.js';
import { snapshotSession, balanceOf, weekView, suggestions } from '../../core/balance.js';
import { dayOf, phase, resolve, store } from './state.js';

/** The record of what was planned and done. Sessions finished before this existed fall back to the
    programme's own names (so a swap made back then cannot be seen). */
export const rowsOf = sess => sess.ex || snapshotSession(dayOf(sess.day), sess.sets, ex => ex.name);

function sessionsThisWeek(){
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const from = dayKey(monday);
  return Object.values(store.get().sessions).filter(s => s.done && s.dayKey >= from).map(s => {
    const rows = rowsOf(s);
    // ticked off with nothing logged: assume it was done as planned, rather than count a day of zero
    return { day: s.day, rows: rows.every(r => r.d === 0) ? rows.map(r => ({ ...r, d: r.p })) : rows };
  });
}

const LEVEL = { balanced: ['good', 'Balanced'], shifted: ['warn', 'Shifted'], lopsided: ['bad', 'Lopsided'] };

function musclesHTML(b){
  const max = Math.max(1, ...b.muscles.map(m => Math.max(m.planned, m.done)));
  return b.muscles.filter(m => m.planned || m.done).map(m => {
    const col = m.state === 'short' ? 'var(--bad)' : m.state === 'extra' ? 'var(--accent-1)' : 'var(--ink)';
    const note = m.state === 'short' ? `${Math.max(1, Math.round(Math.abs(m.delta)))} short` : m.state === 'extra' ? `${Math.max(1, Math.round(m.delta))} more` : '';
    return `<div style="padding:7px 0">
      <div class="spread"><span style="font-size:14px">${esc(m.muscle)}${m.priority ? ' <span class="tiny muted">· width</span>' : ''}</span>
        <span class="mono" style="font-size:13px;color:${col};font-weight:${m.state === 'ok' ? 500 : 700}">${m.planned} &rarr; ${m.done}${note ? ` <span style="font-weight:600">(${note})</span>` : ''}</span></div>
      <div class="bar" style="margin-top:5px"><i style="width:${Math.min(100, m.done / max * 100)}%;${m.state === 'short' ? 'background:var(--bad)' : ''}"></i></div>
    </div>`;
  }).join('');
}

function weekHTML(b, wk){
  // the muscles worth showing: the width muscles, and any that a swap or the session moved
  const moved = new Set(b.muscles.filter(m => m.state !== 'ok').map(m => m.muscle));
  const shown = b.muscles.filter(m => (m.priority || moved.has(m.muscle)) && wk[m.muscle]).map(m => ({ muscle: m.muscle, ...wk[m.muscle] }));
  if (!shown.length) return '';
  return `<div class="card tight sunk" style="margin-top:12px">
    <div class="card-title" style="font-size:14px">The rest of your week</div>
    <div class="tiny muted" style="margin:3px 0 8px">Sets done so far, plus what the days still to come hold, against the weekly plan.</div>
    ${shown.map(v => `<div class="spread" style="padding:5px 0;align-items:baseline">
      <span style="font-size:13.5px">${esc(v.muscle)}</span>
      <span class="mono" style="font-size:12.5px;color:${v.short >= 3 ? 'var(--bad)' : v.short > 0 ? 'var(--warn)' : 'var(--good)'}">${v.done} done + ${v.remaining} to come of ${v.plan}${v.short >= 3 ? ` · short by ${v.short}` : v.short > 0 ? ` · ${v.short} under plan` : ' · on track'}</span>
    </div>`).join('')}
  </div>`;
}

export function openBalance(id){
  const sess = store.get().sessions[id];
  if (!sess) return;
  const day = dayOf(sess.day);
  const rows = rowsOf(sess);
  const wk = weekView(phase().days, sessionsThisWeek(), (ex, dk) => resolve(ex, dk).name);
  const b = balanceOf(rows, wk);
  // only for muscles this session actually touched; a different day's shortfall is that day's business
  const touched = new Set(b.logged ? b.muscles.filter(m => m.planned || m.done).map(m => m.muscle) : []);
  const sug = suggestions(wk, phase().days, store.get().custom).filter(x => touched.has(x.muscle));
  const when = fmtDayShort(sess.dayKey);

  if (!b.logged){
    openSheet(`
      <h2>How it balanced</h2>
      <p class="sub">${esc(day?.title || 'Session')} · ${esc(when)}</p>
      <div class="card tight sunk"><div class="tiny muted" style="line-height:1.6">No sets were logged, so there is nothing to balance. Log your sets next time and this shows what you planned against what you did.</div></div>
      <button class="btn btn-primary block" style="margin-top:16px" data-act="close">Done</button>`);
    bindActions(document.querySelector('.sheet'), { close: closeSheet });
    return;
  }

  const [cls, label] = LEVEL[b.level];
  const mv = b.moves;
  openSheet(`
    <h2>How it balanced</h2>
    <p class="sub">${esc(day?.title || 'Session')} · ${esc(when)} · ${b.done} of ${b.planned} planned sets</p>

    <div class="card tight">
      <span class="badge ${cls}">${label}</span>
      <div style="font-size:15px;line-height:1.5;margin-top:9px">${esc(b.headline)}</div>
    </div>

    ${b.swaps.length ? `
    <div class="sec" style="margin-top:18px">What you swapped</div>
    <div class="stack" style="gap:8px">${b.swaps.map(s => `
      <div class="card tight sunk">
        <b style="font-size:14px;line-height:1.4">${esc(s.from)} &rarr; ${esc(s.to)}</b>
        <div class="tiny muted" style="margin-top:5px;line-height:1.55">${esc(s.text)}</div>
      </div>`).join('')}</div>` : ''}

    <div class="sec" style="margin-top:18px">Sets by muscle <span class="tiny muted" style="text-transform:none;letter-spacing:0">planned &rarr; done</span></div>
    <div class="card tight">${musclesHTML(b)}</div>

    ${(mv.vertical.planned || mv.horizontal.planned || mv.push.planned || mv.vertical.done || mv.horizontal.done) ? `
    <div class="sec" style="margin-top:18px">Movement</div>
    <div class="card tight">
      ${[['Vertical pull (lat width)', mv.vertical], ['Horizontal pull (thickness)', mv.horizontal], ['Pushing', mv.push]].filter(([, v]) => v.planned || v.done).map(([name, v]) => `
        <div class="spread" style="padding:5px 0"><span style="font-size:14px">${name}</span><span class="mono" style="font-size:13px">${v.planned} &rarr; ${v.done}</span></div>`).join('')}
      ${mv.pushDone ? `<div class="tiny muted" style="margin-top:6px">Pulling to pushing today: ${mv.pullDone} : ${mv.pushDone}. More pulling than pushing is what keeps the shoulder happy.</div>` : ''}
    </div>` : ''}

    ${weekHTML(b, wk)}

    ${sug.length ? `
    <div class="sec" style="margin-top:18px">To even it out</div>
    <div class="card tight">${sug.map(s => `<div style="font-size:14px;line-height:1.55;padding:3px 0">
      ${esc(s.muscle)}: add ${s.sets} sets of <b>${esc(s.exercises[0])}</b>${s.exercises[1] ? ` (or ${esc(s.exercises[1])})` : ''}${s.dayTitle ? ` to ${esc(s.dayTitle)}` : ''}.</div>`).join('')}
      <div class="tiny muted" style="margin-top:6px">You can make that change in plain words from the Plan tab.</div></div>` : ''}

    <button class="btn btn-primary block" style="margin-top:18px" data-act="close">Done</button>
    <div class="tiny muted center" style="margin-top:8px">Not medical advice. Balance here means sets by muscle, not how hard they were.</div>
  `);
  bindActions(document.querySelector('.sheet'), { close: closeSheet });
}

export const actions = { balance: d => openBalance(d.id) };
