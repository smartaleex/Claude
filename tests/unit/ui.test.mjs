import { ok, done } from '../lib.mjs';
import { esc, clamp, pct, round, num, money, hueFor, initials, avatarStyle, keyboardInset, isTyping } from '../../assets/js/core/ui.js';

ok(esc('<b>"hi" & \'bye\'</b>') === '&lt;b&gt;&quot;hi&quot; &amp; &#39;bye&#39;&lt;/b&gt;', 'esc escapes the five dangerous characters');
ok(esc(null) === '' && esc(undefined) === '' && esc(0) === '0' && esc(12) === '12', 'esc tolerates null and numbers');
ok(clamp(5, 0, 3) === 3 && clamp(-1, 0, 3) === 0 && clamp(2, 0, 3) === 2, 'clamp');
ok(pct(50, 200) === 25 && pct(1, 0) === 0 && pct(500, 200) === 100 && pct(-5, 10) === 0, 'pct never leaves 0-100 or divides by zero');
ok(round(1.2345, 2) === 1.23 && round(2.5) === 3 && round(-1.5) === -1, 'round');
ok(num(1234567) === '1,234,567' && num(0) === '0' && num(1.6) === '2', 'num');
ok(money(1234) === '$1,234' && money(-50) === '-$50' && money(12.5, 2) === '$12.50', 'money');
ok(hueFor('Marcus') === hueFor('Marcus') && hueFor('Marcus') !== hueFor('Priya') && hueFor('x') >= 0 && hueFor('x') < 360, 'hue is stable per name');
ok(initials('Marcus Aurelius Antoninus') === 'MA' && initials('  sam ') === 'S' && initials('priya') === 'P', 'initials');
ok(/hsl\(\d+ var\(--av-s/.test(avatarStyle('Sam')), 'avatars take saturation and lightness from the skin');
ok(keyboardInset(852, 516, 0) === 336 && keyboardInset(852, 516, 336) === 0 && keyboardInset(852, 900, 0) === 0, 'keyboard inset: covers, panned away, never negative');
const el = (tag, type) => ({ tagName: tag, getAttribute: () => type });
ok(isTyping(el('INPUT', 'text')) && isTyping(el('INPUT', 'number')) && isTyping(el('INPUT', null)) && isTyping(el('TEXTAREA')), 'text fields count as typing');
ok(!isTyping(el('BUTTON')) && !isTyping(el('INPUT', 'checkbox')) && !isTyping(el('INPUT', 'range')) && !isTyping(null) && !isTyping(el('DIV')), 'buttons, checkboxes, sliders do not');
done('ui helpers');
