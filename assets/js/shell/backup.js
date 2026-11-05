/* ============================================================
   Shell: download and restore a backup. Everything lives on this device,
   so a file is the only copy that survives a lost phone.
   ============================================================ */

import { exportAll, importAll, today } from '../core/store.js';
import { toast, closeSheet } from '../core/ui.js';
import { isNative, shareFile, saveBackup } from '../core/native.js';

export async function doExport(){
  const data = await exportAll();
  const name = `alex-hq-backup-${today()}.json`;
  if (isNative()){
    // A web view cannot save a download; the share sheet offers Save to Files, AirDrop, Mail.
    if (await shareFile(name, JSON.stringify(data, null, 2))) return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

export function doImport(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0];
    if (!f) return;
    try{
      await importAll(JSON.parse(await f.text()));
      closeSheet();
      toast('Restored ✓');
      setTimeout(() => location.reload(), 600);
    }catch(e){ toast(e.message || 'Could not read that file'); }
  };
  inp.click();
}

/* In the iPhone app a copy of everything is also saved on its own, at most once
   a day, to the app's Files folder (Files > On My iPhone > Alex HQ). That folder
   is included in an iPhone backup, so the data survives losing or resetting the
   app. Runs when the app goes to the background. */
const AUTO_KEY = 'alexhq:autoBackupAt';
const DAY = 20 * 3600 * 1000;
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export async function autoBackup(){
  if (!isNative()) return false;
  try{
    if (Date.now() - Number(localStorage.getItem(AUTO_KEY) || 0) < DAY) return false;
    const text = JSON.stringify(await exportAll());
    await saveBackup('alex-hq-backup-latest.json', text);
    await saveBackup(`alex-hq-backup-${WEEKDAYS[new Date().getDay()]}.json`, text);   // a week of history
    localStorage.setItem(AUTO_KEY, String(Date.now()));
    return true;
  }catch{ return false; }
}

export function watchAutoBackup(){
  if (!isNative()) return;
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoBackup(); });
}
