/* ============================================================
   workouts.js — The Swimmer Build
   Anytime Fitness Jannali · 4 days/week · supersets throughout

   Phase 1 and Phase 2 are transcribed verbatim from Alex's original
   workout-routine-v4 artifact: same split, same exercises, same sets,
   reps, rest, tags, superset rationales and coaching notes.

   Phase 3 is new. His own progression note said "after that, we build
   Phase 3 based on what's lagging" — and from the physique photos what's
   lagging is still shoulder and lat WIDTH, not chest or arms. So Phase 3
   is a width peak: moderate load with intensity techniques (myo-reps,
   drop sets, 1.5 reps, partials) which drive a lot of stimulus without
   the joint load of going heavier. That matters given the unstable
   shoulder, hypermobility and cranky triceps tendon.
   ============================================================ */

/* ---------------- warm-ups ----------------
   Not in the original file — added because of the elbow/triceps pain on
   pressing and the unstable shoulder. Tendons want blood flow and
   graded load before heavy work; this should never fatigue. */
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

/* Day identities are shared across every phase — same four days, same
   colours, so the app looks consistent as phases roll over. */
const DAY_META = {
  d1: { label:'DAY 1', title:'Back + Biceps',      color:'#0066FF', tint:'#EFF5FF', line:'#C5D9FF', warmup:'pull'  },
  d2: { label:'DAY 2', title:'Chest + Triceps',    color:'#E85D00', tint:'#FFF3EC', line:'#FFD4B5', warmup:'press' },
  d3: { label:'DAY 3', title:'Legs + Core',        color:'#00913A', tint:'#EDFAF3', line:'#B3E8CA', warmup:'legs'  },
  d4: { label:'DAY 4', title:'Shoulders + Arms',   color:'#7B00D4', tint:'#F5EDFF', line:'#DBBEFF', warmup:'press' },
};

const day = (key, subtitle, supersets, extra) => ({ key, ...DAY_META[key], subtitle, supersets, extra });

/* ============================================================
   PHASE 1 — weeks 1-6. The foundation block.
   ============================================================ */
const PHASE1_DAYS = [
  day('d1', 'Lat width priority', [
    {
      label: 'SS1 — Pull-up + Pulldown Width Superset',
      rationale: 'Pull-ups hit the upper lat fibres that create WIDTH. Pulldown follows immediately while those fibres are lit up. Core of the swimmer V-taper.',
      exercises: [
        { name:'Assisted pull-up (wide grip)', sets:'4', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Wide grip, full dead hang at bottom, chin over bar at top. Reduce assist weight as you get stronger. #1 width builder.' },
        { name:'Wide-grip lat pulldown', sets:'4', reps:'10–12', rest:'90s', tag:'Compound',
          notes:"Straight from pull-ups. Full stretch at top, drive elbows to hips. Lats pre-fatigued — that's the point." },
      ],
    },
    {
      label: 'SS2 — Unilateral + Isolation',
      rationale: 'Heavy compound then pure lat isolation — great finishing pump.',
      exercises: [
        { name:'Single-arm DB row (knee on bench)', sets:'3', reps:'10–12 each', rest:'0s', tag:'Compound',
          notes:"Controlled 3-second eccentric. Don't rotate your torso. Both sides, then straight to pulldown." },
        { name:'Straight-arm cable pulldown', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Slight bend in elbows, hinge at shoulder only. Pulls the lats OUT not just down.' },
      ],
    },
    {
      label: 'SS3 — Biceps Finisher',
      rationale: 'EZ bar for peak, hammer for thickness underneath. Back is fully rested so no compromise.',
      exercises: [
        { name:'EZ-bar curl', sets:'3', reps:'10–12', rest:'0s', tag:'Isolation',
          notes:'Full ROM, no swinging. Straight into hammers.' },
        { name:'Hammer curl', sets:'3', reps:'12–15', rest:'60s', tag:'Isolation',
          notes:'Hits brachialis — pushes the bicep up. Key for thickness.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Face pull', sets:'2', reps:'15–20', note:'Posture + rear delts. Never wasted.' },
      { name:'Dead hang',  sets:'2', reps:'30–45s', note:'Decompresses spine, builds grip, stretches lats.' },
    ],
  }),

  day('d2', 'Chest priority — double compound', [
    {
      label: 'SS1 — Upper + Mid Chest Double Press',
      rationale: 'Chest is the weakest area so it gets two compounds back to back while fresh.',
      exercises: [
        { name:'Incline DB press (30–45°)', sets:'4', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Upper chest priority. Control the eccentric. Straight into flat press.' },
        { name:'Flat DB press', sets:'4', reps:'10–12', rest:'90s', tag:'Compound',
          notes:'Full ROM — deep stretch at the bottom is where growth happens.' },
      ],
    },
    {
      label: 'SS2 — Chest Isolation + Triceps',
      rationale: 'Crossover while chest is pumped for max stretch, then straight into triceps.',
      exercises: [
        { name:'High cable crossover (high to low)', sets:'3', reps:'12–15', rest:'0s', tag:'Isolation',
          notes:'Squeeze and hold 1 second at the bottom. Straight into pushdowns.' },
        { name:'Rope tricep pushdown', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Flare the rope at the bottom. Key for arm width.' },
      ],
    },
    {
      label: 'SS3 — Triceps Finisher',
      rationale: 'Two pushdown variations — different grips, different angles. Elbow-friendly.',
      exercises: [
        { name:'Straight bar cable pushdown', sets:'3', reps:'12–15', rest:'0s', tag:'Isolation',
          notes:'Elbows locked to sides, full extension. Straight into dips.' },
        { name:'Machine dips (or assisted)', sets:'3', reps:'10–12', rest:'60s', tag:'Compound',
          notes:'Upright hits triceps. Full range unless something feels off.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Pec deck fly', sets:'2', reps:'15', note:'Extra chest volume — your priority muscle.' },
      { name:'Push-up dropset to failure', sets:'1', reps:'max', note:'Flush the chest completely. Brutal but quick.' },
    ],
  }),

  day('d3', 'Foundation + injury prevention', [
    {
      label: 'SS1 — Quad + Calf',
      rationale: 'Non-competing muscles. Zero performance cost, saves 10 minutes.',
      exercises: [
        { name:'Leg press', sets:'4', reps:'10–12', rest:'0s', tag:'Compound',
          notes:"Feet shoulder-width, mid-platform. Don't lock knees. Full ROM." },
        { name:'Seated calf raise', sets:'4', reps:'15–20', rest:'90s', tag:'Isolation',
          notes:'Slow, full ROM, pause at the bottom stretch.' },
      ],
    },
    {
      label: 'SS2 — Hamstring Complex',
      rationale: 'RDL stretches under load, leg curl contracts. Full hamstring function.',
      exercises: [
        { name:'Romanian deadlift', sets:'3', reps:'10', rest:'0s', tag:'Compound',
          notes:'Hip hinge, bar close to shins. Controlled all the way down.' },
        { name:'Seated leg curl', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Squeeze hard at full contraction.' },
      ],
    },
    {
      label: 'SS3 — Quad + Core',
      rationale: 'Leg extension flushes quads, core while legs rest.',
      exercises: [
        { name:'Leg extension', sets:'3', reps:'12–15', rest:'0s', tag:'Isolation',
          notes:'Pause at top. Drop the weight and feel it.' },
        { name:'Cable crunch', sets:'3', reps:'15', rest:'60s', tag:'Core',
          notes:'Initiate from abs not hip flexors. Add weight weekly.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Walking lunges', sets:'2', reps:'12 each leg', note:'Great finisher, hits glutes and stability.' },
      { name:'Hanging knee raise', sets:'2', reps:'12–15', note:'Lower ab work — the hardest bit to build.' },
    ],
  }),

  day('d4', 'Width & arms specialisation', [
    {
      label: 'SS1 — Delt Width Complex',
      rationale: 'Lateral raises build the cap, rear delts make it 3D. The entire width formula.',
      exercises: [
        { name:'Cable lateral raise', sets:'4', reps:'15', rest:'0s', tag:'Isolation',
          notes:"Single arm, cable at ankle height. Constant tension. Don't rush." },
        { name:'Reverse pec deck', sets:'4', reps:'15', rest:'75s', tag:'Isolation',
          notes:"Rear delts make shoulders look 3D. Don't neglect." },
      ],
    },
    {
      label: 'SS2 — Press + Pull',
      rationale: 'Press loads anterior delt, face pull hits rear delt and external rotators — active shoulder recovery between sets.',
      exercises: [
        { name:'DB or barbell OHP', sets:'3', reps:'8–10', rest:'0s', tag:'Compound',
          notes:"DB for freedom of movement, barbell if feeling strong. Don't hyperextend lower back." },
        { name:'Face pull', sets:'3', reps:'15', rest:'75s', tag:'Rehab/Width',
          notes:'Pull to forehead, elbows high. Non-negotiable for shoulder health.' },
      ],
    },
    {
      label: 'SS3 — Arm Finisher',
      rationale: 'Biceps and triceps are direct antagonists — one rests while the other works.',
      exercises: [
        { name:'Incline DB curl', sets:'3', reps:'10–12', rest:'0s', tag:'Superset',
          notes:'Max bicep stretch from the incline. Straight into pushdowns.' },
        { name:'Cable pushdown (straight bar)', sets:'3', reps:'12–15', rest:'60s', tag:'Superset',
          notes:'Triceps are 2/3 of arm size. They matter more than biceps.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'DB shrugs', sets:'2', reps:'12–15', note:'Traps frame the shoulders from the front and back.' },
      { name:'Band pull-apart', sets:'2', reps:'20', note:'Posture work. Counters desk hunch.' },
    ],
  }),
];

/* ============================================================
   PHASE 2 — weeks 7-14. New stimulus. Chest specialisation,
   delt caps, abs 2x/week, posture work baked in.
   ============================================================ */
const PHASE2_DAYS = [
  day('d1', 'Thickness + width, posture built in', [
    {
      label: 'SS1 — Chest-Supported Row + Close-Grip Pulldown',
      rationale: 'New angles vs Phase 1. Chest-supported row builds mid-back thickness (the posture muscle between your shoulder blades) without lower back fatigue. Close grip hits lats through a longer range.',
      exercises: [
        { name:'Chest-supported machine row', sets:'4', reps:'10–12', rest:'0s', tag:'Compound',
          notes:'Chest stays glued to the pad. Drive elbows back, squeeze shoulder blades together — this is your posture builder.' },
        { name:'Close/neutral-grip lat pulldown', sets:'4', reps:'10–12', rest:'90s', tag:'Compound',
          notes:'Neutral grip, bigger stretch at the top than wide grip. Lean back slightly, pull to upper chest.' },
      ],
    },
    {
      label: 'SS2 — Cable Row + Rope Pullover',
      rationale: "Single-arm cable row lets you work each side's full range. Rope straight-arm pullover replaces the bar version — deeper stretch.",
      exercises: [
        { name:'Single-arm cable row (seated or standing)', sets:'3', reps:'10–12 each', rest:'0s', tag:'Compound',
          notes:'Let the weight pull you into a stretch, then drive the elbow back. Full rotation of the shoulder blade.' },
        { name:'Rope straight-arm pulldown', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Rope allows a deeper finish past your hips. Feel the lats the whole way.' },
      ],
    },
    {
      label: 'SS3 — Biceps: Stretch + Peak',
      rationale: 'New curl angles. Preacher isolates completely (no cheating), reverse curl builds forearm and brachialis for thicker-looking arms.',
      exercises: [
        { name:'Preacher curl (machine or EZ bar)', sets:'3', reps:'10–12', rest:'0s', tag:'Isolation',
          notes:"Arm locked on the pad — pure bicep, no momentum. Control the bottom stretch, don't bounce." },
        { name:'Reverse EZ-bar curl', sets:'3', reps:'12–15', rest:'60s', tag:'Isolation',
          notes:'Overhand grip. Builds brachialis and forearms — makes the whole arm look bigger in sleeves.' },
      ],
    },
  ], {
    label:'Extra time? (+12 min)',
    exercises: [
      { name:'Hanging knee raise', sets:'3', reps:'12–15', note:'Ab session #2 for the week starts here. Slow, no swinging.' },
      { name:'Dead hang', sets:'2', reps:'30–45s', note:'Lat stretch + grip + spine decompression.' },
    ],
  }),

  day('d2', 'Chest specialisation block', [
    {
      label: 'SS1 — Machine Press + Deep-Stretch Fly',
      rationale: 'Machine incline press lets you push closer to failure safely than DBs (no balance demand) — perfect for a specialisation block. Pec deck holds tension in the stretched position, which is the #1 growth driver.',
      exercises: [
        { name:'Incline machine chest press', sets:'4', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Go heavier than you would with DBs — the machine has your back. Last 2 reps should be a genuine fight.' },
        { name:'Pec deck fly', sets:'4', reps:'12–15', rest:'90s', tag:'Isolation',
          notes:'Let the arms travel back into a deep stretch. Pause there for a beat. That stretch is where chest grows.' },
      ],
    },
    {
      label: 'SS2 — Weighted Dip + Low-to-High Fly',
      rationale: 'Dips with a forward lean are one of the best lower/outer chest builders. Low-to-high cable fills in the upper chest from a new angle — the opposite direction to Phase 1.',
      exercises: [
        { name:'Chest dips (lean forward, add weight if easy)', sets:'3', reps:'8–12', rest:'0s', tag:'Compound',
          notes:'Lean the torso forward, elbows slightly flared — that shifts it from triceps to chest. Add a dip belt when 12 gets easy.' },
        { name:'Low-to-high cable fly', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Cables at the bottom, sweep up and in. Finishes the upper chest that the incline press started.' },
      ],
    },
    {
      label: 'SS3 — Triceps: Bar + Cross-Body',
      rationale: 'Cross-body pushdown hits the long head from a side angle without any overhead position — full triceps coverage, zero elbow stress.',
      exercises: [
        { name:'Straight bar pushdown', sets:'3', reps:'12–15', rest:'0s', tag:'Isolation',
          notes:"Same as Phase 1 — it works and it's elbow-safe. Go heavier now." },
        { name:'Cross-body cable pushdown', sets:'3', reps:'12–15 each', rest:'60s', tag:'Isolation',
          notes:'Single arm, pull across your body. Hits the long head without going overhead. New stimulus for the elbow-friendly arm.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Incline DB press dropset', sets:'1', reps:'3 drops to failure', note:'One brutal dropset. Chest specialisation means leaving nothing.' },
      { name:'Wall slides', sets:'2', reps:'12', note:'Posture reset after all the pressing. Shoulders back where they belong.' },
    ],
  }),

  day('d3', 'Unilateral strength + ab block', [
    {
      label: 'SS1 — Split Squat + Calf',
      rationale: 'Bulgarian split squats replace leg press — unilateral work fixes imbalances, builds glutes, and demands core stability. Harder, better.',
      exercises: [
        { name:'Bulgarian split squat (DBs)', sets:'3', reps:'8–10 each', rest:'0s', tag:'Compound',
          notes:'Rear foot on a bench. Torso slightly forward for glutes, upright for quads. These are hard — start light.' },
        { name:'Standing calf raise', sets:'3', reps:'12–15', rest:'90s', tag:'Isolation',
          notes:'Standing hits the gastrocnemius (the visible calf muscle) vs seated. Full stretch and squeeze.' },
      ],
    },
    {
      label: 'SS2 — Hinge + Curl',
      rationale: "Keep the RDL — it's too good to drop — but go heavier now. Lying leg curl swaps in for variety.",
      exercises: [
        { name:'Romanian deadlift (heavier)', sets:'3', reps:'8', rest:'0s', tag:'Compound',
          notes:'Drop to 8 reps, add weight vs Phase 1. Hinge pattern should feel dialled by now.' },
        { name:'Lying leg curl', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Different knee angle to seated — new stimulus for the hamstrings.' },
      ],
    },
    {
      label: 'SS3 — Ab Block (upgraded)',
      rationale: 'Abs are now a proper training block, not an afterthought. Weighted crunch builds thickness, hanging raise hits lower abs, Pallof hits obliques and posture-supporting deep core.',
      exercises: [
        { name:'Weighted cable crunch', sets:'3', reps:'10–12', rest:'0s', tag:'Core',
          notes:'Treat it like a lift — heavy enough that 12 is a fight. Thicker abs show more at any body fat.' },
        { name:'Pallof press', sets:'3', reps:'12 each side', rest:'60s', tag:'Core',
          notes:'Cable at chest height, press out and resist the rotation. Obliques + deep core + posture in one move.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Leg extension', sets:'2', reps:'15', note:'Quad volume you dropped when leg press left. Optional top-up.' },
      { name:'Hanging leg raise', sets:'2', reps:'10–12', note:'Straight legs if you can, knees if not. Lower abs.' },
    ],
  }),

  day('d4', 'Cap building + posture work', [
    {
      label: 'SS1 — Heavy Laterals + Rear Delt',
      rationale: "DB lateral raises with partials after failure — the fastest-working delt cap protocol. Rear delts stay every week, they're what make shoulders look 3D and fix rounded posture.",
      exercises: [
        { name:'DB lateral raise + partials', sets:'4', reps:'12 full + 8 partials', rest:'0s', tag:'Isolation',
          notes:'12 full reps, then immediately 8 half-reps from the bottom. The burn is the point. Caps respond to this fast.' },
        { name:'Rear delt cable fly (cross-over)', sets:'4', reps:'15', rest:'75s', tag:'Isolation',
          notes:'Cables crossed at face height, pull apart. Constant tension beats the pec deck version — feel free to alternate.' },
      ],
    },
    {
      label: 'SS2 — Press + Posture Pair',
      rationale: 'Machine press lets you push the anterior delts harder safely. Paired with face pulls — every heavy press is balanced by a posture pull. This pairing IS your posture fix.',
      exercises: [
        { name:'Machine shoulder press', sets:'3', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Machine = safe path for your shoulders while going heavy. Push close to failure.' },
        { name:'Face pull (heavier)', sets:'3', reps:'15', rest:'75s', tag:'Rehab/Width',
          notes:'Add weight vs Phase 1. Pull to forehead, pause 1 second with elbows high. Best posture exercise that exists.' },
      ],
    },
    {
      label: 'SS3 — Arms: New Angles',
      rationale: 'Bayesian curl (cable from behind) trains the bicep in its most stretched position — the fastest-growing position. Single-arm pushdown finishes triceps.',
      exercises: [
        { name:'Bayesian cable curl', sets:'3', reps:'10–12 each', rest:'0s', tag:'Superset',
          notes:'Face away from the cable, arm slightly behind you. Deep bicep stretch at the bottom of every rep.' },
        { name:'Single-arm cable pushdown', sets:'3', reps:'12–15 each', rest:'60s', tag:'Superset',
          notes:'One arm at a time — spot and fix any left/right imbalance.' },
      ],
    },
  ], {
    label:'Extra time? (+12 min)',
    exercises: [
      { name:'Cable upright row (wide grip)', sets:'2', reps:'12–15', note:'Traps + side delts. Wide grip keeps it shoulder-safe.' },
      { name:'Band pull-apart + wall slide circuit', sets:'2', reps:'15 + 10', note:'Posture finisher. Do these even on lazy days.' },
    ],
  }),
];

/* ============================================================
   PHASE 3 — weeks 15-22. Width peak.

   Phase 1 built the base, Phase 2 specialised chest and started the
   delt caps. What's still lagging against the reference photos is
   width: side delts and lat spread. So Phase 3 puts intensity
   techniques on exactly those, and drops chest to maintenance volume.

   Intensity rather than load, deliberately — myo-reps, drop sets and
   1.5 reps generate a lot of stimulus at moderate weight, which is what
   an unstable shoulder and a cranky triceps tendon can actually take
   after 14 weeks of accumulating fatigue.
   ============================================================ */
const PHASE3_DAYS = [
  day('d1', 'Lat width peak — intensity techniques', [
    {
      label: 'SS1 — 1.5-Rep Pulldown + Weighted Pull-up',
      rationale: "1.5 reps double the time the lats spend in the hardest part of the range. Then weighted pull-ups while you're warm — the single best width builder, now loaded.",
      exercises: [
        { name:'Wide-grip lat pulldown (1.5 reps)', sets:'4', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Full rep down, back up halfway, down again — that counts as one. Use about 70% of your normal weight. Brutal on the lats, easy on the joints.' },
        { name:'Weighted / assisted wide pull-up', sets:'4', reps:'6–8', rest:'90s', tag:'Compound',
          notes:'Add weight if bodyweight 10s are comfortable now. Dead hang each rep. Compare to Phase 1 — this is your width progress marker.' },
      ],
    },
    {
      label: 'SS2 — Row + Straight-Arm Drop Set',
      rationale: 'Chest-supported row keeps the mid-back and posture work from Phase 2. Straight-arm drop set floods the lats with no elbow involvement at all.',
      exercises: [
        { name:'Chest-supported machine row', sets:'3', reps:'10–12', rest:'0s', tag:'Compound',
          notes:'Same posture builder as Phase 2, heavier. Squeeze the blades together for a full second.' },
        { name:'Straight-arm pulldown (double drop)', sets:'3', reps:'12 + 8 + 8', rest:'75s', tag:'Isolation',
          notes:'12 reps, drop the weight, 8 more, drop again, 8 more. No rest between drops. Pure lat, zero biceps.' },
      ],
    },
    {
      label: 'SS3 — Biceps Myo-Reps',
      rationale: 'Myo-reps get close to the stimulus of three straight sets in a fraction of the time — useful when the session is already long.',
      exercises: [
        { name:'Incline DB curl (myo-reps)', sets:'1', reps:'12 + 4×4', rest:'0s', tag:'Isolation',
          notes:'One hard set of 12, rest 15 seconds, 4 reps. Repeat that four times. One activation set, four mini-sets.' },
        { name:'Hammer curl', sets:'3', reps:'12–15', rest:'60s', tag:'Isolation',
          notes:'Brachialis again — it pushes the bicep up and thickens the forearm. Kept from Phase 1 because it works.' },
      ],
    },
  ], {
    label:'Extra time? (+12 min)',
    exercises: [
      { name:'Dead hang', sets:'3', reps:'45–60s', note:'Longer holds now. Decompression plus a genuine lat stretch.' },
      { name:'Hanging knee raise', sets:'3', reps:'15', note:'Keeps abs at 2x/week, as Phase 2 established.' },
    ],
  }),

  day('d2', 'Chest maintenance, triceps push', [
    {
      label: 'SS1 — Incline Press + Deep-Stretch Fly',
      rationale: 'Chest drops to maintenance volume this phase — two hard sets keep everything you built in Phase 2 while freeing up recovery for delts and lats.',
      exercises: [
        { name:'Incline machine chest press', sets:'3', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Maintenance, not specialisation. Match your Phase 2 loads, do not chase new ones.' },
        { name:'Pec deck fly', sets:'3', reps:'12–15', rest:'90s', tag:'Isolation',
          notes:'Deep stretch, pause at the bottom. Stretch under load is what maintains size at lower volume.' },
      ],
    },
    {
      label: 'SS2 — Push-up Drop + Lateral Raise',
      rationale: 'Delts get a slot on chest day this phase. Side delts recover fast and respond to frequency — hitting them twice a week is the fastest route to width.',
      exercises: [
        { name:'Weighted push-up to failure', sets:'3', reps:'max', rest:'0s', tag:'Compound',
          notes:'Plate on the back or a band. Straight into laterals — chest is done, shoulders are the priority.' },
        { name:'Cable lateral raise (single arm)', sets:'4', reps:'15', rest:'60s', tag:'Isolation',
          notes:'Second delt session of the week. Constant tension, slow negative, no swinging.' },
      ],
    },
    {
      label: 'SS3 — Triceps: Long Head + Lateral Head',
      rationale: 'Cross-body for the long head without overhead position, straight bar for the lateral head. Full coverage, nothing that irritates the tendon.',
      exercises: [
        { name:'Cross-body cable pushdown', sets:'3', reps:'12–15 each', rest:'0s', tag:'Isolation',
          notes:'Kept from Phase 2 — it gave you long-head work without the overhead position that flares the elbow.' },
        { name:'Straight bar pushdown (drop set)', sets:'3', reps:'12 + 10', rest:'60s', tag:'Isolation',
          notes:'One drop per set. High reps keep blood in the tendon, which the elbow actually likes.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Wall slides', sets:'2', reps:'12', note:'Posture reset after pressing. Non-negotiable by now.' },
      { name:'Face pull', sets:'2', reps:'20', note:'You can never do too many. Shoulder health and rear delts.' },
    ],
  }),

  day('d3', 'Legs + core, maintained', [
    {
      label: 'SS1 — Split Squat + Calf',
      rationale: 'Unilateral work stays from Phase 2 — it fixes the imbalance and the knee cave better than bilateral pressing does.',
      exercises: [
        { name:'Bulgarian split squat (DBs)', sets:'3', reps:'10 each', rest:'0s', tag:'Compound',
          notes:'Heavier than Phase 2. Knee tracks over the middle toes — this is your knee-cave fix.' },
        { name:'Standing calf raise', sets:'3', reps:'12–15', rest:'90s', tag:'Isolation',
          notes:'Full stretch, hold the top. Calves need the range more than the load.' },
      ],
    },
    {
      label: 'SS2 — Hinge + Curl',
      rationale: 'RDL stays — it is still the best posterior chain movement available and the hinge pattern is dialled by now.',
      exercises: [
        { name:'Romanian deadlift', sets:'3', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Add weight again. Bar close to the shins, hinge not squat.' },
        { name:'Seated leg curl', sets:'3', reps:'12–15', rest:'75s', tag:'Isolation',
          notes:'Back to seated — the stretched position hits hamstrings harder than lying.' },
      ],
    },
    {
      label: 'SS3 — Ab Block',
      rationale: 'Weighted crunch for thickness, Pallof for obliques and deep core. Straight from Phase 2 because that block was right.',
      exercises: [
        { name:'Weighted cable crunch', sets:'3', reps:'10–12', rest:'0s', tag:'Core',
          notes:'Heavier again. Thicker abs show at any body fat, and you are lean enough already.' },
        { name:'Pallof press', sets:'3', reps:'12 each side', rest:'60s', tag:'Core',
          notes:'Resist the rotation. Obliques plus the deep core that holds your posture together.' },
      ],
    },
  ], {
    label:'Extra time? (+10 min)',
    exercises: [
      { name:'Leg extension', sets:'2', reps:'15–20', note:'Quad top-up if legs feel neglected this phase.' },
      { name:'Hanging leg raise', sets:'2', reps:'12', note:'Straight legs. Lower abs and serratus.' },
    ],
  }),

  day('d4', 'Delt cap peak — the priority session', [
    {
      label: 'SS1 — Lateral Raise Mechanical Drop + Rear Delt',
      rationale: 'A mechanical drop set moves from the hardest version to the easiest without changing the weight, so you can take side delts far past normal failure. This is the single most important superset for the swimmer look.',
      exercises: [
        { name:'DB lateral raise (mechanical drop)', sets:'4', reps:'8 strict + 8 lean-away + 8 partials', rest:'0s', tag:'Isolation',
          notes:'8 strict, then 8 leaning away from a post, then 8 partials from the bottom. Same dumbbells throughout. The burn is unreasonable — that is the point.' },
        { name:'Rear delt cable fly (cross-over)', sets:'4', reps:'15–20', rest:'75s', tag:'Isolation',
          notes:'Constant tension at face height. Rear delts are what make the caps look round from every angle.' },
      ],
    },
    {
      label: 'SS2 — Press + Posture Pair',
      rationale: 'The Phase 2 pairing stays exactly as it was: every heavy press balanced by a posture pull. It is the reason your shoulders have held up.',
      exercises: [
        { name:'Machine shoulder press', sets:'3', reps:'8–10', rest:'0s', tag:'Compound',
          notes:'Fixed path, safe for your shoulder while going heavy. Stop short of lockout for the elbow.' },
        { name:'Face pull (heavy, paused)', sets:'3', reps:'15', rest:'75s', tag:'Rehab/Width',
          notes:'One-second pause with elbows high. Heaviest of the three phases.' },
      ],
    },
    {
      label: 'SS3 — Upright Row + Arm Finisher',
      rationale: 'Wide-grip upright row hits side delts and traps together, framing the shoulders. Then one antagonist arm pair to finish.',
      exercises: [
        { name:'Cable upright row (wide grip)', sets:'3', reps:'12–15', rest:'0s', tag:'Isolation',
          notes:'Wide grip only — narrow grip impinges the shoulder. Elbows lead, stop at chest height.' },
        { name:'Bayesian cable curl', sets:'3', reps:'10–12 each', rest:'60s', tag:'Superset',
          notes:'Deep stretch behind the body. Kept from Phase 2 — the most productive curl you have.' },
      ],
    },
  ], {
    label:'Extra time? (+12 min)',
    exercises: [
      { name:'Lateral raise burnout', sets:'1', reps:'50 total', note:'Lightest dumbbells in the rack. Rest as needed, 50 reps total. Finish the caps.' },
      { name:'Band pull-apart + wall slide circuit', sets:'2', reps:'20 + 10', note:'Posture finisher. Every session, every phase.' },
    ],
  }),
];

/* ---------------- phases ---------------- */
export const PHASES = [
  {
    phase: 1, name: 'Foundation', weeks: 'Weeks 1–6',
    focus: 'The foundation block. Lat width, chest priority, delt caps started.',
    note: "The foundation block you've been running. Keep it here for reference or fall back to it any time.",
    days: PHASE1_DAYS,
  },
  {
    phase: 2, name: 'Specialisation', weeks: 'Weeks 7–14',
    focus: 'New variations. Chest specialisation, delt cap partials, abs 2x/week, posture baked in.',
    note: 'New exercise variations for fresh stimulus. Extra focus baked in: chest specialisation, delt caps (lateral raise partials), abs upgraded to a real training block 2x/week, and posture work (chest-supported rows, face pulls, wall slides) throughout. Take one easy deload week before starting.',
    days: PHASE2_DAYS,
  },
  {
    phase: 3, name: 'Width Peak', weeks: 'Weeks 15–22',
    focus: 'Intensity techniques on delts and lats. Chest drops to maintenance.',
    note: 'Built on what was still lagging: width. Side delts move to twice a week, lats get 1.5-reps and drop sets, and chest drops to maintenance volume to free up recovery. Intensity techniques instead of heavier loads — kinder to the shoulder and elbow after 14 weeks of accumulated fatigue. Deload one week first.',
    days: PHASE3_DAYS,
  },
];

/** Kept as an alias so existing imports don't break. */
export const BLOCKS = PHASES;

/* ---------------- progression rules (from the original) ---------------- */
export const PROGRESSION = [
  { label:'Progressive Overload',
    text:'Add 1 rep per session. Top of the rep range on all sets of both exercises → add the smallest weight increment.' },
  { label:'RPE Target',
    text:"RPE 8 on compounds (2 in the tank). RPE 9–9.5 on isolation. The second exercise in a superset will feel harder — that's the point." },
  { label:'Phase Timing',
    text:'Run each phase 6–8 weeks. Deload (50% volume) at the halfway mark. Phase 3 then loops back to Phase 1 with heavier loads.' },
];

export const TAG_STYLE = {
  'Compound':    { bg:'#F0F0F0', fg:'#555555' },
  'Isolation':   { bg:'#F7F7F7', fg:'#777777' },
  'Core':        { bg:'#EDFAF3', fg:'#00913A' },
  'Rehab/Width': { bg:'#F5EDFF', fg:'#7B00D4' },
  'Superset':    { bg:'#FFF3EC', fg:'#E85D00' },
};

/* ---------------- muscle classification ----------------
   Keyword matching rather than tagging every exercise by hand, so the
   totals stay correct when exercises are swapped. Order matters: the
   first match wins, so specific patterns sit above general ones. */
const MUSCLE_RULES = [
  [/lateral raise|upright row|lateral/i,                        'Side delts'],
  [/rear delt|rear|reverse pec|reverse fly|face pull|pull-apart|y-raise/i, 'Rear delts & traps'],
  [/shrug/i,                                                    'Traps'],
  [/leg curl|romanian|rdl|deadlift/i,                           'Hamstrings'],
  [/squat|leg press|hack|lunge|leg extension/i,                 'Quads'],
  [/calf/i,                                                     'Calves'],
  [/crunch|plank|leg raise|knee raise|pallof|woodchop|ab wheel/i,'Core'],
  [/curl|preacher|bayesian|hammer/i,                            'Biceps'],
  [/pushdown|triceps|tricep|close-grip|overhead.*extension/i,   'Triceps'],
  [/pulldown|pull-up|pullup|straight-arm|dead hang/i,           'Lats'],
  [/row/i,                                                      'Upper back'],
  [/shoulder press|ohp|overhead press/i,                        'Front delts'],
  [/incline|chest press|pec deck|pec-deck|fly|crossover|push-up|dip|bench|flat db press/i, 'Chest'],
];

export function muscleOf(name){
  for (const [re, m] of MUSCLE_RULES) if (re.test(name)) return m;
  return 'Other';
}

const setCount = ex => parseInt(ex.sets, 10) || 1;

/** Weekly sets per muscle — the check that a phase actually biases what
    the goal needs, rather than just looking busy. */
export function weeklyVolume(phase){
  const out = {};
  phase.days.forEach(d => d.supersets.forEach(ss => ss.exercises.forEach(ex => {
    const m = muscleOf(ex.name);
    out[m] = (out[m] || 0) + setCount(ex);
  })));
  return Object.entries(out).sort((a,b) => b[1] - a[1]);
}

/** Rough session length from set count and the rests actually written in. */
export function sessionMinutes(d){
  let sets = 0, restSec = 0;
  d.supersets.forEach(ss => ss.exercises.forEach(ex => {
    const n = setCount(ex);
    sets += n;
    restSec += n * (parseInt(ex.rest, 10) || 0);
  }));
  return Math.round((sets * 40 + restSec) / 60) + 6;   // + warm-up
}

export const totalExercises = d =>
  d.supersets.reduce((n,ss) => n + ss.exercises.length, 0);

/* ---------------- physique model ---------------- */
export const PHYSIQUE = {
  height: 185,
  start: 75,
  goal: 83,
  note: 'You are already lean enough. The remaining gap is shoulder and back width, which only comes from a surplus plus delt and lat volume.',
  rateLo: 0.15,   // kg/week — below this and you're not really bulking
  rateHi: 0.45,   // above this and you're adding fat, not just muscle
};
