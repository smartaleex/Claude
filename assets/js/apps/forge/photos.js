/* ============================================================
   Training: the Photos tab. Taking and listing photos, the before/after
   slider, editing a photo, goal reference photos.

   The scale is a bad instrument for this goal. On a lean bulk it moves for
   water, food and salt, and it says nothing at all about shoulder width,
   which is the entire point. Photos in the same pose a month apart show
   the change the scale cannot.

   Stored in IndexedDB via core/photos.js, never in localStorage: a few
   base64 images would exhaust the quota and break every other app.

   Photos only leave the device when a "Send to Gemini" button is tapped,
   and only after an explicit one-time agreement. Everything else here (the
   slider comparison, date editing, the weight and volume context) works
   with no network and no key.
   ============================================================ */

import { today, dayKey, daysBetween, fmtDayShort } from '../../core/store.js';
import { aiStatus } from '../../core/ai.js';
import { esc, toast, openSheet, closeSheet, sheetVal, bindActions, empty } from '../../core/ui.js';
import { icon } from '../../core/icons.js';
import { compress, addPhoto, listPhotos, deletePhoto, updatePhoto, urlFor } from '../../core/photos.js';
import { goalHTML2, progressResultHTML } from './physique-views.js';
import { ui, MAX_GOAL, render, store } from './state.js';

export function loadPhotos(){
  Promise.all([listPhotos('physique'), listPhotos('goal')])
    .then(([a, b]) => { ui.photos = a; ui.goals = b; render(); });
}

/** The two photos currently chosen. Defaults to first and latest. */
export function pair(){
  const s = ui.photos || [];
  if (!s.length) return [null, null];
  const byId = id => s.find(x => x.id === id);
  return [byId(ui.cmpA) || s[0], byId(ui.cmpB) || s[s.length - 1]];
}

export const dateOf = sh => fmtDayShort(dayKey(sh.t));

export function photosHTML(){
  if (ui.photos === null){
    loadPhotos();
    return `<div class="card in"><div class="card-note">Loading…</div></div>`;
  }
  const shots = ui.photos;
  const [a, b] = pair();
  const two = shots.length >= 2 && a && b && a.id !== b.id;
  const ai = aiStatus();
  const rd = store.get().readings || {};

  return `
  <div class="card in">
    <div class="card-title">Same pose, same light</div>
    <p class="card-note" style="margin-top:7px;line-height:1.6">
      Relaxed front, arms at your sides, same spot and same time of day — morning, before food, is
      the most consistent. Consistency matters more than the photo being flattering; the point is
      that two shots a month apart are actually comparable.
    </p>
    <div class="row" style="margin-top:14px;gap:9px">
      <button class="btn btn-primary grow" data-act="shoot">${icon('camera',18)} Take one</button>
      <button class="btn btn-plain" data-act="pick">From library</button>
    </div>
  </div>

  ${!shots.length ? empty(icon('camera',34), 'No photos yet.<br>The first one is the baseline — it only gets useful from the second onward.') : `

    ${shots.length >= 2 ? compareHTML(shots, a, b) : ''}

    <div class="sec">Ask about your progress</div>
    <div class="card in">
      <p class="card-note" style="line-height:1.6">
        An AI reading of ${two ? 'the two photos above' : 'your photo'} — what has visibly changed, what
        has not, and what to do next. It is one opinion from phone photos: lighting, pose and pump move
        what a photo shows more than a month of training does.
      </p>
      <textarea class="textarea" id="ask-q" style="margin-top:12px;min-height:64px"
        placeholder="Optional — e.g. are my shoulders getting wider?">${esc(ui.askText)}</textarea>
      ${ai.tier === 3 ? `
        <div class="tiny" style="margin-top:10px;color:var(--warn);line-height:1.55">
          Needs a free Gemini key. Add one from the settings icon on the HQ tab.</div>` : `
        <button class="btn btn-primary block" style="margin-top:12px" data-act="readprogress" ${ui.busy?'disabled':''}>
          ${ui.busy === 'progress' ? '<span class="spin"></span> Reading…' : `${icon('spark',17)} Send ${two ? '2 photos' : '1 photo'} to Gemini`}
        </button>
        <div class="tiny muted" style="margin-top:9px;line-height:1.55">
          Sends only the photo${two ? 's' : ''} shown${store.get().photoAI ? '' : ' — and asks first'}.
          ${store.get().photoAI ? `<button class="tiny" style="color:var(--accent-1);font-weight:700" data-act="photoaioff">Turn photo analysis off</button>` : ''}
        </div>`}
    </div>
    ${rd.progress ? progressResultHTML(rd.progress) : ''}

    <div class="sec">All ${shots.length}</div>
    <div class="grid3" style="gap:9px">
      ${[...shots].reverse().map(sh => `
        <button data-act="viewphoto" data-id="${sh.id}" style="position:relative;border-radius:var(--r-sm);
                overflow:hidden;box-shadow:var(--clay-sm);aspect-ratio:3/4">
          <img src="${urlFor(sh)}" style="width:100%;height:100%;object-fit:cover;display:block">
          <span style="position:absolute;left:0;right:0;bottom:0;padding:5px;font-size:10px;font-weight:700;
                color:#fff;background:linear-gradient(to top,rgba(0,0,0,.6),transparent)">
            ${esc(dateOf(sh))}</span>
        </button>`).join('')}
    </div>
    <div class="tiny muted center" style="margin-top:10px;line-height:1.55">
      Tap a photo to change its date or delete it.
    </div>`}

  ${goalHTML2(ai, shots)}

  <div class="tiny muted center" style="margin-top:18px;line-height:1.55">
    Photos are stored on this device. They only leave it when you tap a “Send to Gemini” button.
    They are not part of the Settings backup — that file is meant to stay small enough to email yourself.
  </div>`;
}

/* A before/after slider. Works with no network and no key, and is the
   honest offline answer to "how am I doing": your own eyes, same pose. */
function compareHTML(shots, a, b){
  const opt = (sel) => shots.map(sh =>
    `<option value="${sh.id}" ${sh.id === sel.id ? 'selected' : ''}>${esc(dateOf(sh))}</option>`).join('');
  const gap = Math.abs(daysBetween(dayKey(a.t), dayKey(b.t)));
  return `
    <div class="sec">Then and now</div>
    <div class="card in" style="padding:0;overflow:hidden">
      <div class="cmp" id="cmp" style="--pos:50%">
        <img class="cmp-after"  src="${urlFor(b)}" alt="After">
        <img class="cmp-before" src="${urlFor(a)}" alt="Before">
        <span class="cmp-tag l">${esc(dateOf(a))}</span>
        <span class="cmp-tag r">${esc(dateOf(b))}</span>
        <span class="cmp-line"></span>
      </div>
      <div style="padding:14px 16px 4px">
        <input type="range" min="0" max="100" value="50" class="cmp-range" aria-label="Slide between before and after"
               oninput="document.getElementById('cmp').style.setProperty('--pos', this.value + '%')">
      </div>
      <div class="grid2" style="gap:9px;padding:6px 16px 6px">
        <div><label class="label" style="font-size:10px">Before</label>
          <select class="input" data-change="cmpa" style="padding:10px">${opt(a)}</select></div>
        <div><label class="label" style="font-size:10px">After</label>
          <select class="input" data-change="cmpb" style="padding:10px">${opt(b)}</select></div>
      </div>
      <div class="tiny muted center" style="padding:6px 12px 14px">
        ${gap} day${gap === 1 ? '' : 's'} apart
      </div>
    </div>`;
}

export async function capturePhoto(which, album = 'physique'){
  const inp = document.getElementById(which === 'cam' ? 'file-cam' : 'file-lib');
  inp.value = '';
  inp.onchange = async () => {
    let files = [...inp.files];
    if (!files.length) return;
    if (album === 'goal'){
      const room = MAX_GOAL - (ui.goals || []).length;
      files = files.slice(0, Math.max(0, room));
    }
    try{
      let dated = 0;
      for (const f of files){
        const blob = await compress(f);
        const meta = {};
        /* A library photo carries the date it was taken; a camera shot is
           "now". Trust the file's date only when it is clearly not now —
           some browsers report the moment of picking, which would stamp
           an old photo as today. It is editable either way. */
        if (album === 'physique' && f.lastModified && f.lastModified <= Date.now() && Date.now() - f.lastModified > 120000){
          meta.t = f.lastModified; dated++;
        }
        await addPhoto(album, blob, meta);
      }
      ui.photos = null; ui.goals = null;
      toast(dated ? 'Added — dated from the file, tap a photo to correct it'
          : files.length > 1 ? `${files.length} added` : 'Added');
      render();
    }catch(e){ toast(e.message || 'Could not save that photo'); }
  };
  inp.click();
}

export function viewPhoto(id){
  const sh = ui.photos?.find(x => x.id === id);
  if (!sh) return;
  openSheet(`
    <h2>${esc(dateOf(sh))}</h2>
    <p class="sub">Tap and hold the image to save or share it.</p>
    <img src="${urlFor(sh)}" style="width:100%;border-radius:var(--r-md);display:block;box-shadow:var(--clay)">

    <label class="label" style="margin-top:16px">Date taken</label>
    <div class="row" style="gap:9px">
      <input class="input grow" type="date" id="ph-date" value="${dayKey(sh.t)}" max="${today()}">
      <button class="btn btn-soft" data-act="savedate">Save</button>
    </div>
    <div class="tiny muted" style="margin-top:6px;line-height:1.5">
      Used for the order, the before/after picker and how many days apart two photos are.</div>

    <button class="btn btn-ghost block" style="margin-top:14px;color:var(--bad)" data-act="rm">Delete this photo</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
  `);
  bindActions(document.querySelector('.sheet'), {
    savedate: async () => {
      const v = sheetVal('ph-date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > today()){ toast('Pick a date up to today'); return; }
      const [y, m, d] = v.split('-').map(Number);
      // Noon local: a midnight timestamp lands on the previous day in any
      // timezone west of where it was set.
      await updatePhoto(id, { t: new Date(y, m - 1, d, 12).getTime() });
      ui.photos = null;
      closeSheet(); toast('Date updated'); render();
    },
    rm: async () => {
      await deletePhoto(id);
      if (ui.cmpA === id) ui.cmpA = null;
      if (ui.cmpB === id) ui.cmpB = null;
      ui.photos = null;
      closeSheet(); toast('Deleted'); render();
    },
    close: closeSheet,
  });
}

export async function removeGoal(id){
  await deletePhoto(id);
  ui.goals = null;
  render();
}

export const actions = {
  shoot: () => capturePhoto('cam'),
  pick: () => capturePhoto('lib'),
  pickgoal: () => capturePhoto('lib', 'goal'),
  rmgoal: d => removeGoal(d.id),
  viewphoto: d => viewPhoto(d.id),
  cmpa: (d, el) => { ui.cmpA = el.value; render(); },
  cmpb: (d, el) => { ui.cmpB = el.value; render(); },
};
