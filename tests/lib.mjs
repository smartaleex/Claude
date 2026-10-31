/* ============================================================
   Shared test helpers.

   Every test file is a plain node script: it prints "ok   message" or
   "FAIL message" per check and exits non-zero if anything failed. run.mjs
   starts one static server, runs every file against it and prints a summary.

   Browser tests drive the real app in headless Chromium at phone size, with
   fixed seed data in localStorage, so they test what you would see.
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'tests', 'out');

/* ---------------- checks ---------------- */
let failed = 0, passed = 0;
export function ok(cond, msg){
  if (cond){ passed++; console.log('ok  ', msg); }
  else { failed++; console.log('FAIL', msg); process.exitCode = 1; }
  return !!cond;
}
export const summary = () => ({ passed, failed });
export function done(name = ''){
  console.log(failed ? `${name}${name ? ': ' : ''}${failed} FAILED, ${passed} passed` : `${name}${name ? ': ' : ''}all ${passed} passed`);
  process.exit(failed ? 1 : 0);
}

/* ---------------- static server ---------------- */
const TYPES = {
  '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png',
  '.woff2':'font/woff2', '.svg':'image/svg+xml', '.ico':'image/x-icon',
};

export function startServer(port = 0){
  const srv = createServer(async (req, res) => {
    try{
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not a file');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
      res.end(await readFile(file));
    }catch{ res.writeHead(404).end('not found'); }
  });
  return new Promise(ok => srv.listen(port, '127.0.0.1', () => ok({ srv, url:`http://127.0.0.1:${srv.address().port}/` })));
}

/** Base URL for browser tests: from the runner, or start our own for a standalone run. */
export async function baseUrl(){
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const { url } = await startServer();
  return url;
}

/* ---------------- browser ---------------- */
function findChromium(){
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
  for (const r of roots){
    if (!existsSync(r)) continue;
    for (const d of readdirSync(r).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()){
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']){
        const f = join(r, d, sub); if (existsSync(f)) return f;
      }
    }
  }
  return undefined;          // let Playwright use its own install
}

export async function launch(opts = {}){
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: findChromium() });
  const ctx = await b.newContext({ viewport:{ width:393, height:852 }, isMobile:true, hasTouch:true, deviceScaleFactor:2, ...opts });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|favicon|ERR_|Failed to load resource/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
  const url = await baseUrl();
  return { b, ctx, p, errs, url };
}

/** Open the app with localStorage seeded exactly once (survives reloads in the same tab). */
export async function open(page, url, seed = {}){
  await page.addInitScript(s => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, seed);
  await page.goto(url + 'index.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(900);
}

export const go = async (page, app, ms = 600) => { await page.evaluate(a => window.navigate(a), app); await page.waitForTimeout(ms); };

/* ---------------- seed data ---------------- */
export const dayKey = (n = 0) => {
  const d = new Date(Date.now() - n * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A forge store in a known state. Override any field. */
export const forgeSeed = (over = {}) => ({
  blockIndex: 1, blockStart: dayKey(10),
  sessions: { old:{ id:'old', day:'d1', dayKey:dayKey(2), sets:{}, done:true } },
  lastByEx: {}, comeback: { off:true }, ...over,
});

/** A session in progress for day `day`, started 10 minutes ago. */
export const liveSession = (day = 'd2', sets = {}) =>
  ({ id:'act', day, dayKey:dayKey(0), sets, done:false, startedAt: Date.now() - 600000 });
