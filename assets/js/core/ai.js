/* ============================================================
   ai.js — one AI call, three ways to answer it, always free.

   TIER 1  Claude artifact runtime
           When this code runs inside a Claude artifact, fetch() to
           api.anthropic.com is proxied and billed to the chat, so no
           key is needed. This is how the original fuel.html worked.

   TIER 2  Google Gemini free tier
           On a real URL (GitHub Pages, home screen PWA) tier 1 is
           impossible: a public page cannot spend Anthropic's money
           anonymously, the call 401s. Gemini's free tier gives a key
           with no card and a daily quota far above personal use. The
           key is stored on-device only and never leaves the browser
           except to Google.

   TIER 3  Offline engines
           Deterministic local logic (food DB, macro solver, phrase
           bank). No network, no key, still useful. Every caller must
           supply one so the app degrades instead of breaking.
   ============================================================ */

import { Slice } from './store.js';

/* Models to try, cheapest/fastest first. A 429 on the very first call of
   the day is not rate limiting — it means that model has zero free-tier
   allowance in the user's Google project, which varies by project and
   changes over time. So treat 429 and 404 as "try the next model" rather
   than as fatal, and remember whichever one works. */
export const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
];

const settings = new Slice('settings', {
  geminiKey: '',
  aiEnabled: true,
  model: '',          // empty = auto-pick from MODEL_CHAIN
  callCount: 0,
  lastCallDay: '',
});

export function setModel(m){ settings.update(s => { s.model = m || ''; }); }

/** Preferred model first, then the rest of the chain as fallbacks. */
function modelOrder(){
  const pref = settings.get()?.model;
  return pref ? [pref, ...MODEL_CHAIN.filter(m => m !== pref)] : [...MODEL_CHAIN];
}

let ready = false;
export async function initAI(){ if (!ready){ await settings.load(); ready = true; } return settings; }
export const aiSettings = () => settings.get();
export function setKey(k){ settings.update(s => { s.geminiKey = (k||'').trim(); }); }

/* Detect the artifact sandbox. The runtime injects window.claude or
   window.storage; a bare browser has neither. */
export const inArtifact = () =>
  typeof window !== 'undefined' &&
  (!!window.claude?.complete || (!!window.storage && location.protocol !== 'https:'));

export function aiStatus(){
  const s = settings.get() || {};
  if (inArtifact()) return { tier:1, ok:true,  label:'Claude (artifact)', detail:'Keyless — billed to the chat.' };
  if (s.geminiKey)  return { tier:2, ok:true,  label:'Gemini free tier',  detail:'Your key, stored on this device.' };
  return { tier:3, ok:false, label:'Offline mode', detail:'Add a free Gemini key to switch AI features on.' };
}

/* ---------------- JSON extraction ----------------
   Models wrap JSON in prose or ```json fences no matter how firmly
   you ask them not to. Strip both, then balance-scan for the object. */
export function extractJSON(text){
  if (!text) throw new Error('empty response');
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/,'');
  const start = t.indexOf('{');
  if (start === -1) throw new Error('no JSON found');
  let depth = 0, inStr = false, escNext = false;
  for (let i = start; i < t.length; i++){
    const c = t[i];
    if (escNext){ escNext = false; continue; }
    if (c === '\\'){ escNext = true; continue; }
    if (c === '"'){ inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(t.slice(start, i+1));
  }
  throw new Error('unterminated JSON');
}

/* ---------------- Tier 1: Claude ---------------- */
async function callClaude({ prompt, images, maxTokens }){
  const content = [
    ...(images||[]).map(im => ({ type:'image', source:{ type:'base64', media_type:im.media, data:im.b64 } })),
    { type:'text', text: prompt },
  ];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:maxTokens, messages:[{ role:'user', content }] }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.type === 'error'){
    throw new Error(data?.error?.message?.slice(0,120) || `HTTP ${res.status}`);
  }
  return (data.content||[]).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

/* ---------------- Tier 2: Gemini ----------------
   Do NOT validate the key by prefix. Google has issued at least two
   shapes of Gemini API key — the older "AIzaSy…" and the current
   "AQ.Ab8…" that AI Studio hands out today — and will presumably issue
   more. A prefix check here just locks the user out of their own valid
   key, which is exactly what happened.

   Auth: the current quickstart uses the x-goog-api-key header, which
   accepts both shapes. The ?key= query parameter is the older style and
   still works, so it's kept as a fallback; Bearer covers OAuth tokens. */

const AUTH_MODES = ['header', 'query', 'bearer'];

function geminiRequest({ parts, maxTokens, model, key, mode }){
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const headers = { 'Content-Type':'application/json' };
  let url = base;
  if (mode === 'header')      headers['x-goog-api-key'] = key;
  else if (mode === 'bearer') headers['Authorization'] = `Bearer ${key}`;
  else                        url = `${base}?key=${encodeURIComponent(key)}`;
  return fetch(url, {
    method:'POST',
    headers,
    body: JSON.stringify({
      contents:[{ parts }],
      generationConfig:{ maxOutputTokens:maxTokens, temperature:0.4, responseMimeType:'application/json' },
    }),
  });
}

function geminiError(status, data){
  const m = data?.error?.message || `HTTP ${status}`;
  if (status === 429)
    return new Error('Every model your key can reach is out of free quota. Try again after midnight Pacific, or run Find a working model in Settings.');
  if (/API key not valid|API_KEY_INVALID/i.test(m))
    return new Error('Google rejected that key. Copy it again from AI Studio — it may have been truncated.');
  if (status === 401 || status === 403)
    return new Error('Google refused that key. Check it has not been deleted in AI Studio.');
  if (status >= 500) return new Error('Google had a server error. Try again shortly.');
  return new Error(m.slice(0, 140));
}

/** One model, cycling auth styles. Throws with .status attached. */
async function callModel({ parts, maxTokens, key, model }){
  let lastErr = null, lastStatus = 0;

  for (const mode of AUTH_MODES){
    let res, data;
    try{
      res = await geminiRequest({ parts, maxTokens, model, key, mode });
      data = await res.json().catch(() => null);
    }catch{
      const e = new Error('Could not reach Google. Check your connection.');
      e.status = 0; throw e;
    }

    if (res.ok && !data?.error){
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n');
      if (text) return text;
      const e = new Error(data?.promptFeedback?.blockReason
        ? `Google blocked that request (${data.promptFeedback.blockReason}).`
        : 'Google returned an empty response.');
      e.status = 200; throw e;   // not worth retrying anything
    }

    lastStatus = res.status;
    lastErr = geminiError(res.status, data);
    lastErr.status = res.status;
    // Only an auth rejection is worth a different auth style.
    if (res.status !== 401 && res.status !== 403) throw lastErr;
  }
  const e = lastErr || new Error('Gemini request failed.');
  e.status = lastStatus; throw e;
}

async function callGemini({ prompt, images, maxTokens, key }){
  const parts = [
    ...(images||[]).map(im => ({ inline_data:{ mime_type:im.media, data:im.b64 } })),
    { text: prompt },
  ];
  let lastErr = null;

  for (const model of modelOrder()){
    try{
      const text = await callModel({ parts, maxTokens, key, model });
      // Stick with whatever worked so the next call goes straight there.
      if (settings.get().model !== model) setModel(model);
      return text;
    }catch(e){
      lastErr = e;
      // Out of quota (429) or model not available to this key (404):
      // both mean "this model is a dead end", so try the next one.
      if (e.status !== 429 && e.status !== 404) throw e;
    }
  }
  throw lastErr || new Error('No Gemini model was available.');
}

/* ---------------- model discovery ----------------
   Asks Google which models this key can actually see, then sends a
   one-token probe to each so the user learns which are usable now
   rather than which merely exist. */
export async function discoverModels(key){
  const k = (key || settings.get().geminiKey || '').trim();
  if (!k) throw new Error('No key set.');

  let listed = [];
  try{
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models',
      { headers:{ 'x-goog-api-key': k } });
    const data = await res.json().catch(() => null);
    if (data?.models){
      listed = data.models
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));
    }
  }catch{ /* fall back to the built-in chain */ }

  // Probe the chain first (they're the ones we'd actually use), then any
  // other flash-class models the key can see.
  const extra = listed.filter(m => /flash|lite/i.test(m) && !MODEL_CHAIN.includes(m)).slice(0, 4);
  const candidates = [...MODEL_CHAIN.filter(m => !listed.length || listed.includes(m)), ...extra];

  const results = [];
  for (const model of candidates){
    try{
      await callModel({ parts:[{ text:'Reply with only: {"ok":true}' }], maxTokens:32, key:k, model });
      results.push({ model, ok:true, note:'Working' });
    }catch(e){
      results.push({ model, ok:false,
        note: e.status === 429 ? 'No free quota' : e.status === 404 ? 'Not available' : (e.message || 'Failed').slice(0,50) });
    }
  }
  const winner = results.find(r => r.ok);
  if (winner) setModel(winner.model);
  return { results, picked: winner?.model || null };
}

/** Cheap round-trip so the user finds out now, not mid-task. */
export async function testKey(key){
  await initAI();
  try{
    const txt = await callGemini({
      prompt:'Reply with only this JSON: {"ok":true}',
      images:[], maxTokens:64, key:(key||'').trim(),
    });
    extractJSON(txt);
    return { ok:true, message:`Working on ${settings.get().model} — AI features are on.` };
  }catch(e){
    return { ok:false, message:e.message };
  }
}

/* ---------------- public entry point ----------------
   ask({ prompt, images, offline, maxTokens })
     offline: () => value   required fallback, runs when no tier works
   Returns { data, source, tier, error }
*/
export async function ask({ prompt, images = [], offline = null, maxTokens = 1200 }){
  await initAI();
  const s = settings.get();
  const errors = [];

  if (s.aiEnabled){
    // Tier 1
    if (inArtifact()){
      try{
        const txt = await callClaude({ prompt, images, maxTokens });
        return { data: extractJSON(txt), source:'Claude', tier:1 };
      }catch(e){ errors.push('Claude: ' + e.message); }
    }
    // Tier 2
    if (s.geminiKey){
      try{
        const txt = await callGemini({ prompt, images, maxTokens, key:s.geminiKey });
        bumpCount();
        return { data: extractJSON(txt), source:'Gemini', tier:2 };
      }catch(e){ errors.push('Gemini: ' + e.message); }
    }
  }

  // Tier 3
  if (offline){
    const data = await offline();
    if (data) return { data, source:'Offline', tier:3, error: errors[0] || null };
  }

  const err = new Error(errors[0] || 'No AI available and nothing matched offline.');
  err.tiers = errors;
  throw err;
}

function bumpCount(){
  const d = new Date().toISOString().slice(0,10);
  settings.update(s => {
    if (s.lastCallDay !== d){ s.lastCallDay = d; s.callCount = 0; }
    s.callCount++;
  });
}

/* ---------------- image helper ---------------- */
/** Downscale before upload: a 12MP phone photo is ~4MB of base64 and
    adds seconds of latency for zero accuracy gain. */
export function fileToImage(file, maxDim = 1024){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode that image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width*scale), hh = Math.round(img.height*scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = hh;
        cv.getContext('2d').drawImage(img, 0, 0, w, hh);
        const url = cv.toDataURL('image/jpeg', 0.82);
        resolve({ b64: url.split(',')[1], media:'image/jpeg', url });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Strip characters that upset strict JSON round-trips in prompts. */
export const clean = s => String(s||'')
  .replace(/[‘’]/g, "'").replace(/[“”]/g,'"')
  .replace(/[–—]/g,'-').replace(/½/g,'1/2')
  .replace(/\s+/g,' ').trim();
