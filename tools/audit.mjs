#!/usr/bin/env node
/* ============================================================
   audit.mjs — where the code has grown, and what nothing uses.

     npm run audit

   Prints: the biggest files, the longest functions, exports that nothing
   imports, top-level helpers that are defined and never called, and names
   defined in more than one file. A heuristic (regex, not a parser), so
   treat a hit as "look at this", not "delete this". It exists so cleanup
   starts from facts.
   ============================================================ */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const walk = (d, out = []) => {
  for (const f of readdirSync(d)){
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|mjs)$/.test(f)) out.push(p);
  }
  return out;
};
const files = walk(join(ROOT, 'assets', 'js'));
const rel = p => relative(ROOT, p);
const src = Object.fromEntries(files.map(f => [f, readFileSync(f, 'utf8')]));
const count = (name, text) => (text.match(new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) || []).length;

// ---- file sizes
console.log('FILES by length');
for (const [f, t] of Object.entries(src).map(([f, t]) => [f, t.split('\n').length]).sort((a, b) => b[1] - a[1]).slice(0, 14))
  console.log(`  ${String(t).padStart(5)}  ${rel(f)}`);

// ---- longest functions: brace matching from each top-level `function name(`
const fns = [];
for (const [f, t] of Object.entries(src)){
  const re = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm;
  let m;
  while ((m = re.exec(t))){
    let i = t.indexOf('{', m.index + m[0].length), depth = 0, j = i;
    // skip the parameter list (which may contain braces for destructuring)
    let k = m.index + m[0].length, par = 1;
    while (k < t.length && par){ if (t[k] === '(') par++; else if (t[k] === ')') par--; k++; }
    i = t.indexOf('{', k); depth = 0;
    for (j = i; j < t.length; j++){
      const c = t[j];
      // a lone brace in quotes ('{' or "}") is text, not structure
      if ((c === "'" || c === '"') && (t[j+1] === '{' || t[j+1] === '}') && t[j+2] === c){ j += 2; continue; }
      if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
    }
    fns.push({ f, name: m[1], lines: t.slice(m.index, j).split('\n').length });
  }
}
console.log('\nLONGEST functions (over 60 lines)');
for (const x of fns.sort((a, b) => b.lines - a.lines).filter(x => x.lines > 60).slice(0, 15))
  console.log(`  ${String(x.lines).padStart(5)}  ${x.name}  (${rel(x.f)})`);

// ---- exports nothing imports
console.log('\nEXPORTS nothing else uses');
let unusedExports = 0;
for (const [f, t] of Object.entries(src)){
  const re = /^export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z0-9_$]+)/gm;
  let m;
  while ((m = re.exec(t))){
    const others = Object.entries(src).filter(([g]) => g !== f).map(([, u]) => u).join('\n') + readFileSync(join(ROOT, 'index.html'), 'utf8');
    if (!count(m[1], others) && count(m[1], t) <= 1){ console.log(`  ${m[1]}  (${rel(f)})`); unusedExports++; }
  }
}
if (!unusedExports) console.log('  none');

// ---- local helpers defined and never called
console.log('\nHELPERS defined but never used');
let unusedLocals = 0;
for (const [f, t] of Object.entries(src)){
  const re = /^(?:async\s+)?(?:function\s+([A-Za-z0-9_$]+)\s*\(|const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)/gm;
  let m;
  while ((m = re.exec(t))){
    const name = m[1] || m[2];
    if (/^export/.test(t.slice(Math.max(0, m.index - 7), m.index + 6))) continue;
    if (count(name, t) <= 1){ console.log(`  ${name}  (${rel(f)})`); unusedLocals++; }
  }
}
if (!unusedLocals) console.log('  none');

// ---- the same helper written twice
console.log('\nSAME NAME defined in several files (possible duplicates)');
const defs = {};
for (const [f, t] of Object.entries(src)){
  const re = /^(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z0-9_$]+)|const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)/gm;
  let m; while ((m = re.exec(t))){ const n = m[1] || m[2]; (defs[n] ||= []).push(rel(f)); }
}
const dup = Object.entries(defs).filter(([n, fs]) => fs.length > 1 && !['mount', 'summary', 'render', 'bind', 'paintView', 'empty', 'icon'].includes(n));
for (const [n, fs] of dup.sort()) console.log(`  ${n}: ${fs.join(', ')}`);
if (!dup.length) console.log('  none');
