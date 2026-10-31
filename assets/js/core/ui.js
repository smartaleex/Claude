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
  kbRelease();
  onCloseCb = opts.onClose || null;
  requestAnimationFrame(() => {
    sheetEl.classList.add('on');
    scrimEl.classList.add('on');
  });
  return sheetEl;
}

export function closeSheet(){
  if (!sheetEl) return;
  // Put the keyboard away with the sheet; a hidden field can otherwise keep it up.
  if (sheetEl.contains(document.activeElement)) document.activeElement.blur?.();
  sheetEl.classList.remove('on');
  scrimEl.classList.remove('on');
  kbRelease();
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
/* A flat, muted tile whose hue comes from the name. How saturated it is
   belongs to the skin (--av-s, --av-l): earthy in Paper, grey in Instrument. */
export const avatarStyle = name =>
  `background:hsl(${hueFor(name)} var(--av-s, 30%) var(--av-l, 38%));color:#fff`;

/** A design token as a concrete colour, for canvas drawing (which cannot read var()). */
export const tok = (name, fallback = '#888') =>
  (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;
export const initials = name => name.trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();

/* ---------------- lightweight bar chart ---------------- */
export function barChart(canvas, { values, labels, target, colorFor, targetColor }){
  if (!canvas) return;
  targetColor = targetColor || tok('--warn');
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
    ctx.fillStyle = colorFor ? colorFor(v,i) : tok('--accent-1');
    roundRect(ctx, x, y, w, Math.max(bh, 3), Math.min(5, w/2));
    ctx.fill();
  });

  if (labels){
    ctx.fillStyle = tok('--muted');
    ctx.font = `500 10px ${tok('--f-mono', 'monospace')}`;
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
export function lineChart(canvas, { values, color, fill = true, band }){
  if (!canvas) return;
  color = color || tok('--accent-1');
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
  ctx.fillStyle = tok('--surface', '#fff');
  ctx.beginPath(); ctx.arc(X(last.i), Y(last.v), 1.7, 0, Math.PI*2); ctx.fill();
}

/* ---------------- the scrolling frame ----------------
   Screens redraw by replacing their HTML. The view is held at its old height
   for a frame so the scroll position never clamps, then released. */
export const scroller = () => document.getElementById('app');

export function holdScroll(paint){
  const sc = scroller(), view = document.getElementById('view');
  const y = sc ? sc.scrollTop : 0;
  if (view) view.style.minHeight = view.offsetHeight + 'px';
  try{ paint(); }
  finally{
    if (sc && Math.abs(sc.scrollTop - y) > 1) sc.scrollTop = y;
    requestAnimationFrame(() => { if (view) view.style.minHeight = ''; });
  }
}

export function scrollToTop(){ const sc = scroller(); if (sc) sc.scrollTop = 0; }

/* ---------------- on-screen keyboard ----------------
   On iOS the keyboard covers the page rather than resizing it, so a fixed
   bottom sheet can end up behind it and you type blind. The sheet is
   lifted by however much of the screen the keyboard covers (--kb).

   What this must NOT do, learned the hard way: infer "the keyboard has
   gone" from the numbers. While you type, iOS pans the page up, which
   shrinks the measured inset to zero even though the keyboard is still
   there. Treating that as "closed" scrolled the page back while you were
   typing, so the sheet jumped about and the timer dock flickered away.

   So the rules are: the keyboard is up only while a text field has focus;
   nothing is ever hidden because of it; the page is put back once, after
   focus has left and the keyboard has finished going away. */
export function keyboardInset(innerH, vvH, vvTop){
  return Math.max(0, Math.round(innerH - vvH - vvTop));
}

const TEXT_INPUT = /^(text|number|search|tel|email|url|password|date|time|datetime-local|month|week)?$/i;
export function isTyping(el){
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUT.test(el.getAttribute('type') || '');
}

/* A field that is removed while focused (the sheet closing on Save) does not
   always report losing focus, so closing or opening a sheet asks for this. */
let kbRelease = () => {};

/* After the keyboard closes, iOS can leave the layout viewport the size it
   was with the keyboard up, so fixed elements (the tab bar, the timer) sit
   halfway up the screen while the page behind them is the right size. The
   numbers JS can read look normal in that state, so there is nothing to
   test for; the only reliable cure is to make the page scroll. A one-pixel
   scroll and back, in consecutive frames, makes WebKit recompute the
   viewport. It is invisible, and harmless when nothing was stuck. */
export function unstick(y = scroller()?.scrollTop || 0){
  try{
    const sc = scroller();
    window.scrollTo(0, 0);                    // the document itself, in case something scrolled it
    if (sc){
      sc.scrollTop = y + 1;
      requestAnimationFrame(() => { sc.scrollTop = y; requestAnimationFrame(() => { sc.scrollTop = y; }); });
    }
  }catch{ /* no window, or blocked: nothing to do */ }
}

function watchKeyboard(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;   // loaded outside a browser (tests)
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let y0 = 0, raf = 0, backT = 0, wasTyping = false;

  const setKb = px => {
    const v = px + 'px';
    if (root.style.getPropertyValue('--kb') !== v) root.style.setProperty('--kb', v);
  };

  const apply = () => {
    raf = 0;
    const typing = isTyping(document.activeElement);
    const kb = typing ? keyboardInset(window.innerHeight, vv.height, vv.offsetTop) : 0;
    setKb(kb > 80 ? kb : 0);                 // small insets are browser toolbars, not a keyboard
  };
  const soon = () => { if (!raf) raf = requestAnimationFrame(apply); };

  vv.addEventListener('resize', soon);
  vv.addEventListener('scroll', soon);

  document.addEventListener('focusin', e => {
    clearTimeout(backT);
    if (!isTyping(e.target)) return;
    if (!wasTyping) y0 = scroller()?.scrollTop || 0;
    wasTyping = true;
    soon();
    // If the sheet is taller than the space left, bring the field into view once, without animation.
    if (e.target.closest?.('.sheet')) setTimeout(() => {
      if (document.activeElement === e.target) e.target.scrollIntoView?.({ block:'nearest' });
    }, 350);
  });

  const release = () => {
    // Focus often hops straight to another field; only act if it does not.
    clearTimeout(backT);
    // Opening or closing a sheet that never raised the keyboard must not touch the scroll position.
    if (!wasTyping) { setKb(0); return; }
    backT = setTimeout(() => {
      if (isTyping(document.activeElement)) return;
      wasTyping = false;
      setKb(0);
      // Let the keyboard finish leaving, then undo the browser's reveal-scroll, once.
      setTimeout(() => {
        if (isTyping(document.activeElement)) return;
        setKb(0);
        unstick(y0);
      }, 320);
    }, 120);
  };
  document.addEventListener('focusout', release);
  kbRelease = release;
  // Returning from the app switcher is the other time the viewport can come back wrong.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !isTyping(document.activeElement)) setTimeout(() => unstick(), 80); });
  window.addEventListener('pageshow', () => { if (!isTyping(document.activeElement)) setTimeout(() => unstick(), 80); });
}
watchKeyboard();
