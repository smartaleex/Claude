/* ============================================================
   store.js — persistence for every Alex HQ tool.

   Order of preference:
     1. window.storage  (Claude artifact runtime — survives chat reloads)
     2. localStorage    (normal browser / installed PWA — the usual case)
     3. in-memory       (private mode / storage blocked — session only)

   Every tool gets a namespaced slice. Writes are debounced so rapid
   interactions (tapping +1 five times) cost one write, not five.
   ============================================================ */

const NS = 'alexhq';
const memory = new Map();

const artifactStore =
  typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function'
    ? window.storage
    : null;

async function rawGet(key){
  if (artifactStore){
    try{
      const r = await artifactStore.get(key);
      if (r && typeof r.value === 'string') return r.value;
    }catch{ /* fall through */ }
  }
  try{
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  }catch{ /* blocked */ }
  return memory.has(key) ? memory.get(key) : null;
}

async function rawSet(key, value){
  if (artifactStore){
    try{ await artifactStore.set(key, value); return; }catch{ /* fall through */ }
  }
  try{ localStorage.setItem(key, value); return; }catch{ /* quota or blocked */ }
  memory.set(key, value);
}

/* ---------------- Slice ---------------- */

const cache = new Map();
const timers = new Map();
const listeners = new Map();

export class Slice {
  constructor(name, defaults){
    this.key = `${NS}:${name}`;
    this.name = name;
    this.defaults = defaults;
    this.data = null;
  }

  async load(){
    if (cache.has(this.key)){
      this.data = cache.get(this.key);
      return this.data;
    }
    const raw = await rawGet(this.key);
    let parsed = null;
    if (raw){
      try{ parsed = JSON.parse(raw); }catch{ parsed = null; }
    }
    // Shallow-merge defaults so new fields appear for existing users
    // without wiping what they've already saved.
    this.data = { ...structuredClone(this.defaults), ...(parsed || {}) };
    cache.set(this.key, this.data);
    return this.data;
  }

  get(){ return this.data; }

  /** Mutate then persist. `fn` receives the live object. */
  update(fn){
    if (fn) fn(this.data);
    cache.set(this.key, this.data);
    this._flushSoon();
    this._emit();
    return this.data;
  }

  _flushSoon(){
    clearTimeout(timers.get(this.key));
    timers.set(this.key, setTimeout(() => {
      rawSet(this.key, JSON.stringify(this.data));
    }, 180));
  }

  /** Force an immediate write — used before unload. */
  async flush(){
    clearTimeout(timers.get(this.key));
    await rawSet(this.key, JSON.stringify(this.data));
  }

  onChange(fn){
    if (!listeners.has(this.key)) listeners.set(this.key, new Set());
    listeners.get(this.key).add(fn);
    return () => listeners.get(this.key).delete(fn);
  }

  _emit(){
    const set = listeners.get(this.key);
    if (set) set.forEach(fn => fn(this.data));
  }
}

/* ---------------- whole-app backup ---------------- */

const ALL_SLICES = ['fuel','forge','ledger','shout','clear','vale','settings'];

export async function exportAll(){
  const out = { _app:'Alex HQ', _version:1, _exported:new Date().toISOString() };
  for (const n of ALL_SLICES){
    const raw = await rawGet(`${NS}:${n}`);
    if (raw){
      try{ out[n] = JSON.parse(raw); }catch{ /* skip corrupt slice */ }
    }
  }
  return out;
}

export async function importAll(obj){
  if (!obj || obj._app !== 'Alex HQ') throw new Error('Not an Alex HQ backup file.');
  for (const n of ALL_SLICES){
    if (obj[n] !== undefined){
      await rawSet(`${NS}:${n}`, JSON.stringify(obj[n]));
      cache.delete(`${NS}:${n}`);
    }
  }
}

export async function wipeAll(){
  for (const n of ALL_SLICES){
    await rawSet(`${NS}:${n}`, JSON.stringify({}));
    cache.delete(`${NS}:${n}`);
  }
}

/* Persist anything pending when the app is backgrounded — mobile
   Safari kills tabs aggressively and a debounced write can be lost. */
if (typeof document !== 'undefined'){
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden'){
      for (const [key, obj] of cache){
        clearTimeout(timers.get(key));
        rawSet(key, JSON.stringify(obj));
      }
    }
  });
}

/* ---------------- date helpers (shared by all tools) ---------------- */

export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
};
export const today = () => dayKey(new Date());
export const keyToDate = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
export const shiftDay = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate()+n); return dayKey(d); };
export const daysBetween = (a,b) => Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
export const lastNDays = n => {
  const out = []; let k = today();
  for (let i=0;i<n;i++){ out.unshift(k); k = shiftDay(k,-1); }
  return out;
};
export const fmtDay = k => keyToDate(k).toLocaleDateString('en-AU',{ weekday:'long', day:'numeric', month:'long' });
export const fmtDayShort = k => keyToDate(k).toLocaleDateString('en-AU',{ weekday:'short', day:'numeric', month:'short' });
export const fmtTime = t => new Date(t).toLocaleTimeString('en-AU',{ hour:'numeric', minute:'2-digit' }).toLowerCase().replace(' ','');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
