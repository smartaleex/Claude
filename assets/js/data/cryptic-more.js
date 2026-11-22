/* ============================================================
   cryptic-more.js — the harder hand-written clues.

   Every entry carries its structured wordplay (`parse`), so the same
   verifier that gates machine-made clues has also proved each of these,
   letter by letter. See cryptic-verify.js for what that does and does
   not establish.
   ============================================================ */

const ch = (clue, answer, def, parts, nudge, wordplay, level = 2) => ({
  clue, answer, enumeration:`(${answer.length})`, def, device:'charade', level, parse:{ parts }, nudge, wordplay });
const ct = (clue, answer, def, outer, inner, indicator, nudge, wordplay) => ({
  clue, answer, enumeration:`(${answer.length})`, def, device:'container', level:2, parse:{ outer, inner, indicator }, nudge, wordplay });
const rv = (clue, answer, def, fodder, indicator, nudge, wordplay) => ({
  clue, answer, enumeration:`(${answer.length})`, def, device:'reversal', level:2, parse:{ fodder, indicator }, nudge, wordplay });
const dl = (clue, answer, def, source, removed, indicator, nudge, wordplay) => ({
  clue, answer, enumeration:`(${answer.length})`, def, device:'deletion', level:2, parse:{ source, removed, indicator }, nudge, wordplay });
const ini = (clue, answer, def, words, nudge, wordplay) => ({
  clue, answer, enumeration:`(${answer.length})`, def, device:'initials', level:2, parse:{ words, indicator:'initially' }, nudge, wordplay });

export const MORE = [
  /* ---- charades ---- */
  ch('Sailor: water and a chap (6)','SEAMAN','Sailor',['SEA','MAN'],'Two short words, one after the other.','SEA (water) + MAN (a chap) = SEAMAN.'),
  ch('Gym weight: pub and ring (7)','BARBELL','Gym weight',['BAR','BELL'],'A pub, then something you ring.','BAR (pub) + BELL (ring) = BARBELL.'),
  ch('Fungus: amphibian\'s seat (9)','TOADSTOOL','Fungus',['TOAD','STOOL'],'Take the amphibian literally.','TOAD (amphibian) + STOOL (seat) = TOADSTOOL.'),
  ch('Rest day: star, then 24 hours (6)','SUNDAY','Rest day',['SUN','DAY'],'The star is the closest one.','SUN (star) + DAY (24 hours) = SUNDAY.'),
  ch('Woolly top: motor, excavate and an (8)','CARDIGAN','Woolly top',['CAR','DIG','AN'],'Three pieces this time.','CAR (motor) + DIG (excavate) + AN = CARDIGAN.'),
  ch('Red: mark and rent (7)','SCARLET','Red',['SCAR','LET'],'A mark, then to rent out.','SCAR (mark) + LET (rent) = SCARLET.'),
  ch('Larder: pot and attempt (6)','PANTRY','Larder',['PAN','TRY'],'A cooking pot, then an attempt.','PAN (pot) + TRY (attempt) = PANTRY.'),
  ch('Austere fight and brown (7)','SPARTAN','Austere',['SPAR','TAN'],'A boxing session, then a colour.','SPAR (fight) + TAN (brown) = SPARTAN.'),
  ch('Infinite: finish, then not so much (7)','ENDLESS','Infinite',['END','LESS'],'The first piece is a synonym for finish.','END (finish) + LESS (not so much) = ENDLESS.'),
  ch('Fireplace: courage and hot (6)','HEARTH','Fireplace',['HEART','H'],'Courage is what you have at heart.','HEART (courage) + H (hot) = HEARTH.'),
  ch('Coach: locomotive, then the Queen (7)','TRAINER','Coach',['TRAIN','ER'],'The Queen has two letters in cryptics.','TRAIN (locomotive) + ER (the Queen) = TRAINER.'),
  ch('Delight: request, then the South East (6)','PLEASE','Delight',['PLEA','SE'],'A request, then a compass point pair.','PLEA (request) + SE (South East) = PLEASE.'),
  ch('Bold: bishop with party (5)','BRAVE','Bold',['B','RAVE'],'Bishop is one letter.','B (bishop) + RAVE (party) = BRAVE.'),
  ch('Game: the South, then harbour (5)','SPORT','Game',['S','PORT'],'South is one letter; harbour is a port.','S (south) + PORT (harbour) = SPORT.'),
  /* ---- containers ---- */
  ct('Look: sailor held by South East (5)','STARE','Look','SE','TAR','held by','Split the South East and put the sailor between.','TAR (sailor) inside SE (South East) = S-TAR-E.'),
  ct('Band: journey held by South East (6)','STRIPE','Band','SE','TRIP','held by','The journey goes between S and E.','TRIP (journey) inside SE (South East) = S-TRIP-E.'),
  ct('Extra: golf standard held by South East (5)','SPARE','Extra','SE','PAR','held by','Golf\'s standard score is three letters.','PAR (golf standard) inside SE (South East) = S-PAR-E.'),
  /* ---- reversals ---- */
  rv('Fit for a king: beer sent back (5)','REGAL','Fit for a king','LAGER','sent back','A type of beer, backwards.','LAGER (beer) reversed ("sent back") = REGAL.'),
  rv('Quarrel: faucets returned (4)','SPAT','Quarrel','TAPS','returned','Faucets are taps.','TAPS (faucets) reversed ("returned") = SPAT.'),
  rv('Nappy: settled up, going back (6)','DIAPER','Nappy','REPAID','going back','Settled up is past tense.','REPAID (settled up) reversed ("going back") = DIAPER.'),
  rv('Egg watcher: send payment back (5)','TIMER','Egg watcher','REMIT','back','To send payment, in one word.','REMIT (send payment) reversed ("back") = TIMER.'),
  /* ---- deletions ---- */
  dl('Frighten: scarce, losing cold (5)','SCARE','Frighten','SCARCE','C','losing','Cold is one letter. Two candidates — one works.','SCARCE without C (cold) = SCARE.'),
  dl('Journey: strip without southern (4)','TRIP','Journey','STRIP','S','without','Southern is one letter.','STRIP without S (southern) = TRIP.'),
  dl('Defeat beast dropping south (4)','BEAT','Defeat','BEAST','S','dropping','Drop one compass letter.','BEAST without S (south) = BEAT.'),
  /* ---- initials ---- */
  ini('Side: initially tea\'s enjoyed at mealtimes (4)','TEAM','Side','tea\'s enjoyed at mealtimes','Take the first letter of each word after the indicator.','First letters of Tea\'s Enjoyed At Mealtimes = TEAM.'),
  ini('Pulse: initially big eaters at nightspot (4)','BEAN','Pulse','big eaters at nightspot','First letters again, four words.','First letters of Big Eaters At Nightspot = BEAN.'),
  ini('Opening: initially girls attend the evening (4)','GATE','Opening','girls attend the evening','Pull the first letter from each word.','First letters of Girls Attend The Evening = GATE.'),
  /* ---- compound: two devices in one clue ---- */
  { clue:'Ceremonial dress: beer sent back, one and a (7)', answer:'REGALIA', enumeration:'(7)', def:'Ceremonial dress',
    device:'compound', level:3,
    parse:{ parts:[{t:'rev',fodder:'LAGER',result:'REGAL',indicator:'sent back'},{t:'lit',v:'I'},{t:'lit',v:'A'}] },
    nudge:'Do the reversal first, then add the small pieces on the end.',
    wordplay:'LAGER (beer) reversed ("sent back") = REGAL, then I (one) + A = REGALIA.' },
  { clue:'Fisherman: angel, wildly, with right (6)', answer:'ANGLER', enumeration:'(6)', def:'Fisherman',
    device:'compound', level:3,
    parse:{ parts:[{t:'anag',fodder:'ANGEL',result:'ANGLE',indicator:'wildly'},{t:'lit',v:'R'}] },
    nudge:'Scramble the angel, then add one abbreviated direction.',
    wordplay:'ANGEL anagrammed ("wildly") = ANGLE, then R (right) = ANGLER.' },
  { clue:'One hearing: silent, mixed, with the Queen (8)', answer:'LISTENER', enumeration:'(8)', def:'One hearing',
    device:'compound', level:3,
    parse:{ parts:[{t:'anag',fodder:'SILENT',result:'LISTEN',indicator:'mixed'},{t:'lit',v:'ER'}] },
    nudge:'A small anagram plus the Queen\'s two letters.',
    wordplay:'SILENT anagrammed ("mixed") = LISTEN, then ER (the Queen) = LISTENER.' },
  { clue:'Egg whisk: beast dropping south, with the Queen (6)', answer:'BEATER', enumeration:'(6)', def:'Egg whisk',
    device:'compound', level:3,
    parse:{ parts:[{t:'del',source:'BEAST',removed:'S',result:'BEAT',indicator:'dropping'},{t:'lit',v:'ER'}] },
    nudge:'Remove one letter from the beast, then add the Queen.',
    wordplay:'BEAST without S (south, "dropping") = BEAT, then ER (the Queen) = BEATER.' },
];
