/* ============================================================
   lift.js — jokes, lines, and the things that actually help.

   Quotes and truths are written down and tagged, never generated: a
   model will invent quotes and misattribute them, and improvising
   comfort at someone in a mood episode ends in something glib. What is
   smart is the choosing (core/mind.js): it leans on sleep, food and
   mood. Only quotes with an attribution that holds up are kept.

   Written down rather than generated, for two reasons. It has to work
   offline and instantly, at 2am with no signal, which is when it is
   most needed. And a model improvising comfort at someone in a mood
   episode will eventually produce something glib, or worse, something
   that reads as advice. A fixed bank can be checked once and trusted.

   Nothing in here says "everything happens for a reason", tells you to
   be grateful, or implies the problem is your attitude. His father has
   cancer. Some things are just bad, and a line that pretends otherwise
   does more harm than silence.
   ============================================================ */

/* Deliberately groan-worthy, and clean: nothing about illness, death,
   food, moods or medicine. A joke that is trying to be clever asks
   something of you; a bad pun just lands. */
export const JOKES = [
  'Sleep is just a time machine to breakfast.',
  "I'm reading a book about anti-gravity. Impossible to put down.",
  "Why don't skeletons fight each other? They don't have the guts.",
  'I used to hate facial hair. Then it grew on me.',
  'What do you call a fake noodle? An impasta.',
  "I'd tell you a chemistry joke but I know I wouldn't get a reaction.",
  "Parallel lines have so much in common. Shame they'll never meet.",
  'Why did the scarecrow win an award? He was outstanding in his field.',
  "What's the best thing about Switzerland? No idea, but the flag is a big plus.",
  "I have a fear of speed bumps. I'm slowly getting over it.",
  'Did you hear about the claustrophobic astronaut? He just needed a little space.',
  'I only know 25 letters of the alphabet. I don’t know y.',
  'The past, the present and the future walked into a bar. It was tense.',
  'I tried to catch fog yesterday. Mist.',
  'What do you call a bear with no teeth? A gummy bear.',
  "Why don't scientists trust atoms? They make up everything.",
  "I couldn't work out how to fasten my seatbelt. Then it clicked.",
  'What did the ocean say to the beach? Nothing, it just waved.',
  'My dog used to chase people on a bike. Got so bad I had to take his bike away.',
  'A bloke walked into a bar. Ouch.',
  'Why did the bicycle fall over? It was two tired.',
  "What do you call cheese that isn't yours? Nacho cheese.",
  "I've started telling everyone about the benefits of dried grapes. All about raisin awareness.",
  "Why can't you hear a pterodactyl in the bathroom? The P is silent.",
  "I named my dog Five Miles so I can tell people I walk Five Miles every day.",
  "What's orange and sounds like a parrot? A carrot.",
  "What do you call a boomerang that doesn't come back? A stick.",
  "Why was the koala rejected for the job? He didn't have the right koalafications.",
  "Don't trust stairs. They're always up to something.",
  'I got a job at a calendar factory but got fired. I took a couple of days off.',
  'The shovel was a ground-breaking invention.',
  'I used to be a banker, but I lost interest.',
  'What do you call a factory that makes okay products? A satisfactory.',
  'I wanted to learn to juggle, but it seemed like too much to handle. So I dropped it.',
  'Time flies like an arrow. Fruit flies like a banana.',
  "I'd been trying to lose my luggage for years. Then I found the airline.",
  'My boss told me to have a good day. So I went home.',
  'What did the buffalo say to his son when he left? Bison.',
  'How does a penguin build its house? Igloos it together.',
  'I dropped a hammer on my foot last week. It was a nail-biter.',
  'What do you call a sleeping bull? A bulldozer.',
  'Why did the golfer bring two pairs of trousers? In case he got a hole in one.',
  'What do you get when you cross a snowman with a vampire? Frostbite.',
  "The rotation of Earth really makes my day.",
  "I was going to make a joke about the hokey pokey, but that's what it's all about.",
  'Why did the tomato blush? It saw the salad dressing.',
  'What do you call a dinosaur that crashes his car? Tyrannosaurus wrecks.',
  'Why did the math book look sad? It had too many problems.',
  'What did one wall say to the other? I will meet you at the corner.',
  "How do you organise a space party? You planet.",
  'What do you call a pig that does karate? A pork chop.',
  'I asked the gym instructor if he could teach me to do the splits. He said: how flexible are you? I said I can’t make Tuesdays.',
  'A skeleton walks into a bar and orders a beer and a mop.',
  'What has ears but cannot hear? A cornfield.',
  "I used to play piano by ear. Now I use my hands.",
  'The man who invented the door knocker won the no-bell prize.',
  'Where do you take a boat that has been in a crash? To the dock.',
];

/* Quotes. Each has themes for core/mind.js to lean on. `on` is a short
   note from the app; only those with one can be the line of the day.
   Attribution is kept only where it holds up: paraphrases that circulate
   under a famous name have been dropped, and where a line is a
   translation or widely attributed, that is said. */
export const QUOTES = [
  { t:'Let everything happen to you: beauty and terror. Just keep going. No feeling is final.', a:'Rainer Maria Rilke', tags:['endure','acceptance'], on:'No feeling is final. Including this one.' },
  { t:'Be patient toward all that is unsolved in your heart.', a:'Rainer Maria Rilke, Letters to a Young Poet', tags:['patience','acceptance'], on:'Not everything has to be worked out this week.' },
  { t:'The opposite of depression is not happiness, but vitality.', a:'Andrew Solomon', tags:['endure','body'] },
  { t:'In the depth of winter, I finally learned that within me there lay an invincible summer.', a:'Albert Camus', tags:['endure','perspective'], on:'Written by someone who was not being metaphorical about the winter.' },
  { t:'One must imagine Sisyphus happy.', a:'Albert Camus', tags:['acceptance','perspective'], on:'The repetition is not the punishment. Deciding it is meaningless is.' },
  { t:'We suffer more often in imagination than in reality.', a:'Seneca', tags:['perspective','restraint'], on:'Count how many of today’s disasters actually happen.' },
  { t:'Sometimes even to live is an act of courage.', a:'Seneca', tags:['endure','courage','selfcompassion'], on:'On the days it is the whole job, it counts as the whole job.' },
  { t:'It is not that we have a short time to live, but that we waste a lot of it.', a:'Seneca', tags:['perspective','action'], on:'Also true of the hours spent deciding whether to start.' },
  { t:'It is not the man who has too little, but the man who craves more, that is poor.', a:'Seneca', tags:['restraint','perspective'], on:'Applies to progress as much as money.' },
  { t:'Begin at once to live, and count each separate day as a separate life.', a:'Seneca', tags:['present','selfcompassion'], on:'Today does not have to be part of a run. It can just be today.' },
  { t:'To be everywhere is to be nowhere.', a:'Seneca', tags:['restraint','present'], on:'If you are running six things, pick the two that matter this month.' },
  { t:'The mind should be given relaxation. It will rise improved and sharper after a good rest.', a:'Seneca, On Tranquillity of Mind', tags:['rest','restraint'], on:'Rest is part of the work, not a gap in it.' },
  { t:'Confine yourself to the present.', a:'Marcus Aurelius', tags:['present','restraint'] },
  { t:'You could leave life right now. Let that determine what you do and say and think.', a:'Marcus Aurelius', tags:['perspective','restraint'], on:'Not morbid, clarifying. Most of what you are worried about does not survive that test.' },
  { t:'The soul becomes dyed with the colour of its thoughts.', a:'Marcus Aurelius', tags:['perspective','restraint'] },
  { t:'The impediment to action advances action. What stands in the way becomes the way.', a:'Marcus Aurelius', tags:['effort','endure'], on:'The obstacle is the training, not an interruption to it.' },
  { t:'Waste no more time arguing what a good man should be. Be one.', a:'Marcus Aurelius', tags:['action','effort'], on:'Applies to bodies, businesses and sons.' },
  { t:'The best revenge is not to be like your enemy.', a:'Marcus Aurelius', tags:['restraint','perspective'], on:'Works on jobs and people who have worn you down.' },
  { t:'Receive without pride, let go without attachment.', a:'Marcus Aurelius', tags:['acceptance','restraint'], on:'Applies to good weeks as much as bad ones.' },
  { t:'Man is disturbed not by things, but by the views he takes of them.', a:'Epictetus', tags:['perspective','restraint'], on:'The gap between the event and your reading of it is the only place you have leverage.' },
  { t:'First say to yourself what you would be; and then do what you have to do.', a:'Epictetus', tags:['action','effort'], on:'Identity first, habits second. Not the other way round.' },
  { t:'Do not seek for things to happen as you wish, but wish for things to happen as they do, and your life will go well.', a:'Epictetus', tags:['acceptance','patience'], on:'The hardest one on this list. Worth returning to.' },
  { t:'How long are you going to wait before you demand the best for yourself?', a:'Epictetus', tags:['action','selfcompassion'], on:'Not a productivity line. A dignity one.' },
  { t:'Everything can be taken from a man but one thing: the last of the human freedoms, to choose one’s attitude in any given set of circumstances.', a:'Viktor Frankl', tags:['endure','perspective'], on:'The smallest possible freedom, and the one nobody can reach.' },
  { t:'He who has a why to live can bear almost any how.', a:'Nietzsche, quoted by Viktor Frankl', tags:['endure','perspective'], on:'The how is currently very heavy. Be clear with yourself about the why.' },
  { t:'The best way out is always through.', a:'Robert Frost', tags:['endure','patience'], on:'There is no clever route around a hard year.' },
  { t:'The world breaks everyone, and afterward many are strong at the broken places.', a:'Ernest Hemingway', tags:['endure','grief'] },
  { t:'There is a crack in everything. That is how the light gets in.', a:'Leonard Cohen', tags:['acceptance','endure'], on:'Nothing here says the crack is good. Only that it is not the end.' },
  { t:'Life can only be understood backwards; but it must be lived forwards.', a:'Søren Kierkegaard', tags:['patience','present'], on:'You are allowed to not understand this part yet.' },
  { t:'It may be that when we no longer know what to do, we have come to our real work.', a:'Wendell Berry', tags:['acceptance','patience'], on:'Not knowing is a stage, not a failure.' },
  { t:'God grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to know the difference.', a:'Reinhold Niebuhr', tags:['acceptance','courage'], on:'Your dad’s illness is the first kind. How you show up is the second.' },
  { t:'One cannot think well, love well, sleep well, if one has not dined well.', a:'Virginia Woolf, A Room of One’s Own', tags:['body','rest'], on:'A novelist making the same point your doctor would.' },
  { t:'Almost everything will work again if you unplug it for a few minutes. Including you.', a:'Anne Lamott', tags:['rest','selfcompassion'] },
  { t:'Courage doesn’t always roar. Sometimes it is the quiet voice at the end of the day saying: I will try again tomorrow.', a:'Mary Anne Radmacher', tags:['endure','courage','selfcompassion'], on:'You do not need to feel brave. You need to go again.' },
  { t:'Hope is not the conviction that something will turn out well, but the certainty that something makes sense regardless of how it turns out.', a:'Václav Havel', tags:['endure','acceptance'], on:'Hope without a promise attached. Sturdier for it.' },
  { t:'What is to give light must endure burning.', a:'Viktor Frankl', tags:['endure','grief'], on:'Frankl wrote this having lost almost everything. He is not being poetic.' },
  { t:'Start where you are. Use what you have. Do what you can.', a:'Arthur Ashe', tags:['action','selfcompassion'], on:'The small version counts.' },
  { t:'We are all just walking each other home.', a:'Ram Dass', tags:['connection','grief'], on:'Ring someone today. Not to fix anything.' },
  { t:'I urge you to please notice when you are happy, and exclaim or murmur or think at some point: if this isn’t nice, I don’t know what is.', a:'Kurt Vonnegut', tags:['present','perspective'] },
  { t:'Why do you go away? So that you can come back.', a:'Terry Pratchett', tags:['connection','patience'] },
  { t:'Tell me, what is it you plan to do with your one wild and precious life?', a:'Mary Oliver', tags:['action','perspective'] },
  { t:'A ship in harbour is safe, but that is not what ships are built for.', a:'John A. Shedd', tags:['courage','action'], on:'Applies to the business you keep not starting.' },
  { t:'Courage is not the absence of fear, but the judgement that something else is more important.', a:'after Ambrose Redmoon', tags:['courage'], on:'You do not need to feel brave. You need to go anyway.' },
  { t:'Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.', a:'Samuel Beckett', tags:['effort','endure'] },
  { t:'Nothing in the world is worth having or worth doing unless it means effort, pain, difficulty.', a:'Theodore Roosevelt', tags:['effort'] },
  { t:'No man steps in the same river twice, for it is not the same river and he is not the same man.', a:'attributed to Heraclitus', tags:['perspective','patience'], on:'You are not the person who started this stretch. That cuts both ways.' },
  { t:'Nature does not hurry, yet everything is accomplished.', a:'attributed to Lao Tzu', tags:['patience','rest','restraint'], on:'Read it twice if you have a lot of plans this week.' },
];

/* Kept under the old names for the things that import them. */
export const LINES = QUOTES;
export const DAILY = QUOTES.filter(q => q.on);

/* Not advice, and not reframing. Just true things about how this works,
   said plainly, the kind of thing a level-headed friend says when you
   are convinced your own judgement is the problem.

   `when` = only shown when the log says so (lowfood, shortsleep, low,
   high, mixed). No `when` = true any day. The conditional ones are what
   makes this feel like it is paying attention. */
export const TRUTHS = [
  { t:'A mood episode lies to you about how long it will last. It always feels permanent from the inside. It never is.' },
  { t:'You are not lacking discipline. You are running a nervous system on too little sleep and not enough food while your dad is sick. Anyone would be struggling.' },
  { t:'Forgetting things is a symptom, not a character flaw. Working memory is one of the first things to go when you are depleted.' },
  { t:'You went to the gym. In a stretch like this, that is not nothing. That is the hardest one to keep and you kept it.' },
  { t:'Your judgement about yourself is the least reliable instrument you own right now. Trust the log, not the feeling.' },
  { t:'The standard is not "handling it well". The standard is "still here, still taking the meds". You are meeting it.' },
  { t:'Three days of doing very little is not a relapse. It is three days.' },
  { t:'You do not have to feel better to do the next small thing. Doing the next small thing is usually what makes you feel better, in that order.' },
  { t:'Caring for a parent who is unwell is genuinely one of the hardest things a person does. It is not supposed to feel manageable.' },
  { t:'Nobody is keeping the scorecard you think they are keeping.' },
  { t:'If you are wondering whether to ring your doctor, that is usually the answer.' },

  { t:'Not eating makes every other symptom worse: mood, memory, concentration, sleep. It is the cheapest thing to fix and it pays back fastest.', when:['lowfood'] },
  { t:'Your intake has been low. A low mood and a low fuel tank feel almost identical from the inside, and only one of them takes ten minutes to fix. Eat something with protein in it first, then reassess.', when:['lowfood'] },
  { t:'When appetite disappears it is not a sign you do not need food. It is a sign that something else is loud. Small and often beats a proper meal you will not manage.', when:['lowfood'] },
  { t:'A drink with calories in it counts. Milk, a shake, a smoothie. When chewing feels like work, liquid is a legitimate meal.', when:['lowfood'] },

  { t:'Short sleep makes everything look worse than it is and makes you sure that it is not the sleep. It is at least partly the sleep.', when:['shortsleep'] },
  { t:'A bad night is not a bad week. Keep the routine anyway: same wake time, meds, some daylight before noon. That is what pulls the next night back.', when:['shortsleep'] },
  { t:'Sleeping much less than usual and feeling fine about it is worth noting. If it runs more than two nights, tell your doctor, even if you feel great.', when:['shortsleep','high'] },

  { t:'Low is a weather system, not a verdict. The task today is not to fix it. It is meds, food, a bit of light, and getting through.', when:['low'] },
  { t:'When you are low, everything you plan will look too big. That is the illness estimating, not you. Make the plan a quarter of the size.', when:['low'] },
  { t:'You do not owe anyone an update on how you are today. Say "rough day" and leave it there if that is all you have.', when:['low'] },
  { t:'Rest is not the opposite of recovery. Today, lying down without the guilt counts as doing the work.', when:['low'] },

  { t:'Feeling fast, sure and full of plans feels great, and it is also the moment to be most careful. Write the ideas down. Decide after a night of sleep.', when:['high'] },
  { t:'Anything big and hard to undo can wait 48 hours: spending, quitting, signing up, sending the long message. If it is still good after two days, it will still be good.', when:['high'] },
  { t:'A great idea at 2am and a great idea at 10am are different animals. You do not have to choose between them tonight.', when:['high'] },
  { t:'Feeling unusually good can be worth a quick word with your doctor, not because it is bad, but because you would want to know early.', when:['high'] },

  { t:'Low mood with a lot of energy is an uncomfortable mix, and it is worth taking seriously. Keep the day small, keep it slow, and consider letting your doctor know.', when:['mixed'] },
  { t:'Restless and low at once is one of the hardest states to sit in. Walk, not gym. Eat. Do not make decisions tonight.', when:['mixed'] },
];

/* Same date, same line, on every device. A context-aware pick is made by
   core/mind.js and then held still for the day, so it is something to
   sit with rather than a slot machine you reroll. */
export function dailyLine(dayKeyStr, pickFn){
  if (pickFn) return pickFn(DAILY, dayKeyStr);
  const n = Number(String(dayKeyStr).replaceAll('-', '')) || 0;
  return DAILY[n % DAILY.length];
}
