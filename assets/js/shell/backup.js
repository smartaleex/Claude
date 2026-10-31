/* ============================================================
   Shell: download and restore a backup. Everything lives on this device,
   so a file is the only copy that survives a lost phone.
   ============================================================ */

import { exportAll, importAll, today } from '../core/store.js';
import { toast, closeSheet } from '../core/ui.js';

export async function doExport(){
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `alex-hq-backup-${today()}.json`;
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
