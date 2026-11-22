/* A JS file that is not in sw.js SHELL is missing when the phone is offline,
   and the app fails to start with no signal. Keep the list and the folder in
   step: every module on disk is listed, and every listed file exists. */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, done, ROOT } from '../lib.mjs';

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(p => p && !p.endsWith('/'));

const onDisk = [];
(function walk(dir){
  for (const f of readdirSync(join(ROOT, dir))){
    const rel = `${dir}/${f}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
    else if (f.endsWith('.js')) onDisk.push(rel);
  }
})('assets/js');

const missing = onDisk.filter(f => !listed.includes(f));
ok(missing.length === 0, `every JS file is in SHELL${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`);

const gone = listed.filter(f => !existsSync(join(ROOT, f)));
ok(gone.length === 0, `every SHELL entry exists${gone.length ? ' (not found: ' + gone.join(', ') + ')' : ''}`);

ok(/const CACHE = 'alexhq-v\d+'/.test(sw), 'CACHE has a build number');
done('shell-list');
