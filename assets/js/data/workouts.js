/* ============================================================
   workouts.js — the Forge program.

   BRIEF (from Alex's photos + notes)
   185cm, ~75kg, already lean — abs visible at rest. So the gap to the
   reference swimmer physique is NOT body fat, it's shoulder width and
   lat spread. That single fact drives everything below:

     · Lean bulk, not a cut. Target ~82-84kg over 12-18 months.
     · Medial + posterior delts are priority #1 (they set shoulder width).
     · Lat WIDTH over thickness — wide-grip vertical pulling, straight-arm
       work. Width is what makes the waist look small.
     · Upper chest over mid/lower — a high chest reads as "swimmer",
       a low one reads as "bodybuilder".
     · Posture: thoracic extension + lower trap work. Rounded shoulders
       hide whatever width you build.

   CONSTRAINTS (non-negotiable, they shape exercise selection)
     · Weak/unstable shoulder + hypermobile joints.
       Hypermobility means passive tissue won't protect the joint at end
       range, so muscle has to. Rule: no deep-stretch overhead loading,
       nothing behind the neck, no deep barbell bench or wide dips.
       Prefer neutral grip, controlled ROM, higher reps, dumbbells and
       cables over barbells.
     · Elbow/tricep pain when pressing — consistent with distal triceps
       tendinopathy. Tendons want blood flow and gradual load before
       heavy work, so every pressing day opens with high-rep light
       pushdowns. This is a warm-up, not a set: it should never fatigue.
     · Fasted training (morning) — 35-45 min cap, supersets throughout.
   ============================================================ */

/* ---------------- warm-ups ---------------- */
export const WARMUPS = {
  press: {
    name: 'Pressing prep',
    why: 'Perfuses the triceps tendon and wakes the rotator cuff before load. Skipping this is what makes the elbow flare.',
    items: [
      { n:'Cable pushdown, very light', d:'2 × 20 — pump only, zero strain. This is the elbow insurance.' },
      { n:'Band pull-apart',            d:'2 × 15 — sets the shoulder blades back.' },
      { n:'Cuff external rotation',     d:'1 × 15/side, light. Stabilisers on before the prime movers.' },
    ],
  },
  pull: {
    name: 'Pulling prep',
    why: 'Gets the lats firing before the biceps take over, and switches on the lower traps.',
    items: [
      { n:'Scapular pull-up / dead hang shrug', d:'2 × 8 — shoulder blades only, arms stay straight.' },
      { n:'Band pull-apart',                    d:'2 × 15' },
      { n:'Prone Y-raise',                      d:'2 × 12 — lower traps, the posture muscle.' },
    ],
  },
  legs: {
    name: 'Lower prep',
    why: 'Glute activation first — your knees roll in under load, and glute medius is what stops that.',
    items: [
      { n:'Banded lateral walk', d:'2 × 12/side' },
      { n:'Bodyweight squat',    d:'2 × 10, slow' },
      { n:'Calf raise',          d:'1 × 20' },
    ],
  },
};

/* ---------------- exercise notes ----------------
   Only where there's something genuinely worth saying. */
const N = {
  neutral:  'Neutral grip — kindest position for an unstable shoulder.',
  noLock:   'Stop just short of lockout. With hypermobile elbows, locking out dumps load onto the joint instead of the muscle.',
  romCap:   'Do not let the elbows travel behind your torso. That end range is where your shoulder gives up.',
  widthCue: 'Think "pull your elbows into your back pockets", not "pull the bar down". Lats, not biceps.',
  slowEcc:  'Three seconds down. Hypermobile joints need control, and the eccentric is where the growth is anyway.',
  lightHigh:'Go light and chase the burn. This muscle responds to reps, not load.',
  upperPec:'15-30° incline only. Steeper turns it into a shoulder press.',
};

/* ---------------- the four days ----------------
   Each day = 3 supersets = 6 exercises. A1/A2 alternate with minimal
   rest, then 90s before the next pair. That's what keeps it under 45.
   Three blocks rotate every 6 weeks so the stimulus keeps changing
   without abandoning what works. */

export const BLOCKS = [
  {
    id: 1,
    name: 'Width',
    focus: 'Build the frame — side delts and lat width, high volume, moderate load.',
    days: [
      {
        key:'d1', name:'Shoulders & Lats', tag:'Priority', warmup:'pull',
        note:'The most important session of your week. Everything here builds the V.',
        supersets: [
          { a:{ n:'Wide-grip lat pulldown', s:3, r:'10-12', note:N.widthCue },
            b:{ n:'Seated dumbbell lateral raise', s:3, r:'15-20', note:N.lightHigh } },
          { a:{ n:'Chest-supported row, wide grip', s:3, r:'10-12', note:'Chest supported so the lower back stays out of it.' },
            b:{ n:'Cable lateral raise, single arm', s:3, r:'12-15', note:'Constant tension the dumbbell version cannot give you.' } },
          { a:{ n:'Straight-arm cable pulldown', s:3, r:'12-15', note:'Pure lat, no biceps. This is the width exercise.' },
            b:{ n:'Reverse pec-deck', s:3, r:'15-20', note:'Rear delts — the half of the shoulder nobody trains and everybody needs.' } },
        ],
      },
      {
        key:'d2', name:'Upper Push', tag:'Chest', warmup:'press',
        note:'Incline bias. Shallow angles, neutral grips, nothing deep.',
        supersets: [
          { a:{ n:'Incline dumbbell press', s:3, r:'8-12', note:N.upperPec + ' ' + N.romCap },
            b:{ n:'Cable lateral raise', s:3, r:'15-20', note:N.lightHigh } },
          { a:{ n:'Machine chest press', s:3, r:'10-12', note:'Fixed path takes the stabilising demand off the shoulder.' },
            b:{ n:'Rope face pull', s:3, r:'15-20', note:'Rear delts + external rotation. Your shoulder health exercise.' } },
          { a:{ n:'Incline cable fly (low to high)', s:3, r:'12-15', note:'Upper chest under constant tension. Keep the stretch controlled.' },
            b:{ n:'Overhead rope triceps extension', s:3, r:'12-15', note:N.noLock } },
        ],
      },
      {
        key:'d3', name:'Legs & Core', tag:'Maintain', warmup:'legs',
        note:'Legs are not the bottleneck for this look. Train them well, briefly.',
        supersets: [
          { a:{ n:'Leg press', s:3, r:'10-12', note:'Knees track over the middle toes. Do not let them cave in.' },
            b:{ n:'Seated leg curl', s:3, r:'12-15' } },
          { a:{ n:'Bulgarian split squat', s:3, r:'10/side', note:'Also your best glute-medius work — directly fixes the knee cave.' },
            b:{ n:'Standing calf raise', s:3, r:'15-20' } },
          { a:{ n:'Cable crunch', s:3, r:'15', note:'Weighted abs. You are lean enough that they will show.' },
            b:{ n:'Hanging knee raise', s:3, r:'12-15', note:'Also builds serratus — the ribcage detail in the reference photos.' } },
        ],
      },
      {
        key:'d4', name:'Back & Arms', tag:'Posture', warmup:'pull',
        note:'Thickness and posture. This is the day that fixes rounded shoulders.',
        supersets: [
          { a:{ n:'Neutral-grip pull-up (assisted if needed)', s:3, r:'6-10', note:N.neutral },
            b:{ n:'Incline dumbbell curl', s:3, r:'10-12', note:N.slowEcc } },
          { a:{ n:'Seated cable row, neutral grip', s:3, r:'10-12', note:'Squeeze for a full second. Mid-traps and rhomboids are the posture muscles.' },
            b:{ n:'Rope pushdown', s:3, r:'12-15', note:N.noLock } },
          { a:{ n:'Prone Y-raise on incline bench', s:3, r:'12-15', note:'Lower traps. Unglamorous, and the single best thing for your posture.' },
            b:{ n:'Hammer curl', s:3, r:'12-15', note:N.neutral } },
        ],
      },
    ],
  },

  {
    id: 2,
    name: 'Density',
    focus: 'Same targets, heavier and tighter. Slightly lower reps, more load.',
    days: [
      {
        key:'d1', name:'Shoulders & Lats', tag:'Priority', warmup:'pull',
        note:'Heavier pulling, same width intent.',
        supersets: [
          { a:{ n:'Weighted / assisted wide pull-up', s:4, r:'6-9', note:N.widthCue },
            b:{ n:'Dumbbell lateral raise, leaning', s:3, r:'12-15', note:'Leaning away lengthens the side delt at the bottom.' } },
          { a:{ n:'Single-arm dumbbell row', s:3, r:'8-10', note:'Pull to the hip, not the armpit.' },
            b:{ n:'Cable rear-delt fly (cross-body)', s:3, r:'15-20' } },
          { a:{ n:'Half-kneeling landmine press', s:3, r:'10-12', note:'Overhead pressing your shoulder can actually tolerate — the arc stays in front.' },
            b:{ n:'Straight-arm pulldown', s:3, r:'12-15' } },
        ],
      },
      {
        key:'d2', name:'Upper Push', tag:'Chest', warmup:'press',
        note:'Add load, keep the ROM honest.',
        supersets: [
          { a:{ n:'Incline barbell press (to a 2-board or pins)', s:4, r:'6-8', note:'The stop protects the shoulder at the bottom. Non-negotiable for you.' },
            b:{ n:'Machine lateral raise', s:3, r:'15-20' } },
          { a:{ n:'Weighted push-up / deficit-free dip', s:3, r:'8-12', note:'Shallow only. Depth is where dips wreck shoulders.' },
            b:{ n:'Face pull', s:3, r:'15-20' } },
          { a:{ n:'Pec-deck', s:3, r:'12-15', note:'Controlled. Do not chase the stretch — you have plenty of range already.' },
            b:{ n:'Cable overhead extension', s:3, r:'12-15', note:N.noLock } },
        ],
      },
      {
        key:'d3', name:'Legs & Core', tag:'Maintain', warmup:'legs',
        note:'Heavier lower body, same 6 movements.',
        supersets: [
          { a:{ n:'Hack squat / goblet squat', s:4, r:'8-10' },
            b:{ n:'Romanian deadlift', s:3, r:'10-12', note:'Hinge, do not squat it. Stop when the hamstrings run out of stretch.' } },
          { a:{ n:'Walking lunge', s:3, r:'10/side' },
            b:{ n:'Seated calf raise', s:3, r:'15-20' } },
          { a:{ n:'Weighted plank', s:3, r:'40s' },
            b:{ n:'Hanging leg raise', s:3, r:'10-12' } },
        ],
      },
      {
        key:'d4', name:'Back & Arms', tag:'Posture', warmup:'pull',
        supersets: [
          { a:{ n:'Chest-supported T-bar row', s:4, r:'8-10' },
            b:{ n:'Preacher curl', s:3, r:'10-12', note:N.slowEcc } },
          { a:{ n:'Wide-grip seated row', s:3, r:'10-12', note:'Wide grip biases upper back over lats here — that is the point.' },
            b:{ n:'Close-grip bench to a board', s:3, r:'10-12', note:'Stop short. Triceps, not elbow joint.' } },
          { a:{ n:'Prone Y-raise', s:3, r:'12-15' },
            b:{ n:'Cable hammer curl', s:3, r:'12-15' } },
        ],
      },
    ],
  },

  {
    id: 3,
    name: 'Detail',
    focus: 'Highest reps, shortest rest, most metabolic. Cable and machine heavy — easiest block on the joints.',
    days: [
      {
        key:'d1', name:'Shoulders & Lats', tag:'Priority', warmup:'pull',
        note:'Pump block. Chase the burn, not the load.',
        supersets: [
          { a:{ n:'Lat pulldown, wide, 1.5 reps', s:3, r:'10-12', note:'Full rep, then a half from the bottom. Brutal for the lats, light on the joints.' },
            b:{ n:'Lateral raise 21s', s:3, r:'21', note:'7 bottom half, 7 top half, 7 full.' } },
          { a:{ n:'Cable row, wide grip', s:3, r:'12-15' },
            b:{ n:'Bent-over dumbbell rear fly', s:3, r:'15-20', note:N.lightHigh } },
          { a:{ n:'Straight-arm pulldown, drop set', s:3, r:'12 + 12', note:'Drop the weight once and keep going.' },
            b:{ n:'Cable Y-raise', s:3, r:'15' } },
        ],
      },
      {
        key:'d2', name:'Upper Push', tag:'Chest', warmup:'press',
        supersets: [
          { a:{ n:'Incline machine press', s:3, r:'12-15', note:N.upperPec },
            b:{ n:'Cable lateral raise, drop set', s:3, r:'15 + 15' } },
          { a:{ n:'Low-to-high cable fly', s:3, r:'15' },
            b:{ n:'Face pull, high rep', s:3, r:'20-25' } },
          { a:{ n:'Push-up to failure', s:2, r:'AMRAP' },
            b:{ n:'Rope pushdown, high rep', s:3, r:'15-20', note:'Tendon-friendly volume. Ends the session with blood in the elbow, not pain.' } },
        ],
      },
      {
        key:'d3', name:'Legs & Core', tag:'Maintain', warmup:'legs',
        supersets: [
          { a:{ n:'Leg extension', s:3, r:'15-20' },
            b:{ n:'Lying leg curl', s:3, r:'15-20' } },
          { a:{ n:'Leg press, high rep', s:3, r:'20' },
            b:{ n:'Calf raise, 2s pause', s:3, r:'15' } },
          { a:{ n:'Cable woodchop', s:3, r:'12/side' },
            b:{ n:'Ab wheel / plank', s:3, r:'10-12' } },
        ],
      },
      {
        key:'d4', name:'Back & Arms', tag:'Posture', warmup:'pull',
        supersets: [
          { a:{ n:'Neutral pulldown, 1.5 reps', s:3, r:'10-12' },
            b:{ n:'Cable curl', s:3, r:'15' } },
          { a:{ n:'Machine row', s:3, r:'12-15' },
            b:{ n:'Overhead cable extension', s:3, r:'15' } },
          { a:{ n:'Band pull-apart, high rep', s:3, r:'25', note:'Finish every week with these. Cheap posture insurance.' },
            b:{ n:'Reverse curl', s:3, r:'15', note:'Also strengthens the forearm side of a cranky elbow.' } },
        ],
      },
    ],
  },
];

/* ---------------- optional extras ---------------- */
export const EXTRAS = [
  { n:'Dead hang', d:'30-60s', why:'Decompresses the shoulder and stretches the lats. Do it after every pulling day.' },
  { n:'Thoracic extension over a foam roller', d:'2 × 10', why:'Directly targets the rounded-shoulder posture.' },
  { n:'Wall slide', d:'2 × 10', why:'Teaches the shoulder blades to move properly overhead.' },
  { n:'Face pull', d:'2 × 20', why:'Can be done every day. There is no such thing as too many for you.' },
  { n:'Farmer carry', d:'2 × 40m', why:'Traps, grip and core in one, no joint stress.' },
  { n:'Serratus punch', d:'2 × 15', why:'Builds the ribcage detail visible in the reference photos.' },
];

/* ---------------- physique model ----------------
   Used by the Forge dashboard to show progress toward the goal. */
export const PHYSIQUE = {
  height: 185,
  start: 75,
  goal: 83,
  note: 'You are already lean enough. The remaining gap is shoulder and back width, which only comes from a surplus plus delt/lat volume.',
  rateLo: 0.15,   // kg/week — below this and you're not really bulking
  rateHi: 0.45,   // above this and you're adding fat, not just muscle
};

export const DAY_NAMES = ['Shoulders & Lats','Upper Push','Legs & Core','Back & Arms'];
