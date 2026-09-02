/* ============================================================
   photos.js — image storage, deliberately NOT in localStorage.

   A compressed physique photo is 80-150KB of base64. localStorage caps
   at about 5MB across the whole origin, so twenty photos would fill it
   and every subsequent write — macros, meds, sleep — would start
   throwing QuotaExceededError. One feature would take down the app.

   IndexedDB instead: hundreds of MB, stores Blobs natively (no base64
   inflation), and completely separate from the app's other data.
   ============================================================ */

const DB = 'alexhq-photos';
const STORE = 'photos';
let dbp = null;

function open(){
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath:'id' });
        os.createIndex('album', 'album');
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

async function tx(mode, fn){
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}

/**
 * Downscale and re-encode before storing. A phone photo is 12MP; for
 * comparing week to week, 900px on the long edge is plenty and keeps
 * each shot around 100KB.
 */
export function compress(file, maxDim = 900, quality = 0.75){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read that image.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode that image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('Could not compress that image.')),
                  'image/jpeg', quality);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

export async function addPhoto(album, blob, meta = {}){
  const id = `${album}:${Date.now()}:${Math.random().toString(36).slice(2,7)}`;
  const rec = { id, album, blob, t: Date.now(), ...meta };
  await tx('readwrite', os => os.put(rec));
  return rec;
}

export async function listPhotos(album){
  const all = await tx('readonly', os => os.index('album').getAll(album));
  return (all || []).sort((a,b) => a.t - b.t);
}

export async function deletePhoto(id){ await tx('readwrite', os => os.delete(id)); }

/** Object URLs must be revoked or the tab leaks memory as you scroll. */
const urls = new Map();
export function urlFor(rec){
  if (!urls.has(rec.id)) urls.set(rec.id, URL.createObjectURL(rec.blob));
  return urls.get(rec.id);
}
export function releaseUrls(){
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
}

export async function usage(){
  try{
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usedMB: Math.round(e.usage / 1e6 * 10) / 10, quotaMB: Math.round(e.quota / 1e6) };
  }catch{ return null; }
}
