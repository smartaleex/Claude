#!/usr/bin/env node
/* ============================================================
   One command runs everything:

     npm test                    all unit and browser tests
     npm run test:unit           unit tests only (fast, no browser)
     node tests/run.mjs forge    only files whose name contains "forge"

   Unit tests are pure logic (tests/unit). Browser tests drive the real app
   in headless Chromium at phone size (tests/browser). One static server is
   started here and shared by every browser test.
   ============================================================ */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, startServer } from './lib.mjs';

const args = process.argv.slice(2);
const unitOnly = args.includes('--unit');
const filter = args.find(a => !a.startsWith('--'));

const list = dir => readdirSync(join(ROOT, 'tests', dir)).filter(f => f.endsWith('.test.mjs')).sort().map(f => ({ dir, f }));
let files = [...list('unit'), ...(unitOnly ? [] : list('browser'))];
if (filter) files = files.filter(x => x.f.includes(filter));
if (!files.length){ console.log('no tests match'); process.exit(1); }

const { srv, url } = await startServer();

function run({ dir, f }){
  return new Promise(res => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [join(ROOT, 'tests', dir, f)], { cwd: ROOT, env:{ ...process.env, BASE_URL:url } });
    let out = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', code => {
      const lines = out.split('\n');
      const passed = lines.filter(l => l.startsWith('ok  ')).length;
      const failed = lines.filter(l => l.startsWith('FAIL')).length;
      res({ dir, f, code, out, passed, failed, secs:((Date.now() - t0) / 1000).toFixed(1) });
    });
  });
}

// unit tests are instant; browser tests run three at a time
const results = [];
const queue = [...files];
await Promise.all(Array.from({ length: unitOnly ? 4 : 2 }, async () => {
  while (queue.length){ const r = await run(queue.shift()); results.push(r); }
}));
srv.close();

results.sort((a, b) => (a.dir + a.f).localeCompare(b.dir + b.f));
let bad = 0, total = 0;
for (const r of results){
  const good = r.code === 0 && r.failed === 0;
  total += r.passed; if (!good) bad++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${(r.dir + '/' + r.f).padEnd(40)} ${String(r.passed).padStart(3)} checks  ${r.secs}s`);
  if (!good){
    const lines = r.out.split('\n').filter(l => l.startsWith('FAIL') || /Error|error:/.test(l)).slice(0, 12);
    console.log(lines.map(l => '      ' + l).join('\n') || r.out.split('\n').slice(-12).map(l => '      ' + l).join('\n'));
  }
}
console.log(`\n${bad ? bad + ' file(s) FAILED' : 'all files passed'}  (${results.length} files, ${total} checks)`);
process.exit(bad ? 1 : 0);
