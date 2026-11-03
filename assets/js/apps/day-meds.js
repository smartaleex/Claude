/* ============================================================
   Day: the medication schedule screens.

   Add medication by typing it the way you would say it ("Lamotrigine 100mg
   at 8am and 8pm with food; lithium 400mg at 9pm"). It is read by Gemini if
   that is on, by simple rules if not, and shown back to you to check before
   anything is saved. Edit any entry by hand afterwards. The data and the
   rules are in core/meds.js; it only records and reminds, and never suggests
   a dose.

   Reminders are off until switched on, and are scheduled on the phone itself
   by the iPhone app (no server, they arrive offline and with the app closed).
   In a plain browser the schedule still drives the Day screen.
   ============================================================ */

import { ask } from '../core/ai.js';
import { esc, toast, openSheet, closeSheet, sheetVal, bindActions, haptic } from '../core/ui.js';
import * as native from '../core/native.js';
import { medStore, normaliseMed, parseMedText, medPrompt, fmtTime, reminderItems, DAY_NAMES } from '../core/meds.js';

const PREFIX = 'alexhq-med-';

/** Put the phone's reminders in step with the schedule. Does nothing outside the iPhone app. */
export async function syncMedReminders(){
  if (!native.isNative()) return;
  await medStore.load();
  const s = medStore.get();
  await native.syncReminders(PREFIX, s.remind ? reminderItems(s.list, { showNames: s.showNames }) : []);
}

const chip = (on, act, label, extra = '') =>
  `<button class="chip ${on ? 'on' : ''}" data-act="${act}" ${extra} style="font-size:13px;padding:9px 13px">${label}</button>`;

const daysText = m => m.days ? m.days.map(d => DAY_NAMES[d]).join(', ') : 'Every day';

function listHTML(list){
  if (!list.length) return `<div class="card tight sunk"><div class="tiny muted" style="line-height:1.6">Nothing yet. Type your medication below, the way you would say it, and check what it understood.</div></div>`;
  return `<div class="stack" style="gap:9px">${list.map(m => `
    <div class="card tight">
      <div class="spread" style="align-items:flex-start;gap:10px">
        <div class="grow">
          <b style="font-size:15px">${esc(m.name)}${m.dose ? ' ' + esc(m.dose) : ''}</b>
          <div class="tiny muted" style="margin-top:4px;line-height:1.55">
            ${m.asNeeded ? 'As needed (no reminders)' : m.times.length ? esc(m.times.map(fmtTime).join(' · ')) + ' · ' + esc(daysText(m)) : '<span style="color:var(--warn)">No time yet, so no reminder</span>'}
            ${m.withFood ? ' · with food' : ''}
          </div>
          ${m.note ? `<div class="tiny muted" style="margin-top:3px">${esc(m.note)}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-plain" data-act="edit" data-id="${m.id}">Edit</button>
      </div>
    </div>`).join('')}</div>`;
}

function previewHTML(p){
  if (!p) return '';
  return `
    <div class="tiny muted" style="margin:14px 0 8px">${p.source === 'Offline' ? 'Read with simple rules.' : `Read by ${esc(p.source)}.`} Check it before adding.</div>
    ${p.meds.length ? `<div class="stack" style="gap:9px">${p.meds.map(({ n, assumed }) => `
      <div class="card tight sunk">
        <b style="font-size:14.5px">${esc(n.name)}${n.dose ? ' ' + esc(n.dose) : ''}</b>
        <div class="tiny" style="margin-top:4px;line-height:1.55">
          ${n.asNeeded ? 'As needed' : n.times.length ? esc(n.times.map(fmtTime).join(' · ')) : 'No time given'} · ${esc(daysText(n))}${n.withFood ? ' · with food' : ''}
        </div>
        ${assumed ? `<div class="tiny" style="margin-top:5px;color:var(--warn)">No time was given, so I used 8:00 am. Change it if that is wrong.</div>` : ''}
        ${!assumed && !n.asNeeded && !n.times.length ? `<div class="tiny" style="margin-top:5px;color:var(--warn)">No time given, so there will be no reminder until you add one.</div>` : ''}
        ${n.note ? `<div class="tiny muted" style="margin-top:4px">${esc(n.note)}</div>` : ''}
      </div>`).join('')}</div>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="addread">Add ${p.meds.length === 1 ? 'this' : `these ${p.meds.length}`}</button>` : ''}
    ${p.notes.length ? `<div class="card tight sunk" style="margin-top:10px">${p.notes.map(t => `<div class="tiny" style="line-height:1.55">${esc(t)}</div>`).join('')}</div>` : ''}`;
}

async function interpret(text){
  const res = await ask({ prompt: medPrompt(text), maxTokens: 900, offline: () => parseMedText(text) });
  const raw = Array.isArray(res.data) ? res.data : res.data?.meds;
  const meds = (raw || []).map(m => ({ n: normaliseMed(m), assumed: !!m.assumed })).filter(x => x.n);
  const notes = Array.isArray(res.data?.notes) ? res.data.notes.map(String) : [];
  return { meds, notes, source: res.source };
}

function remindersHTML(s, isNative){
  if (!isNative) return `
    <div class="card tight sunk">
      <div class="card-title" style="font-size:14px">Reminders</div>
      <div class="tiny muted" style="margin-top:4px;line-height:1.6">
        Reminders come from the iPhone app, which schedules them on the phone itself: no server, they arrive with the app closed and
        with no signal. Here on the web, the Day screen shows what is due and when.
      </div>
    </div>`;
  return `
    <div class="card tight sunk">
      <div class="spread"><div class="grow"><div class="card-title" style="font-size:14px">Remind me</div>
        <div class="tiny muted" style="margin-top:3px">At each time above. Off until you turn it on.</div></div>
        ${chip(s.remind, 'remind', s.remind ? 'On' : 'Off')}</div>
      <div class="spread" style="margin-top:12px"><div class="grow"><div style="font-size:14px;font-weight:600">Show the names</div>
        <div class="tiny muted" style="margin-top:3px">${s.showNames ? 'Names will show on your lock screen.' : 'By default it just says "Time for your meds."'}</div></div>
        ${chip(s.showNames, 'names', s.showNames ? 'On' : 'Off')}</div>
      <div class="tiny muted" style="margin-top:12px;line-height:1.55">If another app already reminds you about these, use one or the other. Two reminders for one dose is how you start ignoring both.</div>
    </div>`;
}

export async function openMedSchedule(onClose){
  await medStore.load();
  const isNative = native.isNative();
  openSheet(`
    <h2>Medication schedule</h2>
    <p class="sub">Kept on this phone only. It records and reminds; dose decisions are your prescriber's.</p>
    <div id="ms-list"></div>
    <div class="sec" style="margin-top:18px">Add in plain words</div>
    <textarea class="textarea" id="ms-q" placeholder="e.g. Lamotrigine 100mg at 8am and 8pm with food; lithium 400mg at 9pm; ibuprofen 200mg as needed"></textarea>
    <button class="btn btn-soft block" style="margin-top:10px" data-act="read" id="ms-btn">Read it</button>
    <div id="ms-preview"></div>
    <div class="sec" style="margin-top:20px">Reminders</div>
    <div id="ms-remind"></div>
    <button class="btn btn-ghost block" style="margin-top:16px" data-act="close">Done</button>
  `, { onClose: () => onClose?.() });

  let preview = null;
  const $ = id => document.getElementById(id);
  const paint = () => {
    if ($('ms-list')) $('ms-list').innerHTML = listHTML(medStore.get().list);
    if ($('ms-preview')) $('ms-preview').innerHTML = previewHTML(preview);
    if ($('ms-remind')) $('ms-remind').innerHTML = remindersHTML(medStore.get(), isNative);
  };
  paint();
  const save = async fn => { medStore.update(fn); await syncMedReminders(); paint(); };

  bindActions(document.querySelector('.sheet'), {
    close: closeSheet,
    edit: d => openMedEdit(d.id, onClose),
    read: async () => {
      const text = sheetVal('ms-q').trim();
      if (!text){ toast('Type what you take'); return; }
      const btn = $('ms-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Reading…';
      try{ preview = await interpret(text); paint(); }
      catch(e){ toast(e.message || 'Could not read that'); }
      finally{ btn.disabled = false; btn.textContent = 'Read it'; }
    },
    addread: async () => {
      if (!preview?.meds.length) return;
      await save(s => { s.list = [...s.list, ...preview.meds.map(x => x.n)]; });
      toast(`${preview.meds.length} added`);
      preview = null; $('ms-q').value = ''; paint(); haptic();
    },
    remind: async () => {
      const s = medStore.get();
      if (!s.remind){
        if (!(await native.askNotifications())){ toast('Allow notifications for Alex HQ in iPhone Settings first'); return; }
      }
      await save(st => { st.remind = !st.remind; });
      toast(medStore.get().remind ? 'Reminders on' : 'Reminders off'); haptic();
    },
    names: () => save(st => { st.showNames = !st.showNames; }),
  });
}

/* One medication, edited by hand. */
export function openMedEdit(id, onClose){
  const cur = medStore.get().list.find(m => m.id === id);
  const draft = cur ? { ...cur, times: [...cur.times], days: cur.days ? [...cur.days] : [] } : null;
  if (!draft){ openMedSchedule(onClose); return; }

  openSheet(`
    <h2>Edit</h2>
    <label class="label">Name</label>
    <input class="input" id="me-name" value="${esc(draft.name)}" maxlength="60" autocomplete="off">
    <label class="label" style="margin-top:14px">Dose, as written</label>
    <input class="input" id="me-dose" value="${esc(draft.dose)}" maxlength="30" placeholder="e.g. 100mg" autocomplete="off">
    <div id="me-times"></div>
    <label class="label" style="margin-top:16px">Days <span class="tiny muted">(none picked = every day)</span></label>
    <div class="chips" id="me-days"></div>
    <div class="chips" style="margin-top:14px" id="me-flags"></div>
    <label class="label" style="margin-top:16px">Note</label>
    <textarea class="textarea" id="me-note" maxlength="160" placeholder="e.g. avoid grapefruit">${esc(draft.note)}</textarea>
    <button class="btn btn-primary block" style="margin-top:16px" data-act="save">Save</button>
    <button class="btn btn-ghost block" data-act="back">Cancel</button>
    <button class="btn btn-ghost block" style="color:var(--bad)" data-act="del">Remove this medication</button>
  `);

  const $ = x => document.getElementById(x);
  const paint = () => {
    $('me-times').innerHTML = draft.asNeeded ? '' : `
      <label class="label" style="margin-top:14px">Times</label>
      ${draft.times.map((t, i) => `<div class="row" style="gap:8px;margin-bottom:8px">
        <input class="input grow" type="time" value="${esc(t)}" data-i="${i}" data-time="1">
        <button class="btn btn-sm btn-plain" data-act="rmtime" data-i="${i}" aria-label="Remove this time">&times;</button></div>`).join('')}
      <button class="btn btn-plain btn-sm" data-act="addtime">Add a time</button>`;
    $('me-days').innerHTML = DAY_NAMES.map((n, d) => chip(draft.days.includes(d), 'day', n, `data-d="${d}"`)).join('');
    $('me-flags').innerHTML = chip(draft.withFood, 'food', 'With food') + chip(draft.asNeeded, 'prn', 'As needed (no reminders)');
    $('me-times').querySelectorAll('[data-time]').forEach(el => el.addEventListener('change', () => { draft.times[+el.dataset.i] = el.value; }));
  };
  paint();

  bindActions(document.querySelector('.sheet'), {
    back: () => openMedSchedule(onClose),
    // a new time starts at the first free hour from midday, so it is never a silent duplicate
    addtime: () => {
      const free = ['12:00', '14:00', '16:00', '18:00', '10:00', '22:00', '06:00'].find(t => !draft.times.includes(t)) || '12:00';
      draft.times.push(free); paint();
    },
    rmtime: d => { draft.times.splice(+d.i, 1); paint(); },
    day: d => { const n = +d.d; draft.days = draft.days.includes(n) ? draft.days.filter(x => x !== n) : [...draft.days, n]; paint(); },
    food: () => { draft.withFood = !draft.withFood; paint(); },
    prn: () => { draft.asNeeded = !draft.asNeeded; paint(); },
    save: async () => {
      const next = normaliseMed({ ...draft, name: sheetVal('me-name'), dose: sheetVal('me-dose'), note: sheetVal('me-note'), days: draft.days });
      if (!next){ toast('A medication needs a name'); return; }
      medStore.update(s => { s.list = s.list.map(m => m.id === id ? { ...next, id } : m); });
      await syncMedReminders(); haptic(); toast('Saved');
      openMedSchedule(onClose);
    },
    del: async () => {
      medStore.update(s => { s.list = s.list.filter(m => m.id !== id); });
      await syncMedReminders(); toast('Removed');
      openMedSchedule(onClose);
    },
  });
}
