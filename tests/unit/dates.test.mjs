import { ok, done } from '../lib.mjs';
import { dayKey, shiftDay, daysBetween, keyToDate, uid } from '../../assets/js/core/store.js';

ok(dayKey(new Date(2026, 0, 5)) === '2026-01-05' && dayKey(new Date(2026, 11, 31)) === '2026-12-31', 'day keys are zero padded');
ok(shiftDay('2026-10-31', 1) === '2026-11-01' && shiftDay('2026-03-01', -1) === '2026-02-28' && shiftDay('2024-03-01', -1) === '2024-02-29', 'month ends and leap years');
ok(shiftDay('2026-12-31', 1) === '2027-01-01', 'year end');
ok(daysBetween('2026-10-01', '2026-10-26') === 25 && daysBetween('2026-10-26', '2026-10-01') === -25 && daysBetween('2026-10-01', '2026-10-01') === 0, 'days between');
// across a daylight saving change (clocks go forward in Sydney on the first Sunday of October)
ok(daysBetween('2026-09-30', '2026-10-10') === 10 && daysBetween('2026-03-28', '2026-04-08') === 11, 'days between across daylight saving changes');
let d = '2026-01-01', ok1 = true; for (let i = 0; i < 800; i++){ const n = shiftDay(d, 1); if (daysBetween(d, n) !== 1) ok1 = false; d = n; }
ok(ok1 && d === '2028-03-11', 'walking 800 days forward, one at a time, stays consistent (' + d + ')');
ok(keyToDate('2026-10-27').getDate() === 27 && keyToDate('2026-10-27').getMonth() === 9, 'keyToDate');
ok(uid() !== uid() && /^[a-z0-9]+$/.test(uid()), 'ids are unique and plain');
done('dates');
