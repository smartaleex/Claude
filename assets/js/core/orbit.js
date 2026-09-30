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
   never drifts. A pill sliding outward as the days pass is precisely the
   pressure that turns "I want to see her" into "I should text her", so
   the picture does not apply it to them.

   Each person is a pill with their name inside, so a pill is as wide as
   the name is long. That is why the caller passes real measured sizes:
   guessing "roughly a circle" is what hid labels behind neighbours in
   the first version. Sizes are in percent of the container width.

   Positions are stable — derived from the person's id, not their index —
   so a pill doesn't jump to a new spot every time data changes. Then a
   relaxation pass separates any that overlap.

   Pure: no DOM, so the layout can be tested without a browser.
   ============================================================ */

/* Radii as a percentage of the container width (centre is 50,50). */
export const RING = { inner: 15, fresh: 23.5, due: 32, edge: 41 };
export const PAD = 1.2;                 // breathing room around every pill, in %
/* The "N due" bubble in the middle is 17% wide and never moves. Pills must
   treat it as a wall, or a wide one on the inner ring slides underneath. */
export const CORE = { hw: 8.8, hh: 8.8 };          // the bubble is 15% wide, plus a margin
export const DEFAULT_SIZE = { w: 20, h: 9.5 };

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
 * items: [{ id, ratio, seeing, w, h }]   (w, h = measured pill size, % of container width)
 * returns: [{ id, x, y, r, tone }]       x/y = pill CENTRE, 0..100
 */
export function layoutOrbit(items){
  /* Each pill may drift within its own zone but never across the due ring —
     that line is the one thing the picture promises, so an on-track person
     must never be drawn as overdue, nor the reverse. */
  const pts = items.map((it, idx) => {
    const onTrack = it.seeing || !(it.ratio >= 1);
    const w = (Number.isFinite(it.w) ? it.w : DEFAULT_SIZE.w) + PAD;
    const h = (Number.isFinite(it.h) ? it.h : DEFAULT_SIZE.h) + PAD;
    const r0 = it.seeing ? RING.inner + 1.5 : radiusFor(it.ratio);
    const a = hash01(String(it.id)) * Math.PI * 2;
    return {
      id: it.id, idx, r0, tone: toneFor(it.ratio, it.seeing),
      hw: w / 2, hh: h / 2,
      lo: onTrack ? 14 : RING.due + 2,
      hi: onTrack ? RING.due - 2 : RING.edge,
      x: 50 + r0 * Math.cos(a), y: 50 + r0 * Math.sin(a),
    };
  });

  const radius = p => Math.hypot(p.x - 50, p.y - 50);
  const box = p => ({ l: p.x - p.hw, r: p.x + p.hw, t: p.y - p.hh, b: p.y + p.hh });

  const overlap = (A, B) => {
    const a = box(A), b = box(B);
    return [Math.min(a.r, b.r) - Math.max(a.l, b.l), Math.min(a.b, b.b) - Math.max(a.t, b.t)];
  };

  /* Separate overlapping footprints along whichever axis needs the least
     movement. Returns whether anything moved. */
  const separate = () => {
    let moved = false;
    for (let i = 0; i < pts.length; i++){
      for (let j = i + 1; j < pts.length; j++){
        const A = pts[i], B = pts[j];
        const [ox, oy] = overlap(A, B);
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
    // ...and off the fixed core, which cannot move out of the way.
    for (const P of pts){
      const b = box(P);
      const ox = Math.min(b.r, 50 + CORE.hw) - Math.max(b.l, 50 - CORE.hw);
      const oy = Math.min(b.b, 50 + CORE.hh) - Math.max(b.t, 50 - CORE.hh);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      if (ox < oy) P.x += (P.x >= 50 ? 1 : -1) * (ox + 0.05);
      else         P.y += (P.y >= 50 ? 1 : -1) * (oy + 0.05);
    }
    return moved;
  };

  /* Keep each pill inside its zone, gently toward its true radius, and
     entirely inside the container: a wide pill at the far left or right
     would otherwise run off the edge of the screen.

     When the wall is what stops it, slide the pill up or down the wall at
     the SAME radius. Pulling it toward the centre instead would drag an
     overdue person inside the due ring, which is the one thing this
     picture must never do. */
  const constrain = spring => {
    for (const p of pts){
      const r0 = radius(p) || 0.001;
      const r = Math.min(p.hi, Math.max(p.lo, r0 + (p.r0 - r0) * spring));
      const k = r / r0;
      p.x = 50 + (p.x - 50) * k;
      p.y = 50 + (p.y - 50) * k;

      const reachX = 50 - p.hw;                       // furthest the centre may sit from the middle, horizontally
      if (Math.abs(p.x - 50) > reachX){
        const sx = p.x >= 50 ? 1 : -1, sy = p.y >= 50 ? 1 : -1;
        p.x = 50 + sx * reachX;
        // stay on the ring: whatever horizontal room is lost is made up vertically
        p.y = 50 + sy * Math.sqrt(Math.max(0, r * r - reachX * reachX));
      }
      p.x = Math.min(100 - p.hw, Math.max(p.hw, p.x));
      p.y = Math.min(100 - p.hh, Math.max(p.hh, p.y));
    }
  };

  /* The three phases occasionally leave a small residue that the next
     phase would resolve, so run them as a few short rounds. */
  for (let round = 0; round < 4; round++){
    // Phase 1: separate while gently holding each pill near its true radius.
    for (let pass = 0; pass < 1500; pass++){
      const moved = separate();
      constrain(0.02);
      if (!moved) break;
    }
    // Phase 2: settle with no spring, so nothing is pulled back INTO an overlap.
    for (let pass = 0; pass < 3000; pass++){
      const moved = separate();
      constrain(0);
      if (!moved) break;
    }
    /* Phase 3: whatever is still touching is usually a pair pressed against
       a zone wall, where an axis-aligned nudge is undone by the constraint
       every pass. Slide such pills ALONG their ring instead — the wall
       cannot undo a move that keeps the radius. */
    for (let pass = 0; pass < 600; pass++){
      let moved = false;
      for (let i = 0; i < pts.length; i++){
        for (let j = i + 1; j < pts.length; j++){
          const A = pts[i], B = pts[j];
          const [ox, oy] = overlap(A, B);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          const need = Math.min(ox, oy) / 2 + 0.05;
          for (const [P, O] of [[A, B], [B, A]]){
            const r = radius(P) || 1, th = Math.atan2(P.y - 50, P.x - 50);
            // which way round the ring takes this pill away from the other one?
            const cross = (P.x - 50) * (O.y - P.y) - (P.y - 50) * (O.x - P.x);
            const d = (cross > 0 ? -1 : 1) * need / Math.max(r, 10);
            P.x = 50 + r * Math.cos(th + d);
            P.y = 50 + r * Math.sin(th + d);
          }
        }
      }
      constrain(0);
      if (!moved) break;
    }
  }

  return pts.map(p => ({ id: p.id, x: p.x, y: p.y, r: radius(p), tone: p.tone }));
}
