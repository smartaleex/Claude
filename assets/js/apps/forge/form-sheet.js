/* ============================================================
   Training: one exercise, up close. Opened from the little diagram on an
   exercise card: the movement animated, the cues, the muscle it trains,
   and from here a swap or a question to the coach.
   ============================================================ */

import { esc, openSheet, closeSheet, bindActions } from '../../core/ui.js';
import { formSVG, animateForm, stopForm } from '../../core/form.js';
import { factsFor } from '../../core/library.js';
import { swapsFor } from '../../data/swaps.js';
import { openSwap } from './swap.js';
import { askAbout } from './coach-panel.js';
import { dayOf, resolve, store } from './state.js';

export function openForm(name, orig, dk){
  const day = dayOf(dk);
  const ex0 = day?.supersets.flatMap(ss => ss.exercises).find(e => e.name === orig);
  const ex = ex0 ? resolve(ex0, dk) : { name, orig, notes: '' };
  const f = factsFor(name, store.get().custom);
  const listed = swapsFor(orig)?.options.find(o => o.name === name)?.note;
  const cues = [ex.name === ex.orig ? ex.notes : '', listed || f.note].filter(Boolean);

  openSheet(`
    <div class="tiny muted">${esc(f.muscle)} · ${esc(f.patternLabel)}${ex.sets ? ` · ${esc(ex.sets)} sets × ${esc(ex.reps)}` : ''}</div>
    <h2 style="margin:4px 0 12px">${esc(name)}</h2>
    <div class="form-stage">${formSVG(name, { size: 190, cls: 'fm-lg' }) || '<div class="tiny muted">No diagram for this one yet.</div>'}</div>
    <div class="tiny muted center" style="margin-top:6px">Faint figure: start of the rep. Solid: where it finishes.</div>
    ${cues.length ? `<div class="card tight sunk" style="margin-top:14px">${cues.map(c => `<div style="font-size:14px;line-height:1.6;padding:3px 0">${esc(c)}</div>`).join('')}</div>` : ''}
    ${ex.name !== ex.orig ? `<div class="tiny" style="margin-top:10px;color:var(--accent-1);font-weight:700">Swapped in for ${esc(ex.orig)}</div>` : ''}
    <div class="row" style="display:flex;gap:9px;margin-top:16px">
      <button class="btn btn-plain grow" data-act="fswap">Swap it</button>
      <button class="btn btn-soft grow" data-act="fcoach">Ask the coach</button>
    </div>
    <button class="btn btn-ghost block" style="margin-top:6px" data-act="close">Close</button>
  `, { onClose: stopForm });
  animateForm(document.querySelector('.sheet .form-stage svg'));

  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    fswap: () => openSwap(name, orig, dk),
    fcoach: () => { closeSheet(); askAbout({ dk, name, orig }); },
  });
}

export const actions = { form: d => openForm(d.n, d.o, d.dk) };
