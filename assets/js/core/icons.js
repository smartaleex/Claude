/* ============================================================
   icons.js — the drawn icon set.

   Emoji were placeholders and they made the app look cheap: they carry
   another vendor's art direction, they render differently on every
   platform, and they can't take the accent colour.

   One system instead. 24×24 grid, 1.7 stroke, round caps and joins,
   drawn on whole or half units so nothing sits on a blurry subpixel.
   Everything inherits currentColor, so an icon picks up whatever colour
   its context has.
   ============================================================ */

const P = {
  /* Sunrise — the brand mark, matching the app icon. */
  hq: '<path d="M4.5 17.5h15M6.5 21h11"/><path d="M6.5 13.5a5.5 5.5 0 0 1 11 0"/>',

  /* Compass — grounding, orientation, "where am I today". */
  day: '<circle cx="12" cy="12" r="8.5"/><path d="M15.2 8.8 13.6 13.6 8.8 15.2 10.4 10.4Z"/>',

  /* Bowl with rising steam. */
  food: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-8.5-8.5Z"/><path d="M9 7.5c0-1 1-1.4 1-2.4M12.5 7c0-1.2 1.2-1.7 1.2-2.9"/>',

  /* Dumbbell. */
  training: '<path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5"/><path d="M6 12h12"/>',

  /* Wallet with a clasp. */
  money: '<rect x="3" y="6" width="18" height="13" rx="3.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.4"/>',

  /* Two people. */
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M16 5.9a3.2 3.2 0 0 1 0 5.2M17.5 14.2a5.5 5.5 0 0 1 3 5.3"/>',

  /* Descending steps — a taper. */
  nicotine: '<path d="M4 19.5h3.5v-5H4zM10.25 19.5h3.5v-9h-3.5zM16.5 19.5H20V5.5h-3.5z"/>',

  /* Two speech bubbles — conversation. */
  spanish: '<path d="M3.5 8.5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H8l-4.5 3z"/><path d="M17.5 9.5h.5a3 3 0 0 1 3 3v2.5a3 3 0 0 1-2 2.8V21l-3-2.5"/>',

  /* Grid — the daily puzzle. */
  puzzle: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9.17 3.5v17M14.83 3.5v17M3.5 9.17h17M3.5 14.83h17"/>',

  /* Sliders. */
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/>',

  more: '<circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M3.5 8.5a2 2 0 0 1 2-2h2l1.5-2h6L16.5 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
  spark: '<path d="M12 3.5 13.9 9.4 19.8 11.3 13.9 13.2 12 19.1 10.1 13.2 4.2 11.3 10.1 9.4Z"/><path d="M18.5 4v3M20 5.5h-3"/>',
  moon: '<path d="M19.5 14.3A8 8 0 0 1 9.7 4.5a8 8 0 1 0 9.8 9.8Z"/>',
  pill: '<rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><path d="M9.6 9.6 14.4 14.4"/>',
  dog: '<path d="M12 20c3.3 0 6-2.4 6-5.5 0-4.4-2.7-9.3-6-9.3s-6 4.9-6 9.3C6 17.6 8.7 20 12 20Z"/><path d="M6.3 9.1C4.9 8.5 3.4 9.6 3.4 11.5c0 1.9 1.2 3.4 2.6 3.7M17.7 9.1c1.4-.6 2.9.5 2.9 2.4 0 1.9-1.2 3.4-2.6 3.7"/><circle cx="12" cy="14.4" r="1" fill="currentColor" stroke="none"/>',
  leaf: '<path d="M20 4c0 9-5.5 13-9.5 13A5.5 5.5 0 0 1 5 11.5C5 7 10 4 20 4Z"/><path d="M16 8 5.5 19.5"/>',
  repeat: '<path d="M4 9.5A5.5 5.5 0 0 1 9.5 4h6.2M20 14.5A5.5 5.5 0 0 1 14.5 20H8.3"/><path d="M13.2 1.8 16.4 4l-3.2 2.2M10.8 22.2 7.6 20l3.2-2.2"/>',
  flame: '<path d="M12 21c3.6 0 6-2.4 6-5.6 0-3.6-3-5.4-3.6-9.4-2 1-3 2.6-3 4.4-1.2-.6-1.8-1.6-2-3-2 1.8-3.4 4.4-3.4 8C6 18.6 8.4 21 12 21Z"/>',
  box: '<path d="M4 8.5 12 4.5l8 4v7l-8 4-8-4z"/><path d="M4 8.5 12 12.5l8-4M12 12.5v7"/>',
  note: '<path d="M5 4.5h14v15l-3.2-2.4-2.4 2.4-2.4-2.4L8.6 19.5 5 17.1z"/><path d="M9 9.5h6M9 13h4"/>',
};

/**
 * @param {string} name  key from the set above
 * @param {number} size  px, default 22
 */
export function icon(name, size = 22, extra = ''){
  const d = P[name];
  if (!d) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" class="ico ${extra}">${d}</svg>`;
}

export const hasIcon = n => !!P[n];
