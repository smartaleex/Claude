/* ============================================================
   Shell: the brain dump.

   "I'm forgetting things" is a symptom, not a to-do list problem, so this
   is deliberately not a task manager: no due dates, no priorities, no
   projects. Somewhere to put a thought in four seconds so it stops taking
   up room. Ticked items disappear on their own.
   ============================================================ */

import { Slice } from '../core/store.js';
import { esc, openSheet, closeSheet, sheetVal, bindActions, haptic } from '../core/ui.js';
import { navigate } from './router.js';

const capture = new Slice('capture', { items: [] });

export const loadItems = () => capture.load();
export const openItems = () => capture.get().items.filter(i => !i.done);

export async function tickItem(id){
  await capture.load();
  capture.update(c => {
    const it = c.items.find(x => x.id === id);
    if (it) it.done = true;
  });
}

/* Four seconds from thought to written down, or it will not get used on
   the days it matters most. One field, one button, keyboard already up. */
export function openDump(){
  const list = openItems();
  openSheet(`
    <h2>Brain dump</h2>
    <p class="sub">Get it out of your head. No dates, no priorities.</p>
    <input class="input" id="dump-in" placeholder="What is rattling around?" autocomplete="off">
    <button class="btn btn-primary block" style="margin-top:12px" data-act="add">Add it</button>

    ${list.length ? `
      <div class="sec">Open</div>
      <div class="stack" style="gap:8px">
        ${list.map(i => `
          <button class="rowcard" data-act="done" data-id="${i.id}" style="width:100%;text-align:left;padding:12px 15px">
            <span style="width:22px;height:22px;border-radius:var(--r-av);flex:none;background:var(--bg-sunk);box-shadow:var(--clay-in)"></span>
            <span class="grow" style="font-size:14.5px">${esc(i.text)}</span>
            <span class="tiny faint">done</span>
          </button>`).join('')}
      </div>` : ''}

    <button class="btn btn-ghost block" style="margin-top:14px" data-act="close">Close</button>
  `);

  const add = () => {
    const v = sheetVal('dump-in').trim();
    if (!v) return;
    capture.update(c => c.items.unshift({ id: Date.now().toString(36), text:v, done:false, t:Date.now() }));
    haptic(); closeSheet(); navigate('home', { keepScroll:true });
  };

  bindActions(document.querySelector('.sheet'), {
    add,
    done: async d => {
      await tickItem(d.id);
      haptic(); closeSheet(); navigate('home', { keepScroll:true });
    },
    close: closeSheet,
  });

  const inp = document.getElementById('dump-in');
  inp?.focus();
  inp?.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}
