/* ============================================================
   cryptic.js — the clue bank and the teaching material.

   Hand-written rather than generated. A cryptic clue only works if the
   wordplay is exact — every letter accounted for, one definition, no
   slack — and a model inventing clues on the fly produces things that
   look like cryptics and don't actually solve. Wrong here is worse than
   absent: you'd sit there for ten minutes solving something unsolvable.

   Every entry carries its full parsing, because the explanation is the
   point. Getting one wrong and understanding why teaches you more than
   guessing one right.

   Fields:
     clue      what you read
     answer    uppercase, no spaces
     enumeration  the (6) or (3,4) shown after the clue
     def       the exact words in the clue that define the answer
     device    key into DEVICES below
     wordplay  how the rest of the clue builds the answer
     nudge     the middle hint — points at the mechanism, stops short
   ============================================================ */

export const DEVICES = {
  anagram: {
    name: 'Anagram',
    idea: 'Letters of a word in the clue, rearranged to spell the answer.',
    tell: 'An indicator word meaning broken, mixed, odd, cooked, drunk, badly, arranged — anything suggesting disorder.',
    example: '"Pay attention when silent, surprisingly (6)" — SILENT rearranged is LISTEN, and "pay attention" defines it.',
  },
  hidden: {
    name: 'Hidden word',
    idea: 'The answer is sitting in plain sight, spelled out across the words of the clue.',
    tell: 'Indicators like some of, part of, in, held by, concealed by, a bit of.',
    example: '"Notion buried in acid earth (4)" — acID EArth hides IDEA.',
  },
  container: {
    name: 'Container',
    idea: 'One piece of the answer is placed inside another.',
    tell: 'Words like in, inside, held by, wearing, swallowing, around, without (as in outside).',
    example: '"Buccaneer: a rodent in a pie (6)" — RAT inside PIE gives PIRATE.',
  },
  charade: {
    name: 'Charade',
    idea: 'Pieces defined one after another, joined end to end.',
    tell: 'No indicator needed — just two or three small definitions in a row.',
    example: '"A vehicle and an animal make a floor covering (6)" — CAR + PET.',
  },
  reversal: {
    name: 'Reversal',
    idea: 'A word written backwards.',
    tell: 'Returned, going back, brought up, turned over, recalled. In a down clue, rising or northward.',
    example: '"Puddings sent back leave you under pressure (8)" — DESSERTS reversed is STRESSED.',
  },
  double: {
    name: 'Double definition',
    idea: 'Two straight definitions of the same word, side by side. No wordplay at all.',
    tell: 'A very short clue that reads oddly, as though it changes subject halfway.',
    example: '"Not heavy, and not dark (5)" — LIGHT, twice over.',
  },
  homophone: {
    name: 'Homophone',
    idea: 'A word that sounds like the answer.',
    tell: 'We hear, reportedly, by the sound of it, on the radio, said, aloud.',
    example: '"Sir, reportedly, after dark (6)" — NIGHT sounds like KNIGHT.',
  },
  deletion: {
    name: 'Deletion',
    idea: 'Take a letter or two off a longer word.',
    tell: 'Losing, without, dropping, unfinished, endless, headless, almost.',
    example: '"A world losing time takes to the air (5)" — PLANET without T is PLANE.',
  },
  alternate: {
    name: 'Alternate letters',
    idea: 'Every second letter of a word in the clue.',
    tell: 'Regularly, oddly, evenly, every other, at intervals.',
    example: '"Regularly found on coasts — a pet (3)" — C-o-A-s-T-s gives CAT.',
  },
};

/* Abbreviations that turn up constantly. Worth knowing cold — half of
   solving is recognising that "learner" means L. */
export const SHORTHAND = [
  ['a chap, a man', 'HE'], ['learner, student', 'L'], ['love, nothing', 'O'],
  ['one', 'I or A'], ['fifty', 'L'], ['thousand', 'K or M'],
  ['bishop', 'B'], ['king', 'K or R'], ['queen', 'Q or ER'],
  ['doctor', 'DR or MO'], ['sailor', 'AB or TAR'], ['soldiers', 'RE or OR'],
  ['about', 'C, CA or RE'], ['very', 'V'], ['note', 'A to G, or DO RE MI'],
  ['point', 'N, S, E or W'], ['right', 'R'], ['left', 'L'],
  ['old', 'O'], ['new', 'N'], ['time', 'T'], ['university teacher', 'DON'],
];

export const CLUES = [
  /* ---- anagrams ---- */
  { clue:'Pay attention when silent, surprisingly (6)', answer:'LISTEN', enumeration:'(6)',
    def:'Pay attention', device:'anagram',
    nudge:'One word in the clue has exactly the right letters, in the wrong order.',
    wordplay:'SILENT rearranged ("surprisingly") gives LISTEN.' },
  { clue:'Terribly angered, and holding a bomb (7)', answer:'GRENADE', enumeration:'(7)',
    def:'a bomb', device:'anagram',
    nudge:'"Terribly" is doing the mixing, not describing the mood.',
    wordplay:'ANGERED anagrammed ("terribly") gives GRENADE.' },
  { clue:'Angered, badly — and now furious (7)', answer:'ENRAGED', enumeration:'(7)',
    def:'furious', device:'anagram',
    nudge:'Same seven letters as a word already in the clue.',
    wordplay:'ANGERED rearranged ("badly") gives ENRAGED. The clue tells you the answer means the same thing — that is the joke.' },
  { clue:'Dirty room converted for students to sleep in (9)', answer:'DORMITORY', enumeration:'(9)',
    def:'for students to sleep in', device:'anagram',
    nudge:'Two words supply the letters, not one.',
    wordplay:'DIRTY ROOM anagrammed ("converted") gives DORMITORY. A famous one — the fodder describes the answer too.' },
  { clue:'Carthorse rearranged into a band (9)', answer:'ORCHESTRA', enumeration:'(9)',
    def:'a band', device:'anagram',
    nudge:'The animal is not the answer — it is the raw material.',
    wordplay:'CARTHORSE anagrammed ("rearranged") gives ORCHESTRA.' },
  { clue:'Moon starer, shaken, studies the sky (10)', answer:'ASTRONOMER', enumeration:'(10)',
    def:'studies the sky', device:'anagram',
    nudge:'Ten letters sit in the clue already, in the wrong order.',
    wordplay:'MOON STARER anagrammed ("shaken") gives ASTRONOMER — the fodder means the answer as well.' },
  { clue:'Rescue, badly organised, to make safe (6)', answer:'SECURE', enumeration:'(6)',
    def:'make safe', device:'anagram',
    nudge:'"Badly organised" is an instruction, not a criticism.',
    wordplay:'RESCUE anagrammed gives SECURE.' },
  { clue:'Prenatal, oddly, like a mother and father (8)', answer:'PARENTAL', enumeration:'(8)',
    def:'like a mother and father', device:'anagram',
    nudge:'"Oddly" here means strangely, not every-second-letter.',
    wordplay:'PRENATAL anagrammed ("oddly") gives PARENTAL.' },
  { clue:'Detains, unusually, having been marked (7)', answer:'STAINED', enumeration:'(7)',
    def:'having been marked', device:'anagram',
    nudge:'Seven letters, already in the clue.',
    wordplay:'DETAINS anagrammed ("unusually") gives STAINED.' },
  { clue:'Relating, awkwardly, to a three-sided figure (8)', answer:'TRIANGLE', enumeration:'(8)',
    def:'a three-sided figure', device:'anagram',
    nudge:'"Awkwardly" is the indicator; the word before it is the fodder.',
    wordplay:'RELATING anagrammed gives TRIANGLE.' },
  { clue:'Related, somehow, but changed (7)', answer:'ALTERED', enumeration:'(7)',
    def:'changed', device:'anagram',
    nudge:'"Somehow" is doing the work.',
    wordplay:'RELATED anagrammed gives ALTERED.' },
  { clue:'Cheater, reformed, now runs the class (7)', answer:'TEACHER', enumeration:'(7)',
    def:'runs the class', device:'anagram',
    nudge:'"Reformed" is both a pun and the instruction.',
    wordplay:'CHEATER anagrammed ("reformed") gives TEACHER.' },
  { clue:'Real fun, sadly, this is not (7)', answer:'FUNERAL', enumeration:'(7)',
    def:'this is not [real fun]', device:'anagram',
    nudge:'Two words, seven letters, and the clue is telling you the mood.',
    wordplay:'REAL FUN anagrammed ("sadly") gives FUNERAL. The whole clue works as the definition too.' },

  /* ---- hidden ---- */
  { clue:'Notion buried in acid earth (4)', answer:'IDEA', enumeration:'(4)',
    def:'Notion', device:'hidden',
    nudge:'Stop rearranging. Read the letters straight across.',
    wordplay:'Hidden in "acID EArth" — buried tells you it is sitting there already.' },
  { clue:'Frank, seen in American did-it-yourself (6)', answer:'CANDID', enumeration:'(6)',
    def:'Frank', device:'hidden',
    nudge:'"Seen in" is literal.',
    wordplay:'Hidden in "AmeriCAN DID-it-yourself".' },
  { clue:'Guide concealed by specimen tortoise (6)', answer:'MENTOR', enumeration:'(6)',
    def:'Guide', device:'hidden',
    nudge:'Look across the join between the two words.',
    wordplay:'Hidden in "speciMEN TORtoise".' },
  { clue:'Something valuable in brass etching (5)', answer:'ASSET', enumeration:'(5)',
    def:'Something valuable', device:'hidden',
    nudge:'"In" is the instruction, not a linking word.',
    wordplay:'Hidden in "brASS ETching".' },
  { clue:'Rub out some of the danger a serpent poses (5)', answer:'ERASE', enumeration:'(5)',
    def:'Rub out', device:'hidden',
    nudge:'"Some of" is the giveaway.',
    wordplay:'Hidden in "dangER A SErpent".' },
  { clue:"Beginning shown in Wilson's et cetera (5)", answer:'ONSET', enumeration:'(5)',
    def:'Beginning', device:'hidden',
    nudge:'"Shown in" means exactly that.',
    wordplay:"Hidden in \"WilsON'S ET cetera\"." },
  { clue:'Tidy, as found in a line at the door (4)', answer:'NEAT', enumeration:'(4)',
    def:'Tidy', device:'hidden',
    nudge:'"As found in" is literal.',
    wordplay:'Hidden in "a liNE AT the door".' },

  /* ---- containers ---- */
  { clue:'Buccaneer: a rodent in a pie (6)', answer:'PIRATE', enumeration:'(6)',
    def:'Buccaneer', device:'container',
    nudge:'Put the small animal inside the pastry.',
    wordplay:'RAT (rodent) inside PIE gives PI-RAT-E.' },
  { clue:'Mythical beast: cloth inside a university teacher (6)', answer:'DRAGON', enumeration:'(6)',
    def:'Mythical beast', device:'container',
    nudge:'A university teacher is three letters.',
    wordplay:'RAG (cloth) inside DON (university teacher) gives D-RAG-ON.' },
  { clue:'Inexpensive: the man wearing a cap (5)', answer:'CHEAP', enumeration:'(5)',
    def:'Inexpensive', device:'container',
    nudge:'"The man" is two letters. "Wearing" means inside.',
    wordplay:'HE (the man) inside CAP gives C-HE-AP.' },
  { clue:'Backbone: a fastener held in the South East (5)', answer:'SPINE', enumeration:'(5)',
    def:'Backbone', device:'container',
    nudge:'South and East give you the outside letters.',
    wordplay:'PIN (fastener) inside S and E gives S-PIN-E.' },

  /* ---- charades ---- */
  { clue:'A vehicle and an animal make a floor covering (6)', answer:'CARPET', enumeration:'(6)',
    def:'a floor covering', device:'charade',
    nudge:'Two short words, joined in order.',
    wordplay:'CAR (vehicle) + PET (animal) = CARPET.' },
  { clue:'A helper and a few — good-looking (8)', answer:'HANDSOME', enumeration:'(8)',
    def:'good-looking', device:'charade',
    nudge:'Four letters then four letters.',
    wordplay:'HAND (helper) + SOME (a few) = HANDSOME.' },
  { clue:'Without a table, yet still worth mentioning (7)', answer:'NOTABLE', enumeration:'(7)',
    def:'worth mentioning', device:'charade',
    nudge:'"Without a table" is two words joined, not a subtraction.',
    wordplay:'NO + TABLE = NOTABLE.' },
  { clue:"Hospital section's gown: where clothes hang (8)", answer:'WARDROBE', enumeration:'(8)',
    def:'where clothes hang', device:'charade',
    nudge:'A hospital section is four letters; so is the gown.',
    wordplay:'WARD (hospital section) + ROBE (gown) = WARDROBE.' },
  { clue:"A chap's era spent running things (6)", answer:'MANAGE', enumeration:'(6)',
    def:'running things', device:'charade',
    nudge:'A chap, then a length of time.',
    wordplay:'MAN + AGE (era) = MANAGE.' },

  /* ---- reversals ---- */
  { clue:'Puddings sent back leave you under pressure (8)', answer:'STRESSED', enumeration:'(8)',
    def:'under pressure', device:'reversal',
    nudge:'Write the puddings backwards.',
    wordplay:'DESSERTS reversed ("sent back") gives STRESSED.' },
  { clue:'A prize returned to a sliding compartment (6)', answer:'DRAWER', enumeration:'(6)',
    def:'a sliding compartment', device:'reversal',
    nudge:'"Returned" means backwards, not given back.',
    wordplay:'REWARD reversed gives DRAWER.' },
  { clue:'Containers turned over? Halt! (4)', answer:'STOP', enumeration:'(4)',
    def:'Halt', device:'reversal',
    nudge:'Four letters, backwards.',
    wordplay:'POTS reversed ("turned over") gives STOP.' },
  { clue:'Existed, going backwards, like the Evil One (5)', answer:'DEVIL', enumeration:'(5)',
    def:'the Evil One', device:'reversal',
    nudge:'A past tense of "live".',
    wordplay:'LIVED reversed gives DEVIL.' },
  { clue:'Blemishes brought back — this is for drinking (5)', answer:'STRAW', enumeration:'(5)',
    def:'this is for drinking', device:'reversal',
    nudge:'Small skin blemishes, five letters, reversed.',
    wordplay:'WARTS reversed ("brought back") gives STRAW.' },

  /* ---- double definitions ---- */
  { clue:'Departed, or the opposite of right (4)', answer:'LEFT', enumeration:'(4)',
    def:'both halves', device:'double',
    nudge:'No wordplay here at all. Two meanings, one word.',
    wordplay:'LEFT = departed, and LEFT = the opposite of right.' },
  { clue:'Where money is kept, beside the river (4)', answer:'BANK', enumeration:'(4)',
    def:'both halves', device:'double',
    nudge:'One word, two unrelated meanings.',
    wordplay:'BANK = where money is kept, and BANK = the side of a river.' },
  { clue:'Not heavy, and not dark (5)', answer:'LIGHT', enumeration:'(5)',
    def:'both halves', device:'double',
    nudge:'The two halves describe the same word.',
    wordplay:'LIGHT = not heavy, and LIGHT = not dark.' },
  { clue:'A season to jump (6)', answer:'SPRING', enumeration:'(6)',
    def:'both halves', device:'double',
    nudge:'Very short clue — that usually means two definitions.',
    wordplay:'SPRING = a season, and SPRING = to jump.' },
  { clue:'A game, or a way to start a fire (5)', answer:'MATCH', enumeration:'(5)',
    def:'both halves', device:'double',
    nudge:'One word covers both.',
    wordplay:'MATCH = a game, and MATCH = what you strike.' },
  { clue:'A tree in your hand (4)', answer:'PALM', enumeration:'(4)',
    def:'both halves', device:'double',
    nudge:'"In" is not a container instruction here.',
    wordplay:'PALM = a tree, and PALM = part of your hand.' },
  { clue:'Angry — and go over (5)', answer:'CROSS', enumeration:'(5)',
    def:'both halves', device:'double',
    nudge:'The dash is doing the joining.',
    wordplay:'CROSS = angry, and CROSS = to go over.' },
  { clue:'Put your foot down and post it (5)', answer:'STAMP', enumeration:'(5)',
    def:'both halves', device:'double',
    nudge:'One word, two actions.',
    wordplay:'STAMP = put your foot down, and a STAMP goes on a letter.' },

  /* ---- homophones ---- */
  { clue:'Uninterested, we hear, but get on the plane (5)', answer:'BOARD', enumeration:'(5)',
    def:'get on the plane', device:'homophone',
    nudge:'"We hear" means it sounds like another word.',
    wordplay:'BORED (uninterested) sounds like BOARD.' },
  { clue:'Sir, reportedly, after dark (6)', answer:'KNIGHT', enumeration:'(6)',
    def:'Sir', device:'homophone',
    nudge:'"Reportedly" is the signal. What sounds like "after dark"?',
    wordplay:'NIGHT (after dark) sounds like KNIGHT.' },
  { clue:'A bloom, by the sound of it, used for baking (5)', answer:'FLOUR', enumeration:'(5)',
    def:'used for baking', device:'homophone',
    nudge:'"By the sound of it" is the instruction.',
    wordplay:'FLOWER (a bloom) sounds like FLOUR.' },
  { clue:'The atmosphere, we hear, belongs to this inheritor (4)', answer:'HEIR', enumeration:'(4)',
    def:'this inheritor', device:'homophone',
    nudge:'Three letters that sound like four.',
    wordplay:'AIR (the atmosphere) sounds like HEIR.' },
  { clue:'Dispatched, by the sound of it — a perfume (5)', answer:'SCENT', enumeration:'(5)',
    def:'a perfume', device:'homophone',
    nudge:'Past tense of "send".',
    wordplay:'SENT (dispatched) sounds like SCENT.' },

  /* ---- deletions ---- */
  { clue:'A world losing time takes to the air (5)', answer:'PLANE', enumeration:'(5)',
    def:'takes to the air', device:'deletion',
    nudge:'Time is one letter. Take it off a six-letter word.',
    wordplay:'PLANET (a world) without T (time) gives PLANE.' },
  { clue:'Warmth from the heart, which has lost its right (4)', answer:'HEAT', enumeration:'(4)',
    def:'Warmth', device:'deletion',
    nudge:'"Right" abbreviates to one letter.',
    wordplay:'HEART without R (right) gives HEAT.' },
  { clue:'Start without time, and become a celebrity (4)', answer:'STAR', enumeration:'(4)',
    def:'a celebrity', device:'deletion',
    nudge:'Time is T. Remove it.',
    wordplay:'START without T (time) gives STAR.' },
  { clue:'Brandy, unfinished, leaves a make (5)', answer:'BRAND', enumeration:'(5)',
    def:'a make', device:'deletion',
    nudge:'"Unfinished" means drop the last letter.',
    wordplay:'BRANDY without its final letter gives BRAND.' },

  /* ---- alternate letters ---- */
  { clue:'Regularly found on coasts — a pet (3)', answer:'CAT', enumeration:'(3)',
    def:'a pet', device:'alternate',
    nudge:'"Regularly" means take every second letter.',
    wordplay:'Every other letter of C-o-A-s-T-s gives CAT.' },
];

/* One clue a day, fixed by the date so it is the same all day and the
   same on every device. It cycles once you reach the end — a repeat in
   two months is a fair test of whether you actually learned the trick. */
const EPOCH = '2026-01-01';

export function clueIndexFor(dayKeyStr){
  const d = n => { const [y,m,dd] = n.split('-').map(Number); return Date.UTC(y, m-1, dd); };
  const days = Math.round((d(dayKeyStr) - d(EPOCH)) / 86400000);
  return ((days % CLUES.length) + CLUES.length) % CLUES.length;
}

export const clueFor = dayKeyStr => CLUES[clueIndexFor(dayKeyStr)];
