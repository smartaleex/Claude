/* ============================================================
   ui.js — tiny view helpers shared across all six tools.
   No framework: template strings + delegated events.
   ============================================================ */

/** Escape untrusted text before it goes into innerHTML. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
));

export const h = (strings, ...vals) => strings.reduce((a,s,i) => a + s + (vals[i] ?? ''), '');

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const pct = (v, t) => t > 0 ? clamp(v / t * 100, 0, 100) : 0;
export const round = (n, dp = 0) => { const m = 10 ** dp; return Math.round(n * m) / m; };

/** 12345.6 -> "12,346"  ·  money(1234.5) -> "$1,235" */
export const num = n => Math.round(n).toLocaleString('en-AU');
export const money = (n, dp = 0) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-AU',
  { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const haptic = (ms = 12) => { try{ navigator.vibrate?.(ms); }catch{} };

/* ---------------- toast ---------------- */
let toastEl, toastTimer;
export function toast(msg, ms = 2200){
  if (!toastEl){
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  requestAnimationFrame(() => toastEl.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

/* ---------------- bottom sheet ---------------- */
let sheetEl, scrimEl, onCloseCb = null;

function ensureSheet(){
  if (sheetEl) return;
  scrimEl = document.createElement('div');
  scrimEl.className = 'scrim';
  scrimEl.addEventListener('click', closeSheet);
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet';
  document.body.append(scrimEl, sheetEl);
}

export function openSheet(html, opts = {}){
  ensureSheet();
  sheetEl.innerHTML = `<div class="sheet-grip"></div>${html}`;
  sheetEl.scrollTop = 0;
  onCloseCb = opts.onClose || null;
  requestAnimationFrame(() => {
    sheetEl.classList.add('on');
    scrimEl.classList.add('on');
  });
  return sheetEl;
}

export function closeSheet(){
  if (!sheetEl) return;
  sheetEl.classList.remove('on');
  scrimEl.classList.remove('on');
  const cb = onCloseCb; onCloseCb = null;
  if (cb) cb();
}

export const sheetRoot = () => sheetEl;

/** Read a value out of the currently open sheet by element id. */
export const sheetVal = id => {
  const el = sheetEl?.querySelector('#' + id);
  return el ? el.value : '';
};
export const sheetNum = (id, fallback = 0) => {
  const v = parseFloat(sheetVal(id));
  return Number.isFinite(v) ? v : fallback;
};

/* ---------------- confirm ---------------- */
export function confirmSheet({ title, body, danger = true, confirmLabel = 'Delete' }){
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (settled) return; settled = true; resolve(v); };
    openSheet(`
      <h2>${esc(title)}</h2>
      <p class="sub">${esc(body)}</p>
      <button class="btn block ${danger ? 'btn-danger' : 'btn-ink'}" data-act="yes">${esc(confirmLabel)}</button>
      <button class="btn btn-ghost block" data-act="no">Cancel</button>
    `, { onClose: () => done(false) });

    sheetEl.querySelector('[data-act=yes]').onclick = () => { done(true); closeSheet(); };
    sheetEl.querySelector('[data-act=no]').onclick  = () => { done(false); closeSheet(); };
  });
}

/* ---------------- delegated events ----------------
   Views re-render by replacing innerHTML, so per-node listeners die.
   Instead each view declares `data-act` and we route centrally. */

const handlers = new Map();

export function bindActions(root, map){
  handlers.set(root, map);
  if (root.__bound) return;
  root.__bound = true;
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const map2 = handlers.get(root);
    const fn = map2 && map2[el.dataset.act];
    if (fn){ e.preventDefault(); fn(el.dataset, el, e); }
  });
  root.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const map2 = handlers.get(root);
    const fn = map2 && map2[el.dataset.change];
    if (fn) fn(el.dataset, el, e);
  });
}

/* ---------------- reusable fragments ---------------- */

export const heroBar = p => `<div class="bar"><i style="width:${p}%"></i></div>`;

export const meter = ({ label, value, target, unit = 'g', color, tint, bar }) => {
  const p = pct(value, target);
  const over = value > target;
  return `
  <div class="meter">
    <div class="meter-head">
      <span class="meter-lab" style="color:${color}">${esc(label)}</span>
      <span class="meter-val" style="color:${color}">${num(value)} <span>/ ${num(target)}${unit}</span></span>
    </div>
    <div class="meter-track" style="background:${bar}"><div class="meter-fill" style="width:${p}%;background:${color}"></div></div>
    <div class="meter-foot">${over ? num(value-target)+unit+' over' : num(target-value)+unit+' left'}</div>
  </div>`;
};

export const stat = (value, label, color) => `
  <div class="stat"><div class="v" ${color?`style="color:${color}"`:''}>${value}</div><div class="l">${esc(label)}</div></div>`;

export const empty = (icon, text) => `<div class="empty"><span class="ico">${icon}</span>${text}</div>`;

/** Deterministic colour from a name — used for mate avatars. */
export function hueFor(str){
  let hash = 0;
  for (let i=0;i<str.length;i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}
export const avatarStyle = name =>
  `background:linear-gradient(135deg, hsl(${hueFor(name)} 72% 58%), hsl(${(hueFor(name)+38)%360} 72% 48%))`;
export const initials = name => name.trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();

/* ---------------- lightweight bar chart ---------------- */
export function barChart(canvas, { values, labels, target, colorFor, targetColor = '#F2B705' }){
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320, cssH = canvas.clientHeight || 190;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,cssW,cssH);

  const padB = 26, padT = 8;
  const max = Math.max(target ? target*1.15 : 0, ...values, 1);
  const bw = cssW / values.length;

  values.forEach((v,i) => {
    const bh = (v / max) * (cssH - padB - padT);
    const x = i*bw + bw*0.2, w = bw*0.6, y = cssH - padB - bh;
    ctx.fillStyle = colorFor ? colorFor(v,i) : '#4F46E5';
    roundRect(ctx, x, y, w, Math.max(bh, 3), Math.min(5, w/2));
    ctx.fill();
  });

  if (labels){
    ctx.fillStyle = '#A7ADC0';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((lab,i) => { if (lab) ctx.fillText(lab, i*bw + bw/2, cssH - 9); });
  }

  if (target){
    const ty = cssH - padB - (target/max)*(cssH - padB - padT);
    ctx.strokeStyle = targetColor; ctx.setLineDash([6,5]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0,ty); ctx.lineTo(cssW,ty); ctx.stroke(); ctx.setLineDash([]);
  }
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);     ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/** Line chart for weight / trend series with gaps allowed (null values). */
export function lineChart(canvas, { values, color = '#4F46E5', fill = true, band }){
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 320, H = canvas.clientHeight || 160;
  canvas.width = W*dpr; canvas.height = H*dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);

  const pts = values.map((v,i) => ({ v, i })).filter(p => p.v != null);
  if (pts.length < 2) return;
  const vs = pts.map(p => p.v);
  let lo = Math.min(...vs, band?.[0] ?? Infinity), hi = Math.max(...vs, band?.[1] ?? -Infinity);
  const pad = (hi-lo) * 0.18 || 1; lo -= pad; hi += pad;
  const X = i => (i / (values.length-1)) * (W-8) + 4;
  const Y = v => H - 10 - ((v-lo)/(hi-lo)) * (H-20);

  if (band){
    ctx.fillStyle = color + '18';
    ctx.fillRect(0, Y(band[1]), W, Y(band[0]) - Y(band[1]));
  }

  ctx.beginPath();
  pts.forEach((p,k) => k ? ctx.lineTo(X(p.i), Y(p.v)) : ctx.moveTo(X(p.i), Y(p.v)));
  if (fill){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, color + '38'); g.addColorStop(1, color + '00');
    ctx.save(); ctx.lineTo(X(pts.at(-1).i), H); ctx.lineTo(X(pts[0].i), H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.beginPath();
    pts.forEach((p,k) => k ? ctx.lineTo(X(p.i), Y(p.v)) : ctx.moveTo(X(p.i), Y(p.v)));
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();

  const last = pts.at(-1);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(X(last.i), Y(last.v), 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(X(last.i), Y(last.v), 1.7, 0, Math.PI*2); ctx.fill();
}
