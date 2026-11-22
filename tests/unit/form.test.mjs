/* Every exercise the app knows gets a form diagram, matched to the right movement. */
import { ok, done } from '../lib.mjs';
import { formOf, formSVG, formMarkup, POSES } from '../../assets/js/core/form.js';
import { libraryList } from '../../assets/js/core/library.js';

const list = libraryList({});
const miss = list.filter(x => !formOf(x.name)).map(x => x.name);
ok(miss.length === 0, `every exercise in the library has a diagram (${list.length}); missing: ${miss.join(', ')}`);

const want = {
  'Incline DB curl': 'curl', 'Leg press': 'legpress', 'Seated leg curl': 'legcurl', 'Machine iso-lateral row': 'row',
  'Cable upright row (wide grip)': 'lateral', 'Assisted pull-up (wide grip)': 'pullup', 'Wide-grip lat pulldown': 'pulldown',
  'Straight-arm cable pulldown': 'pullover', 'Romanian deadlift': 'hinge', 'Bulgarian split squat': 'lunge',
  'Incline DB press (30–45°)': 'inclinepress', 'Flat DB press': 'flatpress', 'Pec deck fly': 'fly', 'Face pull': 'facepull',
  'Hanging knee raise': 'legraise', 'Cable crunch': 'crunch', 'Pallof press': 'antirot', 'Hip thrust (barbell or bench)': 'thrust',
  'Chest dips (lean forward, add weight if easy)': 'dip', 'Machine shoulder press': 'ohp', 'Cable front raise (rope, neutral grip)': 'frontraise',
};
for (const [name, key] of Object.entries(want)) ok(formOf(name) === key, `${name} -> ${key} (${formOf(name)})`);

for (const key of Object.keys(POSES)){
  const m = formMarkup(key, 0.5);
  ok(m.includes('fm-body') && !/NaN|undefined/.test(m), `${key} draws cleanly mid-rep`);
}
ok(formSVG('Something made up') === '', 'an unknown exercise draws nothing rather than a wrong picture');
ok(/data-form="pulldown"/.test(formSVG('Wide-grip lat pulldown')), 'the SVG says which movement it is, for the animation');
done('form diagrams');
