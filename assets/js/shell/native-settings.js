/* ============================================================
   Shell: the "On this iPhone" block in Settings. Only drawn inside the
   iPhone app (core/native.js). Face ID lock, daily reminders, Apple Health.
   Nothing here does anything in a browser, and nothing is on until asked for.
   ============================================================ */

import { esc, toast, bindActions, haptic } from '../core/ui.js';
import * as native from '../core/native.js';
import { nativePrefs, REMINDERS, parseTime, reminderId } from '../core/native-prefs.js';

/* The empty slot Settings puts in the sheet. */
export const nativeSlotHTML = () => native.isNative() ? '<div id="native-block"></div>' : '';

const chip = (on, act, extra = '') =>
  `<button class="chip ${on ? 'on' : ''}" data-act="${act}" ${extra}>${on ? 'On' : 'Off'}</button>`;

function blockHTML(info){
  const p = nativePrefs.get();
  const lockName = info.biometry && info.biometry !== 'none' ? info.biometry : 'Passcode';
  return `
    <label class="label" style="margin-top:20px">On this iPhone</label>

    <div class="card tight sunk">
      <div class="spread">
        <div class="grow">
          <div class="card-title">${esc(lockName)} lock</div>
          <div class="card-note" style="margin-top:3px">Asks for it each time the app is opened, and hides it in the app switcher.</div>
        </div>
        ${chip(info.lock, 'n-lock')}
      </div>
    </div>

    <div class="card tight sunk" style="margin-top:10px">
      <div class="card-title">Reminders</div>
      <div class="card-note" style="margin:3px 0 10px">Off until you turn one on. They arrive even when the app is closed.</div>
      ${REMINDERS.map(r => `
        <div class="spread" style="padding:7px 0;gap:10px">
          <div class="grow" style="font-size:14.5px">${esc(r.label)}</div>
          <input class="input" type="time" value="${esc(p.reminders[r.id].time)}" data-time="1" data-id="${r.id}"
                 style="width:auto;padding:7px 9px;font-size:14px">
          ${chip(p.reminders[r.id].on, 'n-rem', `data-id="${r.id}"`)}
        </div>`).join('')}
    </div>

    <div class="card tight sunk" style="margin-top:10px">
      <div class="card-title">Apple Health</div>
      <div class="card-note" style="margin:3px 0 10px">
        Reads last night's sleep and your bodyweight so you can add them with one tap,
        and saves finished gym sessions. Nothing leaves your phone.
      </div>
      ${info.health ? (p.health ? `
        <div class="spread" style="padding:4px 0">
          <div class="grow" style="font-size:14.5px">Save gym sessions to Health</div>
          ${chip(p.workouts, 'n-workouts')}
        </div>
        <div class="tiny muted" style="margin-top:6px">Sleep and weight offer themselves in the Day and Food tools.</div>`
        : `<button class="btn btn-plain btn-sm block" data-act="n-health">Connect Apple Health</button>`)
        : `<div class="tiny muted">Not available on this device.</div>`}
    </div>

    <div class="tiny muted" style="margin-top:10px;line-height:1.55">
      A copy of everything is saved once a day to the Files app, under On My iPhone &rarr; Alex HQ.
    </div>`;
}

/* Fill the slot, then wire it. Called by Settings once the sheet is open. */
export async function fillNativeBlock(){
  const slot = document.getElementById('native-block');
  if (!slot) return;
  await nativePrefs.load();
  const info = (await native.info()) || {};
  if (!document.body.contains(slot)) return;           // sheet closed while we asked
  paint(slot, info);
}

function paint(slot, info){
  slot.innerHTML = blockHTML(info);
  const redraw = async () => paint(slot, (await native.info()) || {});

  bindActions(slot, {
    'n-lock': async () => {
      const ok = await native.setLock(!info.lock);
      if (ok === false) toast('Could not change the lock');
      haptic(); redraw();
    },

    'n-rem': async d => {
      const r = REMINDERS.find(x => x.id === d.id);
      const now = nativePrefs.get().reminders[d.id];
      if (!now.on){
        if (!(await native.askNotifications())){
          toast('Allow notifications for Alex HQ in iPhone Settings first');
          return;
        }
        nativePrefs.update(s => { s.reminders[d.id].on = true; });
        await schedule(r);
        toast(`${r.label} reminder on`);
      } else {
        nativePrefs.update(s => { s.reminders[d.id].on = false; });
        await native.cancelReminders([reminderId(d.id)]);
      }
      haptic(); redraw();
    },

    'n-health': async () => {
      const ok = await native.healthConnect();
      if (ok){
        nativePrefs.update(s => { s.health = true; });
        toast('Apple Health connected');
      } else toast('Could not connect Apple Health');
      redraw();
    },

    'n-workouts': () => {
      nativePrefs.update(s => { s.workouts = !s.workouts; });
      haptic(); redraw();
    },
  });

  // A time picker changing is a "change" event, not a tap, so it is wired on its own.
  slot.querySelectorAll('[data-time]').forEach(el => {
    el.addEventListener('change', async () => {
      const r = REMINDERS.find(x => x.id === el.dataset.id);
      if (!r || !el.value) return;
      nativePrefs.update(s => { s.reminders[r.id].time = el.value; });
      if (nativePrefs.get().reminders[r.id].on) await schedule(r);
    });
  });
}

async function schedule(r){
  const { hour, minute } = parseTime(nativePrefs.get().reminders[r.id].time);
  await native.scheduleDaily({ id: reminderId(r.id), title: r.title, body: r.body, hour, minute, route: r.route });
}
