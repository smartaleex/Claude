/* ============================================================
   form.js — a small moving diagram of how an exercise is done.

   Every exercise is drawn from its movement: a stick figure at the start
   and end of the rep, with the bench, bar or cable it uses. The start is
   drawn faint underneath, so a still picture still shows the whole rep;
   animateForm() moves between the two.

   Matched by keywords (like swaps.js), so swapped-in or typed exercises get
   a diagram too. formOf() is pure and unit-tested; formSVG() returns an SVG
   string coloured from the skin's tokens (see .fm-* in app.css).
   ============================================================ */

import { plainName } from '../data/swaps.js';

/* side view, standing, facing right */
const S = { hd:[60,14], sh:[60,28], hp:[60,62], kn:[60,86], an:[60,112] };
/* front view, standing */
const F = { hd:[60,12], sh:[48,26], sh2:[72,26], hp:[60,62], kn:[54,86], an:[54,112], kn2:[66,86], an2:[66,112] };
/* hanging from a bar */
const HANG = { ha:[60,-4], el:[60,8], sh:[60,22], hd:[65,13], hp:[60,56], kn:[61,80], an:[58,102] };
const P = (o, x) => ({ ...o, ...x });
const SEAT = [[44,82,72,82],[56,82,56,112]];
const MACHINE_SEAT = [[34,82,64,82],[36,82,32,36],[48,82,48,112]];

/* A = start of the rep, B = the hard end. props = fixed lines (bench, bar). anchor = where a cable comes from.
   load = a weight in the hands; plate = a leg-press plate at the feet; pad = a roller pad at the ankle. */
export const POSES = {
  squat:{ A:P(S,{ el:[68,36], ha:[72,30] }), B:{ hd:[60,42], sh:[55,54], hp:[40,80], kn:[68,88], an:[60,112], el:[66,58], ha:[72,52] }, load:1 },
  hinge:{ A:P(S,{ el:[62,45], ha:[63,62] }), B:{ hd:[92,46], sh:[82,50], hp:[52,62], kn:[58,86], an:[60,112], el:[82,64], ha:[82,80] }, load:1 },
  lunge:{ A:{ hd:[58,14], sh:[58,28], hp:[56,62], kn:[70,86], an:[72,112], kn2:[46,84], an2:[30,80], el:[58,45], ha:[58,62] },
          B:{ hd:[60,32], sh:[60,46], hp:[54,80], kn:[78,88], an:[72,112], kn2:[42,104], an2:[30,80], el:[60,63], ha:[60,80] }, load:1,
          props:[[12,80,36,80],[16,80,16,112],[32,80,32,112]] },
  legpress:{ A:{ hd:[22,54], sh:[30,64], hp:[44,92], kn:[70,72], an:[96,54], el:[42,78], ha:[50,92] },
             B:{ hd:[22,54], sh:[30,64], hp:[44,92], kn:[54,62], an:[76,70], el:[42,78], ha:[50,92] }, plate:1,
             props:[[18,56,40,98],[40,98,64,98]] },
  legext:{ A:{ hd:[38,30], sh:[38,42], hp:[42,76], kn:[64,78], an:[66,106], el:[48,60], ha:[58,80] },
           B:{ hd:[38,30], sh:[38,42], hp:[42,76], kn:[64,78], an:[92,72], el:[48,60], ha:[58,80] }, pad:1, props:MACHINE_SEAT },
  legcurl:{ A:{ hd:[38,30], sh:[38,42], hp:[42,76], kn:[64,78], an:[92,72], el:[48,60], ha:[58,80] },
            B:{ hd:[38,30], sh:[38,42], hp:[42,76], kn:[64,78], an:[62,106], el:[48,60], ha:[58,80] }, pad:1, props:MACHINE_SEAT },
  thrust:{ A:{ hd:[22,60], sh:[30,66], hp:[50,96], kn:[74,84], an:[78,112], el:[44,86], ha:[52,92] },
           B:{ hd:[22,60], sh:[30,66], hp:[56,70], kn:[78,72], an:[78,112], el:[44,74], ha:[56,70] }, load:1,
           props:[[10,70,34,70],[14,70,14,112],[30,70,30,112]] },
  calf:{ A:{ hd:[60,18], sh:[60,32], hp:[60,66], kn:[60,90], an:[60,112], el:[60,49], ha:[60,66] },
         B:{ hd:[60,8], sh:[60,22], hp:[60,56], kn:[60,80], an:[62,104], el:[60,39], ha:[60,56] }, load:1, props:[[50,108,78,108]] },
  flatpress:{ A:{ hd:[26,70], sh:[36,74], hp:[72,74], kn:[88,82], an:[92,112], el:[37,58], ha:[38,42] },
              B:{ hd:[26,70], sh:[36,74], hp:[72,74], kn:[88,82], an:[92,112], el:[48,84], ha:[42,66] }, load:1,
              props:[[22,80,90,80],[30,80,30,112],[84,80,84,112]] },
  inclinepress:{ A:{ hd:[34,38], sh:[40,50], hp:[56,84], kn:[78,84], an:[82,112], el:[50,34], ha:[46,18] },
                 B:{ hd:[34,38], sh:[40,50], hp:[56,84], kn:[78,84], an:[82,112], el:[57,62], ha:[52,44] }, load:1,
                 props:[[50,90,74,90],[52,90,31,45],[62,90,62,112]] },
  pushup:{ A:{ hd:[22,62], sh:[30,68], hp:[66,88], kn:[84,98], an:[104,108], el:[32,88], ha:[32,108] },
           B:{ hd:[22,90], sh:[30,96], hp:[66,102], kn:[84,105], an:[104,108], el:[46,92], ha:[32,108] } },
  ohp:{ A:{ hd:[58,26], sh:[58,40], hp:[58,76], kn:[80,78], an:[82,112], el:[68,50], ha:[64,34] },
        B:{ hd:[58,26], sh:[58,40], hp:[58,76], kn:[80,78], an:[82,112], el:[62,14], ha:[60,-4] }, load:1,
        props:[...SEAT,[47,82,43,38]] },
  dip:{ A:{ hd:[60,8], sh:[60,22], hp:[58,56], kn:[64,76], an:[56,92], el:[61,38], ha:[62,54] },
        B:{ hd:[67,24], sh:[63,38], hp:[58,70], kn:[64,90], an:[56,106], el:[48,46], ha:[62,54] }, props:[[48,56,84,56],[80,56,80,112]] },
  fly:{ A:P(F,{ el:[30,30], ha:[14,36], el2:[90,30], ha2:[106,36] }), B:P(F,{ el:[50,42], ha:[58,46], el2:[70,42], ha2:[62,46] }), anchor:[[2,16],[118,16]] },
  rearfly:{ A:P(F,{ el:[50,40], ha:[57,42], el2:[70,40], ha2:[63,42] }), B:P(F,{ el:[32,28], ha:[14,28], el2:[88,28], ha2:[106,28] }) },
  lateral:{ A:P(F,{ el:[44,44], ha:[44,60], el2:[76,44], ha2:[76,60] }), B:P(F,{ el:[32,30], ha:[16,32], el2:[88,30], ha2:[104,32] }), load:1 },
  frontraise:{ A:P(S,{ el:[61,45], ha:[62,62] }), B:P(S,{ el:[74,30], ha:[90,28] }), anchor:[[66,112]] },
  shrug:{ A:P(F,{ el:[46,44], ha:[46,60], el2:[74,44], ha2:[74,60] }), B:P(F,{ sh:[48,20], sh2:[72,20], el:[46,38], ha:[46,54], el2:[74,38], ha2:[74,54] }), load:1 },
  wallslide:{ A:P(F,{ el:[36,30], ha:[38,12], el2:[84,30], ha2:[82,12] }), B:P(F,{ el:[42,4], ha:[38,-10], el2:[78,4], ha2:[82,-10] }) },
  facepull:{ A:P(S,{ el:[74,32], ha:[90,28] }), B:P(S,{ el:[50,22], ha:[66,16] }), anchor:[[110,22]] },
  row:{ A:{ hd:[62,40], sh:[57,52], hp:[48,80], kn:[74,72], an:[94,90], el:[72,60], ha:[88,62] },
        B:{ hd:[47,38], sh:[48,50], hp:[48,80], kn:[74,72], an:[94,90], el:[30,60], ha:[52,64] }, anchor:[[108,64]],
        props:[[34,86,62,86],[48,86,48,112],[98,78,98,112]] },
  pulldown:{ A:{ hd:[58,40], sh:[58,54], hp:[56,84], kn:[80,80], an:[82,112], el:[61,32], ha:[63,14] },
             B:{ hd:[55,40], sh:[54,54], hp:[56,84], kn:[80,80], an:[82,112], el:[45,66], ha:[56,50] }, anchor:[[63,-12]],
             props:[[44,88,68,88],[56,88,56,112]] },
  pullup:{ A:P(HANG,{}), B:{ ha:[60,-4], el:[46,12], sh:[58,8], hd:[64,-6], hp:[58,42], kn:[60,66], an:[54,84] }, props:[[30,-4,90,-4]] },
  pullover:{ A:{ hd:[54,18], sh:[56,30], hp:[60,62], kn:[62,86], an:[60,112], el:[68,18], ha:[80,8] },
             B:{ hd:[54,18], sh:[56,30], hp:[60,62], kn:[62,86], an:[60,112], el:[62,47], ha:[63,64] }, anchor:[[94,-10]] },
  curl:{ A:P(S,{ el:[60,46], ha:[62,64] }), B:P(S,{ el:[60,46], ha:[71,32] }), load:1 },
  pushdown:{ A:P(S,{ hd:[58,14], sh:[58,28], hp:[58,62], kn:[58,86], an:[58,112], el:[60,46], ha:[72,38] }),
             B:P(S,{ hd:[58,14], sh:[58,28], hp:[58,62], kn:[58,86], an:[58,112], el:[60,46], ha:[64,64] }), anchor:[[86,-10]] },
  crunch:{ A:{ kn:[60,112], an:[32,112], hp:[60,82], sh:[64,50], hd:[68,38], el:[74,46], ha:[70,36] },
           B:{ kn:[60,112], an:[32,112], hp:[60,82], sh:[84,72], hd:[94,67], el:[86,90], ha:[90,80] }, anchor:[[78,-12]] },
  legraise:{ A:P(HANG,{}), B:P(HANG,{ kn:[82,46], an:[88,70] }), props:[[30,-4,90,-4]] },
  hang:{ A:P(HANG,{}), B:P(HANG,{ sh:[60,25], hd:[65,16], hp:[60,59], kn:[61,83], an:[58,105] }), props:[[30,-4,90,-4]] },
  antirot:{ A:P(S,{ el:[66,44], ha:[68,36] }), B:P(S,{ el:[76,38], ha:[92,36] }), anchor:[[6,36]] },
  skull:{ A:{ hd:[26,70], sh:[36,74], hp:[72,74], kn:[88,82], an:[92,112], el:[38,52], ha:[39,36] },
          B:{ hd:[26,70], sh:[36,74], hp:[72,74], kn:[88,82], an:[92,112], el:[38,52], ha:[24,60] }, load:1,
          props:[[22,80,90,80],[30,80,30,112],[84,80,84,112]] },
  ohext:{ A:P(S,{ el:[62,8], ha:[64,-8] }), B:P(S,{ el:[62,8], ha:[48,24] }), load:1 },
  abwheel:{ A:{ kn:[48,112], an:[24,112], hp:[56,84], sh:[72,68], hd:[80,58], el:[72,88], ha:[72,106] },
            B:{ kn:[48,112], an:[24,112], hp:[62,98], sh:[90,96], hd:[100,90], el:[100,102], ha:[108,108] } },
  deadbug:{ A:{ hd:[20,100], sh:[30,104], hp:[64,104], kn:[64,82], an:[86,82], el:[30,88], ha:[30,74] },
            B:{ hd:[20,100], sh:[30,104], hp:[64,104], kn:[84,98], an:[104,104], el:[22,92], ha:[14,84] } },
};

/* Name -> movement. First match wins, so specific wordings sit above general ones
   (an incline curl is a curl, a leg press is not a press, a leg curl is not a curl). */
const RULES = [
  [/front raise/i, 'frontraise'],
  [/lateral raise|upright row|lean-?away/i, 'lateral'],
  [/skull|french press/i, 'skull'],
  [/overhead.*extension/i, 'ohext'],
  [/ab wheel|rollout/i, 'abwheel'],
  [/face pull/i, 'facepull'],
  [/rear delt|reverse pec|reverse fly|pull-apart|band pull/i, 'rearfly'],
  [/wall slide|y-raise/i, 'wallslide'],
  [/shrug/i, 'shrug'],
  [/hip thrust|glute bridge/i, 'thrust'],
  [/romanian|\brdl\b|deadlift|good morning|back extension|hyperextension|pull-?through/i, 'hinge'],
  [/leg curl/i, 'legcurl'],
  [/leg extension/i, 'legext'],
  [/leg press/i, 'legpress'],
  [/split squat|bulgarian|lunge|step-?up|couch stretch/i, 'lunge'],
  [/squat|hack/i, 'squat'],
  [/calf/i, 'calf'],
  [/crunch/i, 'crunch'],
  [/leg raise|knee raise|captain/i, 'legraise'],
  [/dead hang|scapular/i, 'hang'],
  [/pallof|woodchop|anti-?rotation/i, 'antirot'],
  [/dead bug|plank/i, 'deadbug'],
  [/curl|preacher|bayesian/i, 'curl'],
  [/pushdown|kickback|tricep/i, 'pushdown'],
  [/straight-?arm|pull-?over/i, 'pullover'],
  [/pull-?ups?\b|chin-?ups?\b/i, 'pullup'],
  [/pulldown|high row|vertical row/i, 'pulldown'],
  [/row/i, 'row'],
  [/\bdips?\b/i, 'dip'],
  [/\bfly|flye|crossover|pec deck/i, 'fly'],
  [/landmine/i, 'inclinepress'],
  [/shoulder press|\bohp\b|overhead press|military|arnold/i, 'ohp'],
  [/push-?ups?/i, 'pushup'],
  [/incline/i, 'inclinepress'],
  [/press|bench/i, 'flatpress'],
];

/** The movement key for an exercise name, or null when there is no diagram for it. */
export function formOf(name){
  const n = plainName(name || '');
  for (const [re, key] of RULES) if (re.test(n)) return key;
  return null;
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function poseAt(key, t){
  const p = POSES[key], o = {};
  for (const k in p.A) o[k] = lerp(p.A[k], p.B[k] || p.A[k], t);
  return o;
}

const f1 = n => n.toFixed(1);
function figure(p, cls){
  const L = (a, b) => p[a] && p[b] ? `<line x1="${f1(p[a][0])}" y1="${f1(p[a][1])}" x2="${f1(p[b][0])}" y2="${f1(p[b][1])}"/>` : '';
  let s = `<g class="${cls}">`;
  if (p.sh2){
    p.mid = [(p.sh[0] + p.sh2[0]) / 2, (p.sh[1] + p.sh2[1]) / 2];
    s += L('sh', 'sh2') + L('mid', 'hp') + L('sh2', 'el2') + L('el2', 'ha2');
  } else s += L('sh', 'hp');
  s += L('sh', 'el') + L('el', 'ha') + L('hp', 'kn') + L('kn', 'an') + L('hp', 'kn2') + L('kn2', 'an2');
  return s + `<circle cx="${f1(p.hd[0])}" cy="${f1(p.hd[1])}" r="${p.sh2 ? 8 : 7}"/></g>`;
}

/** The inside of the SVG at time t (0 = start of the rep, 1 = the hard end). */
export function formMarkup(key, t = 1){
  const pt = POSES[key];
  if (!pt) return '';
  let s = `<g class="fm-prop">${(pt.props || []).map(l => `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"/>`).join('')}<line class="fm-floor" x1="4" y1="113.5" x2="116" y2="113.5"/></g>`;
  s += figure(poseAt(key, 0), 'fm-ghost');
  const p = poseAt(key, t);
  if (pt.anchor) s += `<g class="fm-cable">${pt.anchor.map((a, i) => { const h = i ? p.ha2 : p.ha; return h ? `<line x1="${a[0]}" y1="${a[1]}" x2="${f1(h[0])}" y2="${f1(h[1])}"/>` : ''; }).join('')}</g>`;
  s += figure(p, 'fm-body');
  if (pt.load) s += [p.ha, p.ha2].filter(Boolean).map(h => `<rect class="fm-load" x="${f1(h[0] - 4)}" y="${f1(h[1] - 3)}" width="8" height="6" rx="1.5"/>`).join('');
  if (pt.plate) s += `<line class="fm-plate" x1="${f1(p.an[0] + 2)}" y1="${f1(p.an[1] - 14)}" x2="${f1(p.an[0] + 10)}" y2="${f1(p.an[1] + 10)}"/>`;
  if (pt.pad) s += `<circle class="fm-load" cx="${f1(p.an[0])}" cy="${f1(p.an[1] - 5)}" r="4.5"/>`;
  return s;
}

/** A still diagram for an exercise name: start faint, end solid. Empty string when there is none. */
export function formSVG(name, { size = 44, cls = '' } = {}){
  const key = formOf(name);
  if (!key) return '';
  return `<svg class="fm ${cls}" viewBox="0 -14 120 130" width="${size}" height="${size}" aria-hidden="true" data-form="${key}">${formMarkup(key, 1)}</svg>`;
}

/* ---------------- moving it ---------------- */
let raf = 0;
/** Animate one SVG (made by formSVG) through the rep, about 2.6s a cycle. One at a time; a new call stops the last. */
export function animateForm(svg){
  cancelAnimationFrame(raf);
  const key = svg?.dataset?.form;
  if (!key || !POSES[key]) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;     // the still picture already shows both ends
  const t0 = performance.now();
  const step = now => {
    if (!svg.isConnected) return;
    const ph = ((now - t0) / 2600) % 1;
    svg.innerHTML = formMarkup(key, (1 - Math.cos(ph * 2 * Math.PI)) / 2);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
export const stopForm = () => cancelAnimationFrame(raf);
