/* ============================================================
   Shell: the list of tools and their order.

   To add a tool: write apps/<name>.js (export mount() and summary()),
   import it here, add one APPS entry, add the file to SHELL in sw.js.
   ============================================================ */

import { aiSettings } from '../core/ai.js';

import * as day     from '../apps/day.js';
import * as fuel    from '../apps/fuel.js';
import * as forge   from '../apps/forge/index.js';
import * as ledger  from '../apps/ledger.js';
import * as shout   from '../apps/shout.js';
import * as clear   from '../apps/clear.js';
import * as vale    from '../apps/vale.js';
import * as cryptic from '../apps/cryptic.js';

export const APPS = {
  day:     { id:'day',     name:'Day',      icon:'day',      mod:day,     blurb:'Meds, sleep, anchors' },
  fuel:    { id:'fuel',    name:'Food',     icon:'food',     mod:fuel,    blurb:'Macros and the bulk' },
  forge:   { id:'forge',   name:'Training', icon:'training', mod:forge,   blurb:'The swimmer build' },
  clear:   { id:'clear',   name:'Nicotine', icon:'nicotine', mod:clear,   blurb:'The taper' },
  shout:   { id:'shout',   name:'People',   icon:'people',   mod:shout,   blurb:'Mates and plans' },
  ledger:  { id:'ledger',  name:'Money',    icon:'money',    mod:ledger,  blurb:'Budget and the house' },
  vale:    { id:'vale',    name:'Spanish',  icon:'spanish',  mod:vale,    blurb:'From rusty to fluent' },
  cryptic: { id:'cryptic', name:'Cryptic',  icon:'puzzle',   mod:cryptic, blurb:'One clue a day' },
};

/* Order is user-editable in Settings. The first four sit in the bottom
   bar, the rest live under More — frequency of use should decide that,
   and only the person using it knows their own. */
const DEFAULT_ORDER = ['day','fuel','forge','clear','cryptic','shout','ledger','vale'];
export const BAR_SLOTS = 4;

export function appOrder(){
  const saved = aiSettings()?.tabOrder;
  const valid = Array.isArray(saved) ? saved.filter(id => APPS[id]) : [];
  // Append anything missing so a new tool can't vanish behind stale prefs.
  return [...valid, ...DEFAULT_ORDER.filter(id => !valid.includes(id))];
}
export const barApps  = () => appOrder().slice(0, BAR_SLOTS);
export const moreApps = () => appOrder().slice(BAR_SLOTS);
