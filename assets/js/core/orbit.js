/* ============================================================
   orbit.js — where each person sits in your orbit.

   Distance from the centre is how far through their own cadence you
   are, not raw days: a weekly friend at ten days is further out than a
   twice-a-year friend at forty. So the rings mean something fixed:

     centre .. inner ring   caught up recently, well inside the cadence
     the dashed ring        exactly due
     beyond it              overdue, and drifting the further out it goes
     the outer edge         twice the cadence or more, or never logged

   Someone you are seeing is deliberately pinned to the inner ring and
   never drifts. A dot sliding outward as the days pass is precisely the
   pressure that turns "I want to see her" into "I should text her", so
   the picture does not apply it to them.

   Positions are stable — derived from the person's id, not their index —
   so a dot doesn't jump to a new spot every time data changes. Then a
   short relaxation pass pushes apart any that landed too close.

   Pure: no DOM, so the layout can be tested without a browser.
   ============================================================ */

/* Radii as a percentage of the container width (centre is 50,50). */
export const RING = { inner: 15, fresh: 23.5, due: 32, edge: 41 };

/* A dot is not just a circle: it carries a name under it. Collision uses
   the whole footprint — dot plus label — as a box, all in percent of the
   container width. Labels go on the OUTWARD side (up for dots in the top
   half, down for the bottom), because the middle is where everything else
   is, and a label pointing inward is what got hidden behind a neighbour. */
export const BOX = { hw: 7.2, dot: 6.9, label: 6.6 };   // dot = half the dot PLUS its status ring
/** Ratio (days since / cadence) -> radius, as a percentage of container width. */
export function radiusFor(ratio){
  const r = Number.isFinite(ratio) ? Math.max(0, ratio) : 2;
  if (r <= 1) return RING.inner + (RING.due - RING.inner) * r;             // 0 -> inner, 1 -> due ring
  if (r < 2)  return RING.due + (RING.edge - RING.due) * (r - 1);          // 1..2 -> due..edge
  return RING.edge;
}

/** Small stable hash -> [0, 1). */
function hash01(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export function toneFor(ratio, seeing){
  if (seeing) return 'seeing';
  if (ratio >= 1.6) return 'bad';
  if (ratio >= 1)   return 'warn';
  return 'good';       // same three colours as the roster; closeness is shown by position, not a fourth colour
}

/**
 * items: [{ id, ratio, seeing }]
 * returns: [{ id, x, y, r, tone }]  with x/y in 0..100 (percent of container)
 */
export function layoutOrbit(items){
  /* Each dot may drift within its own zone but never across the due ring —
     that line is the one thing the picture promises, so an on-track person
     must never be drawn as overdue, nor the reverse. */
  const pts = items.map((it, idx) => {
    const onTrack = it.seeing || !(it.ratio >= 1);
    const r0 = it.seeing ? RING.inner + 1.5 : radiusFor(it.ratio);
    const a = hash01(String(it.id)) * Math.PI * 2;
    const x = 50 + r0 * Math.cos(a), y = 50 + r0 * Math.sin(a);
    return {
      id: it.id, idx, r0, tone: toneFor(it.ratio, it.seeing),
      lo: onTrack ? 14 : RING.due + 2,
      hi: onTrack ? RING.due - 2 : RING.edge,
      x, y,
      up: y < 50,                 // label side, fixed from the starting position so it cannot flip-flop
    };
  });

  const radius = p => Math.hypot(p.x - 50, p.y - 50);
  const box = p => ({
    l: p.x - BOX.hw, r: p.x + BOX.hw,
    t: p.up ? p.y - BOX.dot - BOX.label : p.y - BOX.dot,
    b: p.up ? p.y + BOX.dot : p.y + BOX.dot + BOX.label,
  });

  /* Separate overlapping footprints along whichever axis needs the least
     movement, then pull each dot back inside its zone and gently toward
     its true radius. Deterministic: same input, same output. */
  const separate = () => {
    let moved = false;
    for (let i = 0; i < pts.length; i++){
      for (let j = i + 1; j < pts.length; j++){
        const A = pts[i], B = pts[j], a = box(A), b = box(B);
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy){
          const dir = A.x === B.x ? (i % 2 ? 1 : -1) : Math.sign(A.x - B.x);
          A.x += dir * (ox / 2 + 0.05); B.x -= dir * (ox / 2 + 0.05);
        } else {
          const dir = A.y === B.y ? (i % 2 ? 1 : -1) : Math.sign(A.y - B.y);
          A.y += dir * (oy / 2 + 0.05); B.y -= dir * (oy / 2 + 0.05);
        }
      }
    }
    return moved;
  };
  const clampZone = spring => {
    for (const p of pts){
      const r = radius(p) || 0.001;
      const want = Math.min(p.hi, Math.max(p.lo, r + (p.r0 - r) * spring));
      const k = want / r;
      p.x = 50 + (p.x - 50) * k;
      p.y = 50 + (p.y - 50) * k;
    }
  };

  // Phase 1: separate while gently holding each dot near its true radius.
  for (let pass = 0; pass < 1500; pass++){
    const moved = separate();
    clampZone(0.02);
    if (!moved) break;
  }
  // Phase 2: settle with no spring at all, so nothing is pulled back INTO
  // an overlap. Only the zone limits (the due ring's promise) still apply.
  for (let pass = 0; pass < 3000; pass++){
    const moved = separate();
    clampZone(0);
    if (!moved) break;
  }

  /* Phase 3: whatever is still touching is usually a pair pressed against
     a zone wall, where an axis-aligned nudge is undone by the clamp every
     pass. Slide such dots ALONG their ring instead — the wall cannot
     undo a move that keeps the radius. */
  for (let pass = 0; pass < 600; pass++){
    let moved = false;
    for (let i = 0; i < pts.length; i++){
      for (let j = i + 1; j < pts.length; j++){
        const A = pts[i], B = pts[j], a = box(A), b = box(B);
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const need = Math.min(ox, oy) / 2 + 0.05;
        for (const [P, sgn] of [[A, 1], [B, -1]]){
          const r = radius(P) || 1, th = Math.atan2(P.y - 50, P.x - 50);
          // which way round the ring takes this dot away from the other one?
          const O = P === A ? B : A;
          const cross = (P.x - 50) * (O.y - P.y) - (P.y - 50) * (O.x - P.x);
          const dir = cross > 0 ? -1 : 1;
          const d = dir * need / Math.max(r, 10);
          P.x = 50 + r * Math.cos(th + d);
          P.y = 50 + r * Math.sin(th + d);
        }
      }
    }
    clampZone(0);
    if (!moved) break;
  }

  return pts.map(p => ({ id: p.id, x: p.x, y: p.y, r: radius(p), tone: p.tone, up: p.up }));
}
