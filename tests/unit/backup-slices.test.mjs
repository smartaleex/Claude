/* A backup that silently leaves a store out is worse than no backup: you find out when you restore.
   Every Slice the app creates must be in the backup list, and a backup must round-trip. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, done, ROOT } from '../lib.mjs';
import { Slice, ALL_SLICES, exportAll, importAll } from '../../assets/js/core/store.js';

const names = new Set();
(function walk(dir){
  for (const f of readdirSync(join(ROOT, dir))){
    const rel = `${dir}/${f}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
    else if (f.endsWith('.js')) for (const m of readFileSync(join(ROOT, rel), 'utf8').matchAll(/new Slice\('([\w-]+)'/g)) names.add(m[1]);
  }
})('assets/js');

ok(names.size >= 12, `found ${names.size} stores in the code: ${[...names].sort().join(', ')}`);
const missing = [...names].filter(n => !ALL_SLICES.includes(n));
ok(missing.length === 0, 'every store the app creates is in the backup' + (missing.length ? ' (MISSING: ' + missing.join(', ') + ')' : ''));
ok(ALL_SLICES.includes('day') && ALL_SLICES.includes('meds'), 'Day (mood, sleep, meds taken) and the medication schedule are included');

// round trip
const day = new Slice('day', { mood: {}, done: {} });
await day.load();
day.update(d => { d.mood['2026-11-02'] = { m: 1, e: 2 }; d.done['2026-11-02'] = { meds: 2 }; });
await day.flush();
const meds = new Slice('meds', { list: [], remind: false });
await meds.load();
meds.update(m => { m.list.push({ id: 'a', name: 'Lamotrigine', dose: '100mg', times: ['08:00'] }); });
await meds.flush();

const backup = await exportAll();
ok(backup.day?.mood['2026-11-02']?.m === 1 && backup.day.done['2026-11-02'].meds === 2, 'the backup contains the Day data');
ok(backup.meds?.list[0]?.name === 'Lamotrigine', 'and the medication schedule');
ok(backup._app === 'Alex HQ', 'and is marked as an Alex HQ backup');

day.update(d => { d.mood = {}; d.done = {}; }); await day.flush();
meds.update(m => { m.list = []; }); await meds.flush();
await importAll(JSON.parse(JSON.stringify(backup)));
const day2 = new Slice('day', { mood: {}, done: {} });
const meds2 = new Slice('meds', { list: [], remind: false });
await day2.load(); await meds2.load();
ok(day2.get().mood['2026-11-02']?.e === 2 && day2.get().done['2026-11-02'].meds === 2, 'restoring brings the Day data back');
ok(meds2.get().list[0]?.dose === '100mg', 'and the medication schedule');

let threw = false;
try{ await importAll({ nope: 1 }); }catch{ threw = true; }
ok(threw, 'a file that is not an Alex HQ backup is refused');

done('backups include every store');
