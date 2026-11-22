import { ok, done } from '../lib.mjs';
import { layoutOrbit, radiusFor, toneFor, RING, CORE } from '../../assets/js/core/orbit.js';

const rng = (seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32))(42);
const dist = p => Math.hypot(p.x - 50, p.y - 50);

ok(radiusFor(0) === RING.inner && radiusFor(1) === RING.due && radiusFor(2) === RING.edge && radiusFor(9) === RING.edge, 'radius: 0 -> inner, 1 -> due ring, 2+ -> edge');
ok(radiusFor(NaN) === RING.edge && radiusFor(undefined) === RING.edge, 'never logged -> outer edge');
ok(toneFor(.5, false) === 'good' && toneFor(1.2, false) === 'warn' && toneFor(1.7, false) === 'bad' && toneFor(5, true) === 'seeing', 'tones');
ok(layoutOrbit([]).length === 0, 'empty orbit');

let overlaps = 0, ringLies = 0, offscreen = 0, runs = 0;
for (let n = 1; n <= 14; n++) for (let rep = 0; rep < 12; rep++){
  const items = Array.from({ length:n }, (_, i) => ({
    id: 'p' + rep + '-' + i, ratio: rng() < .15 ? NaN : rng() * 2.6, seeing: rng() < .12,
    w: n > 8 ? 14 + rng() * 6 : 16 + rng() * 12, h: n > 8 ? 8 : 9.5,
  }));
  const out = layoutOrbit(items); runs++;
  ok(out.length === n, 'one position per person (' + n + ')') || 0;
  for (let i = 0; i < out.length; i++){
    const a = out[i], it = items[i];
    if (a.x - it.w / 2 < -0.01 || a.x + it.w / 2 > 100.01 || a.y < 0 || a.y > 100) offscreen++;
    const overdue = !it.seeing && it.ratio >= 1;
    // the dashed ring never lies: overdue is outside it, on track is inside it
    if (overdue && dist(a) < RING.due - 0.5) ringLies++;
    if (!overdue && !it.seeing && Number.isFinite(it.ratio) && dist(a) > RING.due + 0.5) ringLies++;
    for (let j = i + 1; j < out.length; j++){
      const b = out[j], jt = items[j];
      const ox = Math.min(a.x + it.w / 2, b.x + jt.w / 2) - Math.max(a.x - it.w / 2, b.x - jt.w / 2);
      const oy = Math.min(a.y + it.h / 2, b.y + jt.h / 2) - Math.max(a.y - it.h / 2, b.y - jt.h / 2);
      if (ox > 0.5 && oy > 0.5) overlaps++;
    }
    // nobody sits under the "N due" bubble
    const cx = Math.min(a.x + it.w / 2, 50 + CORE.hw) - Math.max(a.x - it.w / 2, 50 - CORE.hw);
    const cy = Math.min(a.y + it.h / 2, 50 + CORE.hh) - Math.max(a.y - it.h / 2, 50 - CORE.hh);
    if (cx > 0.5 && cy > 0.5 && n <= 8) overlaps++;
  }
}
ok(ringLies === 0, 'the due ring never lies across ' + runs + ' random orbits (' + ringLies + ' violations)');
ok(offscreen === 0, 'no pill runs off the edge (' + offscreen + ')');
ok(overlaps === 0, 'no overlapping pills or pills under the core (' + overlaps + ')');
const same = [{ id:'a', ratio:.5, w:20, h:9.5 }, { id:'b', ratio:1.4, w:24, h:9.5 }];
ok(JSON.stringify(layoutOrbit(same)) === JSON.stringify(layoutOrbit(same)), 'layout is deterministic (a pill does not jump between redraws)');
done('orbit');
