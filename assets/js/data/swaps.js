/* ============================================================
   swaps.js — what to do when the machine is taken.

   Matched by movement pattern rather than by exercise name. A name list
   goes stale the moment the program changes; a pattern list keeps
   working, and it is also how you should actually think about it — the
   machine is not the exercise, the movement is.

   Every alternate says what changes, because they are not identical.
   Swapping a barbell row for a chest-supported machine row removes the
   lower-back demand, which is usually the point. Knowing the difference
   is what stops a swap quietly becoming a downgrade.

   Ordered roughly best-first within each pattern.
   ============================================================ */

/* Keyword rules, first match wins. Order matters: "incline DB curl" must
   hit the curl rule, not the incline-press rule, so curls are tested
   before presses. */
const RULES = [
  [/face pull|rear delt|reverse pec|band pull/i,                 'rearDelt'],
  [/lateral raise|upright row/i,                                 'lateralRaise'],
  [/shrug/i,                                                     'shrug'],
  [/curl/i, m => /leg curl/i.test(m) ? 'hamstring' : 'biceps'],
  /* "dip" alone is ambiguous: leaning forward makes it a chest movement,
     staying upright makes it triceps. The program says which. */
  [/pushdown|tricep|skull|overhead extension/i,                  'triceps'],
  [/\bdips?\b/i, m => /chest|lean forward/i.test(m) ? 'flatPress' : 'triceps'],
  /* "chin" needs a boundary or it matches ma-CHIN-e, which sent every
     machine chest press to the vertical-pull list. */
  [/pulldown|pull-?ups?\b|\bchin-?ups?\b/i,
      m => /straight-arm|straight arm/i.test(m) ? 'straightArm' : 'verticalPull'],
  [/row/i,                                                       'horizontalPull'],
  [/fly|crossover|pec deck/i,                                    'chestFly'],
  [/ohp|shoulder press|overhead press|military/i,                'overheadPress'],
  [/incline.*press/i,                                            'inclinePress'],
  [/press|push-up|pushup|bench/i,
      m => /leg press/i.test(m) ? 'quads' : 'flatPress'],
  [/squat|leg extension/i,                                       'quads'],
  [/romanian|rdl|deadlift|good morning/i,                        'hinge'],
  [/calf/i,                                                      'calves'],
  [/crunch|leg raise|knee raise|pallof|hanging|plank|dead hang/i, 'core'],
];

export function patternOf(name){
  for (const [re, val] of RULES){
    if (re.test(name)) return typeof val === 'function' ? val(name) : val;
  }
  return null;
}

/* gear: what you need. Used to badge each option so you can scan for
   whatever is actually free. */
export const SWAPS = {
  verticalPull: {
    label: 'Vertical pull',
    why: 'Lat width — the single biggest contributor to the V-taper.',
    options: [
      { name:'Lat pulldown (any grip)',        gear:'machine',    note:'The default. Neutral or close grip hits lats hardest.' },
      { name:'Assisted pull-up machine',       gear:'machine',    note:'Same movement, easier to load progressively than band-assisted.' },
      { name:'Single-arm cable pulldown',      gear:'cable',      note:'One side at a time, so one free cable station is enough.' },
      { name:'Band-assisted pull-up',          gear:'bodyweight', note:'Needs only a bar. Loop the band under one knee.' },
      { name:'Straight-arm pulldown + row',    gear:'cable',      note:'Last resort — two movements to cover what one was doing.' },
    ],
  },
  horizontalPull: {
    label: 'Horizontal pull',
    why: 'Mid-back thickness and rear-delt health. Protects the shoulder.',
    options: [
      { name:'Chest-supported machine row',    gear:'machine',    note:'Best for you — the pad takes the lower back out entirely.' },
      { name:'Seated cable row',               gear:'cable',      note:'Keep the chest up; do not rock for extra weight.' },
      { name:'Single-arm DB row',              gear:'dumbbell',   note:'One dumbbell and a bench. Almost always available.' },
      { name:'Single-arm cable row',           gear:'cable',      note:'Standing or seated. Good if only one station is free.' },
      { name:'Inverted row (bar or rings)',    gear:'bodyweight', note:'Set the bar around hip height and walk your feet out.' },
    ],
  },
  inclinePress: {
    label: 'Incline press',
    why: 'Upper chest — the part that fills out the line under the collarbone.',
    options: [
      { name:'Incline machine chest press',    gear:'machine',    note:'Easiest on an unstable shoulder. Prefer this when it is free.' },
      { name:'Incline DB press (30–45°)',      gear:'dumbbell',   note:'Any adjustable bench. Do not go past 45° or it becomes a shoulder press.' },
      { name:'Low-to-high cable press',        gear:'cable',      note:'Two low pulleys, pressing up and in. Very shoulder-friendly.' },
      { name:'Incline push-up (feet low)',     gear:'bodyweight', note:'Hands elevated hits lower chest — feet elevated is the upper-chest version.' },
    ],
  },
  flatPress: {
    label: 'Flat press / dip',
    why: 'Overall chest and triceps.',
    options: [
      { name:'Machine chest press',            gear:'machine',    note:'Fixed path, safest for the shoulder.' },
      { name:'Flat DB press',                  gear:'dumbbell',   note:'Two dumbbells and any flat bench.' },
      { name:'Chest dip (lean forward)',       gear:'bodyweight', note:'Leaning forward makes it chest; staying upright makes it triceps.' },
      { name:'Cable press (mid pulley)',       gear:'cable',      note:'Constant tension, easy on the joints.' },
      { name:'Push-up (feet elevated)',        gear:'bodyweight', note:'Zero equipment. Slow the lowering down to make it hard.' },
    ],
  },
  chestFly: {
    label: 'Chest fly',
    why: 'Stretch under load — where most of the chest growth stimulus is.',
    options: [
      { name:'Pec deck',                       gear:'machine',    note:'Most stable. Pause a beat at the stretch.' },
      { name:'Cable crossover (high to low)',  gear:'cable',      note:'Any two facing pulleys.' },
      { name:'Low-to-high cable fly',          gear:'cable',      note:'Biases upper chest, which is your weak point.' },
      { name:'Incline DB fly',                 gear:'dumbbell',   note:'Go lighter than feels right and keep a soft elbow.' },
    ],
  },
  overheadPress: {
    label: 'Overhead press',
    why: 'Front and side delts — shoulder width from the top.',
    options: [
      { name:'Machine shoulder press',         gear:'machine',    note:'Best option for an unstable shoulder. Fixed path, no balancing.' },
      { name:'Seated DB press (back support)', gear:'dumbbell',   note:'Neutral grip is kinder to the shoulder than palms-forward.' },
      { name:'Landmine press',                 gear:'barbell',    note:'The most shoulder-friendly pressing angle there is.' },
      { name:'Arnold press (light)',           gear:'dumbbell',   note:'Only if the shoulder is feeling good that day.' },
    ],
  },
  lateralRaise: {
    label: 'Lateral raise',
    why: 'Side delts. The highest-leverage muscle you have for shoulder width.',
    options: [
      { name:'Cable lateral raise (one arm)',  gear:'cable',      note:'Best version — tension at the bottom where dumbbells have none.' },
      { name:'DB lateral raise',               gear:'dumbbell',   note:'Lighter than you think. Lead with the elbow, not the hand.' },
      { name:'Machine lateral raise',          gear:'machine',    note:'If your gym has one, it is excellent for this.' },
      { name:'Band lateral raise',             gear:'bodyweight', note:'Stand on the band. Fine for high-rep burnout sets.' },
      { name:'Lean-away DB raise',             gear:'dumbbell',   note:'Hold a rack and lean out. Longer range, more stretch.' },
    ],
  },
  rearDelt: {
    label: 'Rear delt / face pull',
    why: 'Balances all the pressing and keeps the shoulder tracking properly. Do not skip these.',
    options: [
      { name:'Face pull (rope, high pulley)',  gear:'cable',      note:'Pull to the forehead, elbows high, external rotation at the end.' },
      { name:'Reverse pec deck',               gear:'machine',    note:'Same job, zero setup.' },
      { name:'Rear delt cable fly',            gear:'cable',      note:'Cross-over from two high pulleys.' },
      { name:'Bent-over DB reverse fly',       gear:'dumbbell',   note:'Chest on an incline bench so you cannot cheat with momentum.' },
      { name:'Band pull-apart',                gear:'bodyweight', note:'Do these anywhere, any time. High reps.' },
    ],
  },
  biceps: {
    label: 'Biceps curl',
    why: 'Arm size. Currently your weakest link relative to the goal.',
    options: [
      { name:'Incline DB curl',                gear:'dumbbell',   note:'Best builder — the incline puts the long head on stretch.' },
      { name:'Bayesian cable curl',            gear:'cable',      note:'Cable behind you. Same stretch advantage as the incline curl.' },
      { name:'Preacher curl (machine or EZ)',  gear:'machine',    note:'Strict. Good when you want zero cheating.' },
      { name:'Hammer curl',                    gear:'dumbbell',   note:'Hits brachialis, which pushes the bicep up and adds width.' },
      { name:'EZ-bar curl',                    gear:'barbell',    note:'Easier on the wrists than a straight bar.' },
      { name:'Cable curl (straight bar)',      gear:'cable',      note:'Constant tension throughout.' },
    ],
  },
  triceps: {
    label: 'Triceps',
    why: 'Two thirds of your arm. Skinny arms are usually a triceps problem.',
    options: [
      { name:'Rope pushdown',                  gear:'cable',      note:'Spread the rope at the bottom.' },
      { name:'Straight bar pushdown',          gear:'cable',      note:'Heavier than the rope. Elbows pinned.' },
      { name:'Overhead cable extension',       gear:'cable',      note:'The only one that properly stretches the long head — worth prioritising.' },
      { name:'Machine dip / triceps machine',  gear:'machine',    note:'Good when the cables are all taken.' },
      { name:'DB skull crusher',               gear:'dumbbell',   note:'Go easy — this is the one that aggravates a cranky elbow tendon.' },
      { name:'Close-grip push-up',             gear:'bodyweight', note:'Hands under the chest, elbows tucked.' },
    ],
  },
  straightArm: {
    label: 'Straight-arm pulldown',
    why: 'Isolates the lats without the biceps taking over.',
    options: [
      { name:'Rope straight-arm pulldown',     gear:'cable',      note:'Arms locked, hinge at the shoulder only.' },
      { name:'Straight bar straight-arm',      gear:'cable',      note:'Same thing, less range.' },
      { name:'DB pullover',                    gear:'dumbbell',   note:'Lie across a bench. Old-school and effective.' },
      { name:'Band straight-arm pulldown',     gear:'bodyweight', note:'Anchor the band high.' },
    ],
  },
  quads: {
    label: 'Quads',
    why: 'Legs. Not central to the look you want, but skipping them entirely shows eventually.',
    options: [
      { name:'Leg press',                      gear:'machine',    note:'Feet a bit higher takes pressure off the knees.' },
      { name:'Hack squat',                     gear:'machine',    note:'If your gym has one.' },
      { name:'Bulgarian split squat',          gear:'dumbbell',   note:'One dumbbell and a bench. Brutal but effective.' },
      { name:'Goblet squat',                   gear:'dumbbell',   note:'Easy to set up, self-limiting.' },
      { name:'Leg extension',                  gear:'machine',    note:'Isolation. Control the knee — no swinging given the valgus.' },
    ],
  },
  hamstring: {
    label: 'Hamstring curl',
    why: 'Knee health as much as size — balances all the quad work.',
    options: [
      { name:'Lying leg curl',                 gear:'machine',    note:'Slight edge for hamstring growth over seated.' },
      { name:'Seated leg curl',                gear:'machine',    note:'Also excellent. Use whichever is free.' },
      { name:'Nordic curl (assisted)',         gear:'bodyweight', note:'Very hard. Lower slowly, push back up with your hands.' },
      { name:'Cable / band leg curl',          gear:'cable',      note:'Ankle strap on a low pulley.' },
    ],
  },
  hinge: {
    label: 'Hip hinge',
    why: 'Posterior chain and posture. Carries over to everything.',
    options: [
      { name:'Romanian deadlift (DB or bar)',  gear:'barbell',    note:'Push the hips back, soft knees, stop when the stretch runs out.' },
      { name:'Single-leg RDL',                 gear:'dumbbell',   note:'Lighter load, more balance demand. Good for the knee.' },
      { name:'Back extension (45°)',           gear:'machine',    note:'Much easier on the lower back than a loaded hinge.' },
      { name:'Cable pull-through',             gear:'cable',      note:'Teaches the hinge pattern with almost no spinal load.' },
    ],
  },
  calves: {
    label: 'Calves',
    why: 'Stubborn. High reps, full stretch at the bottom.',
    options: [
      { name:'Standing calf raise',            gear:'machine',    note:'Hits the gastroc — the one that shows.' },
      { name:'Seated calf raise',              gear:'machine',    note:'Bent knee shifts it to the soleus.' },
      { name:'Leg press calf raise',           gear:'machine',    note:'Use the leg press if the calf machines are taken.' },
      { name:'Single-leg raise off a step',    gear:'bodyweight', note:'Anywhere. Pause two seconds at the bottom.' },
    ],
  },
  core: {
    label: 'Core',
    why: 'Midsection definition comes from body fat, but a thicker core still changes the outline.',
    options: [
      { name:'Cable crunch',                   gear:'cable',      note:'Loadable, which is why it beats endless sit-ups.' },
      { name:'Hanging knee / leg raise',       gear:'bodyweight', note:'Only needs a bar. Do not swing.' },
      { name:'Ab wheel rollout',               gear:'bodyweight', note:'From the knees. Keep the ribs down.' },
      { name:'Machine crunch',                 gear:'machine',    note:'Simple to load and progress.' },
      { name:'Pallof press',                   gear:'cable',      note:'Anti-rotation. Different job, worth keeping.' },
    ],
  },
  shrug: {
    label: 'Shrug',
    why: 'Traps. Go easy — heavy traps visually narrow the shoulders, which works against the taper.',
    options: [
      { name:'DB shrug',                       gear:'dumbbell',   note:'Straight up, no rolling.' },
      { name:'Cable shrug',                    gear:'cable',      note:'Constant tension.' },
      { name:'Trap bar / barbell shrug',       gear:'barbell',    note:'Heaviest option.' },
    ],
  },
};

export const GEAR_STYLE = {
  machine:    { label:'Machine',  fg:'#2563EB', bg:'rgba(37,99,235,.13)' },
  cable:      { label:'Cable',    fg:'#0EA5A5', bg:'rgba(14,165,165,.13)' },
  dumbbell:   { label:'Dumbbell', fg:'#8B5CF6', bg:'rgba(139,92,246,.13)' },
  barbell:    { label:'Barbell',  fg:'#F97316', bg:'rgba(249,115,22,.13)' },
  bodyweight: { label:'Bodyweight', fg:'#16A34A', bg:'rgba(22,163,74,.13)' },
};

/** Alternates for an exercise, minus the one you are already doing. */
export function swapsFor(name){
  const pat = patternOf(name);
  if (!pat || !SWAPS[pat]) return null;
  const grp = SWAPS[pat];
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
  const mine = norm(name);
  return {
    ...grp,
    options: grp.options.filter(o => {
      const n = norm(o.name);
      return !(n.includes(mine) || mine.includes(n));
    }),
  };
}
