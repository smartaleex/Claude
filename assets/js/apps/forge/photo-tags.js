/* ============================================================
   Training: rested or post-workout, on progress photos.

   A photo added within a few hours of finishing a session is tagged with
   that session automatically ("After chest + shoulders"). The tag can be
   changed in the photo sheet. The before/after and the AI reading use it
   to discount the pump; the logic and wording live in core/pump.js.
   ============================================================ */

import { esc } from '../../core/ui.js';
import { updatePhoto } from '../../core/photos.js';
import { afterTag, pumpedAreas, sessionBefore, sessionRows, tagLabel } from '../../core/pump.js';
import { dayOf, phase, resolve, store } from './state.js';

const planRows = day => (day?.supersets || []).flatMap(ss => ss.exercises.map(ex => ({ n: resolve(ex, day.key).name, sets: parseInt(ex.sets, 10) || 0 })));

const tagForDay = (day, mins = null, sess = null) =>
  afterTag({ day: day?.key, title: day?.title || 'workout', areas: pumpedAreas(sess ? sessionRows(sess, planRows(day)) : planRows(day)), mins });

/** The tag for a photo taken at t: the session it followed, or undefined if none was close. */
export function autoTag(t){
  const hit = sessionBefore(Object.values(store.get().sessions || {}), t);
  return hit ? tagForDay(dayOf(hit.session.day), hit.mins, hit.session) : undefined;
}

/** Small corner badge on a thumbnail; only for post-workout shots. */
export const tagBadge = sh => sh.after ? `<span class="ph-tag">${esc(tagLabel(sh.after))}</span>` : '';

/** The chooser in the photo sheet. */
export function tagChooserHTML(sh){
  const cur = sh.after, on = k => (k === 'rest' ? cur === null : k === 'unknown' ? cur === undefined : cur?.day === k) ? 'on' : '';
  return `
    <label class="label" style="margin-top:16px">Taken</label>
    <div class="chips">
      <button class="chip ${on('rest')}" data-act="tagset" data-k="rest">Rested</button>
      ${phase().days.map(d => `<button class="chip ${on(d.key)}" data-act="tagset" data-k="${d.key}">After ${esc(d.title)}</button>`).join('')}
      <button class="chip ${on('unknown')}" data-act="tagset" data-k="unknown">Not sure</button>
    </div>
    <div class="tiny muted" style="margin-top:6px;line-height:1.5">
      ${cur ? `${esc(tagLabel(cur))}${cur.mins == null ? '' : cur.mins < 5 ? ', just after' : `, ${cur.mins} min after`}. ` : ''}A pump makes trained muscles look fuller for an hour or two.
      The comparison and the AI reading allow for it rather than counting it as progress.</div>`;
}

/** Save a choice from the chooser. k: 'rest' | 'unknown' | a day key. Keeps the minutes if
    the same session was auto-tagged. */
export async function setTag(sh, k){
  const tag = k === 'rest' ? null : k === 'unknown' ? undefined
    : sh.after?.day === k ? sh.after : tagForDay(dayOf(k));
  await updatePhoto(sh.id, { after: tag });
  return tag;
}
