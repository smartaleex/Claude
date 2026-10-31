import { ok, done } from '../lib.mjs';
import { parseRest, fmtClock, elapsedSec, restRemaining } from '../../assets/js/core/timer.js';

ok(parseRest('90s') === 90 && parseRest('60s') === 60 && parseRest('0s') === 0, 'seconds');
ok(parseRest('2 min') === 120 && parseRest('1.5 min') === 90 && parseRest('3m') === 180, 'minutes');
ok(parseRest('75') === 75, 'bare number = seconds');
ok(parseRest('') === 0 && parseRest(null) === 0 && parseRest(undefined) === 0 && parseRest('abc') === 0 && parseRest('straight into next') === 0, 'junk -> 0 (no countdown)');
ok(fmtClock(0) === '0:00' && fmtClock(5) === '0:05' && fmtClock(65) === '1:05' && fmtClock(600) === '10:00', 'clock mm:ss');
ok(fmtClock(3600) === '1:00:00' && fmtClock(3725) === '1:02:05', 'clock h:mm:ss');
ok(fmtClock(-5) === '0:00' && fmtClock(59.9) === '0:59', 'negative clamps, fractions floor');
const t = 1_000_000;
ok(elapsedSec(t - 125_000, t) === 125 && elapsedSec(undefined, t) === 0 && elapsedSec(t + 5000, t) === 0, 'elapsed time, missing start, clock skew');
ok(restRemaining({ end: t + 30_000 }, t) === 30 && restRemaining({ end: t - 5000 }, t) <= 0 && restRemaining(null, t) === 0, 'rest remaining');
ok(restRemaining({ end: t + 29_100 }, t) === 30, 'rest rounds up so it never shows 0:00 while running');
done('timer');
