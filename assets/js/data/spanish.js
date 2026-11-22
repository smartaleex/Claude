/* ============================================================
   spanish.js — the Vale curriculum.

   Pitched for someone who lived in Spain for a year: the vocabulary
   and ear are there, the grammar has rusted. So this does NOT start at
   "hola". It starts at the things a returning B1 speaker actually gets
   wrong — preterite vs imperfect, the subjunctive, por/para — and runs
   through to the register and idiom that separate fluent from native.

   Peninsular Spanish throughout: vosotros is included, not skipped,
   and vocabulary is Spain's (coche, ordenador, móvil, zumo).
   ============================================================ */

export const LEVELS = [
  { id:'foundation', name:'Rebuild',  blurb:'The bones you already know but have stopped trusting.' },
  { id:'past',       name:'The past', blurb:'Preterite vs imperfect — the one everyone loses first.' },
  { id:'subjunctive',name:'Subjunctive', blurb:'The mood that separates textbook Spanish from real Spanish.' },
  { id:'fluent',     name:'Sounding native', blurb:'Register, idiom, and the filler words Spaniards actually use.' },
];

/* ---------------- lessons ----------------
   Each lesson: a short explanation written like a person talking, a
   table where a table genuinely helps, examples, and drills. */

export const LESSONS = [
  /* ========== FOUNDATION ========== */
  {
    id:'ser-estar', level:'foundation', title:'Ser vs Estar',
    hook:'Both mean "to be". The split is permanence vs state — but the useful version is: essence vs condition.',
    body:[
      { h:'Ser — what something *is*', p:'Identity, origin, profession, material, time, possession. The things that would still be true tomorrow.' },
      { h:'Estar — how something *is right now*', p:'Location, mood, temporary condition, and the result of a change. Also every progressive tense: estoy comiendo.' },
      { h:'The trap', p:'Some adjectives change meaning entirely. Ser aburrido = you are boring. Estar aburrido = you are bored. Ser listo = clever. Estar listo = ready. Getting these backwards is the classic giveaway.' },
    ],
    table:{
      head:['', 'ser', 'estar'],
      rows:[['yo','soy','estoy'],['tú','eres','estás'],['él/ella','es','está'],
            ['nosotros','somos','estamos'],['vosotros','sois','estáis'],['ellos','son','están']],
    },
    examples:[
      ['Soy de Sídney.','I am from Sydney.','Origin — never changes.'],
      ['Estoy en Sídney.','I am in Sydney.','Location — could change tomorrow.'],
      ['La sopa es buena.','The soup is good (as a dish).',''],
      ['La sopa está buena.','The soup tastes good (right now).','This is the one you want in a restaurant.'],
    ],
    drills:[
      { q:'___ cansado después del gimnasio.', a:'estoy', opts:['soy','estoy'], why:'Tiredness is a state, not an identity.' },
      { q:'Mi hermano ___ arquitecto.', a:'es', opts:['es','está'], why:'Profession is ser.' },
      { q:'La puerta ___ abierta.', a:'está', opts:['es','está'], why:'Result of a change — someone opened it.' },
      { q:'Hoy ___ martes.', a:'es', opts:['es','está'], why:'Days and dates take ser.' },
      { q:'¿Dónde ___ el móvil?', a:'está', opts:['es','está'], why:'Location is always estar.' },
    ],
  },

  {
    id:'por-para', level:'foundation', title:'Por vs Para',
    hook:'The shortcut that actually works: para points forward to a destination or purpose. Por points backward to a cause, or sideways to a means.',
    body:[
      { h:'Para — the arrow forward', p:'Destination (salgo para Madrid), deadline (para el viernes), purpose (para aprender), recipient (para ti), opinion (para mí).' },
      { h:'Por — cause, exchange, movement through', p:'Reason (por el tráfico), exchange (por 20 euros), duration (por dos años), means (por email), movement through (por la calle), and "on behalf of".' },
      { h:'The one that catches everyone', p:'"Gracias por" — you thank someone FOR a cause, never "gracias para". And "estudio para ser médico" (goal) vs "lo hago por ti" (motive).' },
    ],
    examples:[
      ['Este regalo es para ti.','This gift is for you.','Recipient — arrow forward.'],
      ['Gracias por venir.','Thanks for coming.','Cause of the gratitude.'],
      ['Pagué 30 euros por la camiseta.','I paid 30 euros for the shirt.','Exchange.'],
      ['Estudio para el examen.','I am studying for the exam.','Purpose.'],
    ],
    drills:[
      { q:'Lo hice ___ ti.', a:'por', opts:['por','para'], why:'Motive — because of you.' },
      { q:'Salgo ___ Barcelona mañana.', a:'para', opts:['por','para'], why:'Destination.' },
      { q:'Gracias ___ tu ayuda.', a:'por', opts:['por','para'], why:'Gracias always takes por.' },
      { q:'Necesito el informe ___ el lunes.', a:'para', opts:['por','para'], why:'Deadline.' },
      { q:'Caminamos ___ el parque.', a:'por', opts:['por','para'], why:'Movement through a space.' },
    ],
  },

  {
    id:'pronouns', level:'foundation', title:'Object pronouns & leísmo',
    hook:'Where the pronoun goes, and why Madrid says "le" when the textbook says "lo".',
    body:[
      { h:'Direct vs indirect', p:'Direct (what receives the action): me, te, lo/la, nos, os, los/las. Indirect (to/for whom): me, te, le, nos, os, les.' },
      { h:'Order: indirect before direct', p:'Te lo doy. Never "lo te doy". And when both are third person, le/les becomes se: "se lo di" — not "le lo di".' },
      { h:'Placement', p:'Before a conjugated verb (lo veo), or attached to an infinitive or gerund (voy a verlo / estoy viéndolo). Both are correct with a verb chain — pick either.' },
      { h:'Leísmo — the Spain thing', p:'In central Spain, "le" replaces "lo" for male people: "le vi" instead of "lo vi". It is accepted by the RAE for masculine people only. Using it will make you sound like you learned Spanish in Madrid, which you did.' },
    ],
    examples:[
      ['¿El libro? Lo tengo yo.','The book? I have it.',''],
      ['Se lo dije ayer.','I told him it yesterday.','le + lo becomes se lo.'],
      ['Estoy buscándola.','I am looking for her.','Attached to the gerund.'],
      ['A Juan le vi en el bar.','I saw Juan at the bar.','Leísmo — standard in Spain.'],
    ],
    drills:[
      { q:'¿Las llaves? ___ dejé en casa.', a:'Las', opts:['Los','Las','Le'], why:'Llaves is feminine plural, direct object.' },
      { q:'___ lo conté todo a mis padres.', a:'Se', opts:['Les','Se','Le'], why:'le/les becomes se before lo/la.' },
      { q:'Voy a ___ mañana. (llamar a ti)', a:'llamarte', opts:['te llamar','llamarte'], why:'Attaches to the infinitive.' },
    ],
  },

  /* ========== THE PAST ========== */
  {
    id:'pret-imp', level:'past', title:'Preterite vs Imperfect',
    hook:'This is the one that goes first, and it is the one that most marks you out. Not "when" but "how you are framing it".',
    body:[
      { h:'Preterite — the photograph', p:'A completed action with edges. It happened, it finished, the story moved forward. Ayer comí paella. Fui a Madrid tres veces.' },
      { h:'Imperfect — the film running behind', p:'Background, habit, description, ongoing states, age, time, weather. What was already going on. Comía paella todos los domingos. Eran las tres.' },
      { h:'The test that works', p:'Ask: am I moving the story forward, or setting the scene? Forward = preterite. Scene = imperfect. Most sentences use both: "Llovía cuando salí" — it was raining (scene) when I left (event).' },
      { h:'Verbs that change meaning', p:'Sabía = I knew. Supe = I found out. Conocía = I knew (a person). Conocí = I met. Quería = I wanted. Quise = I tried. No quise = I refused. Podía = I was able. Pude = I managed to.' },
    ],
    table:{
      head:['','hablar (pret)','hablar (imp)','ser (imp)','ir (pret)'],
      rows:[['yo','hablé','hablaba','era','fui'],['tú','hablaste','hablabas','eras','fuiste'],
            ['él','habló','hablaba','era','fue'],['nosotros','hablamos','hablábamos','éramos','fuimos'],
            ['vosotros','hablasteis','hablabais','erais','fuisteis'],['ellos','hablaron','hablaban','eran','fueron']],
    },
    examples:[
      ['Cuando era pequeño, vivía en Sídney.','When I was little, I lived in Sydney.','Both background.'],
      ['Estaba duchándome cuando sonó el teléfono.','I was showering when the phone rang.','Scene + event.'],
      ['Ayer fui al gimnasio y entrené piernas.','Yesterday I went to the gym and trained legs.','Story moving forward.'],
      ['Conocí a Marta en Valencia.','I met Marta in Valencia.','conocer in preterite = met, not knew.'],
    ],
    drills:[
      { q:'Cuando ___ (ser) niño, jugaba al fútbol.', a:'era', opts:['fui','era'], why:'Background state — imperfect.' },
      { q:'Anoche ___ (ver) una peli buenísima.', a:'vi', opts:['vi','veía'], why:'Completed event with edges.' },
      { q:'___ (llover) cuando salí de casa.', a:'Llovía', opts:['Llovió','Llovía'], why:'Scene running behind the event.' },
      { q:'La ___ (conocer) el año pasado en Madrid.', a:'conocí', opts:['conocí','conocía'], why:'Preterite of conocer = met for the first time.' },
      { q:'Todos los veranos ___ (ir) a la playa.', a:'íbamos', opts:['fuimos','íbamos'], why:'"Todos los veranos" signals a habit.' },
    ],
  },

  {
    id:'perfect', level:'past', title:'Perfect tenses & the Spain habit',
    hook:'Spaniards use the present perfect far more than Latin Americans. "Hoy he comido" where a Mexican says "hoy comí".',
    body:[
      { h:'Present perfect: he + participle', p:'For anything inside a time frame that has not closed: hoy, esta semana, este año, ya, todavía no. This is the default in Spain for today\'s events.' },
      { h:'Pluperfect: había + participle', p:'A past before another past. Cuando llegué, ya se habían ido.' },
      { h:'Irregular participles worth memorising', p:'hecho (hacer), dicho (decir), visto (ver), puesto (poner), vuelto (volver), escrito (escribir), abierto (abrir), roto (romper), muerto (morir).' },
      { h:'The give-away', p:'Saying "hoy fui al gimnasio" in Madrid is understood but marks you. "Hoy he ido al gimnasio" is what you want.' },
    ],
    examples:[
      ['Hoy he entrenado hombros.','Today I trained shoulders.','Today has not finished — perfect.'],
      ['Ayer entrené hombros.','Yesterday I trained shoulders.','Yesterday is closed — preterite.'],
      ['Ya he terminado.','I have already finished.',''],
      ['Cuando llegué, ya había empezado.','When I arrived, it had already started.','Pluperfect.'],
    ],
    drills:[
      { q:'Esta semana ___ (ir) al gimnasio cuatro veces.', a:'he ido', opts:['fui','he ido'], why:'This week is still open.' },
      { q:'¿Todavía no ___ (hacer) la compra?', a:'has hecho', opts:['hiciste','has hecho'], why:'"Todavía no" takes the perfect.' },
      { q:'Cuando llamaste, ya ___ (salir) de casa.', a:'había salido', opts:['salí','había salido'], why:'Past before a past.' },
    ],
  },

  /* ========== SUBJUNCTIVE ========== */
  {
    id:'subj-present', level:'subjunctive', title:'Present subjunctive: the triggers',
    hook:'Not a tense — a mood. It marks that something is wanted, doubted, denied or reacted to, rather than stated as fact.',
    body:[
      { h:'How it is formed', p:'Take the yo form of the present, drop the -o, flip the vowel. Hablo → hable. Como → coma. Tengo → tenga. Irregulars follow the yo form, which is why "tengo" gives "tenga" and not "tena".' },
      { h:'The WEIRDO triggers', p:'Wishes (quiero que), Emotion (me alegro de que), Impersonal opinions (es importante que), Recommendations (te recomiendo que), Doubt/denial (no creo que), Ojalá.' },
      { h:'The structural rule', p:'Two different subjects, joined by que, with a trigger in the first clause. "Quiero ir" (same subject, infinitive) vs "Quiero que vayas" (different subject, subjunctive).' },
      { h:'The flip that catches people', p:'"Creo que viene" — indicative, you believe it. "No creo que venga" — subjunctive, you are casting doubt. Negating the belief flips the mood.' },
    ],
    table:{
      head:['','hablar','comer','tener','ir','ser'],
      rows:[['yo','hable','coma','tenga','vaya','sea'],['tú','hables','comas','tengas','vayas','seas'],
            ['él','hable','coma','tenga','vaya','sea'],['nosotros','hablemos','comamos','tengamos','vayamos','seamos'],
            ['vosotros','habléis','comáis','tengáis','vayáis','seáis'],['ellos','hablen','coman','tengan','vayan','sean']],
    },
    examples:[
      ['Quiero que vengas.','I want you to come.','Two subjects + wish.'],
      ['Espero que estés bien.','I hope you are well.','Emotion.'],
      ['No creo que sea buena idea.','I don\'t think it\'s a good idea.','Negated belief.'],
      ['Ojalá haga buen tiempo.','Hopefully the weather is good.','Ojalá always takes subjunctive.'],
    ],
    drills:[
      { q:'Quiero que ___ (venir) a la fiesta.', a:'vengas', opts:['vienes','vengas'], why:'Wish + different subject.' },
      { q:'Creo que ___ (tener) razón.', a:'tienes', opts:['tienes','tengas'], why:'Affirmative belief stays indicative.' },
      { q:'No creo que ___ (ser) verdad.', a:'sea', opts:['es','sea'], why:'Negated belief flips to subjunctive.' },
      { q:'Es importante que ___ (dormir) bien.', a:'duermas', opts:['duermes','duermas'], why:'Impersonal opinion.' },
      { q:'Ojalá no ___ (llover) mañana.', a:'llueva', opts:['llueve','llueva'], why:'Ojalá, always.' },
    ],
  },

  {
    id:'subj-imperfect', level:'subjunctive', title:'Imperfect subjunctive & si clauses',
    hook:'This is the one that makes you sound genuinely educated. Hypotheticals, politeness, and past-tense wanting.',
    body:[
      { h:'Formation', p:'Take the ellos preterite, drop -ron, add -ra endings: hablaron → hablara. Fueron → fuera. Tuvieron → tuviera. There is a second set (-se) that means the same thing and sounds more formal or literary.' },
      { h:'Si clauses — the pattern to burn in', p:'Si + imperfect subjunctive, then conditional. "Si tuviera dinero, me compraría un piso." Never "si tendría" — that is the mistake that instantly marks a learner.' },
      { h:'Sequence of tenses', p:'If the main verb is past, the subjunctive goes past too. "Quería que vinieras" — I wanted you to come.' },
      { h:'Politeness', p:'"Quisiera un café" is softer and more polished than "quiero un café". Worth having in your mouth ready.' },
    ],
    examples:[
      ['Si tuviera más tiempo, aprendería a cocinar.','If I had more time, I would learn to cook.',''],
      ['Me dijo que fuera al médico.','He told me to go to the doctor.','Past reporting.'],
      ['Quisiera reservar una mesa.','I would like to book a table.','Polite register.'],
      ['Como si nada hubiera pasado.','As if nothing had happened.','"Como si" always takes past subjunctive.'],
    ],
    drills:[
      { q:'Si ___ (tener) dinero, viajaría más.', a:'tuviera', opts:['tendría','tuviera'], why:'Si clause takes imperfect subjunctive, never conditional.' },
      { q:'Me pidió que le ___ (ayudar).', a:'ayudara', opts:['ayude','ayudara'], why:'Past main verb pulls the subjunctive into the past.' },
      { q:'Habla como si lo ___ (saber) todo.', a:'supiera', opts:['sabe','supiera'], why:'"Como si" always takes past subjunctive.' },
    ],
  },

  /* ========== SOUNDING NATIVE ========== */
  {
    id:'fillers', level:'fluent', title:'Fillers, softeners & discourse markers',
    hook:'The actual difference between correct Spanish and Spanish that sounds like a person. Grammar gets you understood; these get you accepted.',
    body:[
      { h:'Buying thinking time', p:'o sea (I mean), es que (the thing is), bueno (well), pues (so/well), a ver (let\'s see), en plan (like — very Spain, very common under 40).' },
      { h:'Softening a disagreement', p:'Hombre... (come on), ya, pero... (yeah but), no sé, eh (I dunno though), la verdad es que (honestly).' },
      { h:'Reacting like a Spaniard', p:'¡Qué fuerte! (no way), ¡Vaya! (wow/damn), ¡Anda ya! (get out), Menudo... (what a...), Vale (fine/OK — the workhorse).' },
      { h:'The register trap', p:'Spaniards swear far more casually than Australians expect, and "tío/tía" is used constantly between friends. Matching that register is what makes you sound native rather than polite.' },
    ],
    examples:[
      ['Es que no me apetece, la verdad.','The thing is I don\'t fancy it, honestly.','"Apetecer" is essential and has no clean English equivalent.'],
      ['O sea, que no vienes.','So, you\'re not coming.',''],
      ['Estaba, en plan, muy raro.','He was, like, really weird.','Very Madrid, very under-40.'],
      ['¡Qué fuerte, tío!','No way, mate!',''],
    ],
    drills:[
      { q:'"The thing is, I can\'t" →', a:'Es que no puedo', opts:['Es que no puedo','Está que no puedo'], why:'"Es que" is the standard opener for an excuse.' },
      { q:'"I don\'t feel like going out" →', a:'No me apetece salir', opts:['No me apetece salir','No me gusta salir'], why:'Apetecer is about the mood right now; gustar is about general taste.' },
      { q:'"Wow, no way!" →', a:'¡Qué fuerte!', opts:['¡Qué fuerte!','¡Qué fuerza!'], why:'Fixed expression.' },
    ],
  },

  {
    id:'idioms', level:'fluent', title:'Everyday idiom you will actually hear',
    hook:'Expressions that come up daily in Spain and are almost never taught.',
    body:[
      { h:'Daily life', p:'Me da igual (I don\'t mind), Ni de coña (no chance), Está chupado (it\'s a piece of cake), Me suena (rings a bell), Ya te digo (tell me about it), De puta madre (brilliant — vulgar but extremely common).' },
      { h:'Time and plans', p:'Quedar = to meet up (¿quedamos el jueves?). This verb is everywhere in Spain and never taught properly. Also: echar de menos (to miss), dar una vuelta (go for a wander).' },
      { h:'Frustration', p:'¡Qué rollo! (what a drag), Estoy hasta las narices (I\'ve had it), Me la suda (I couldn\'t care less — crude), Vaya tela (bloody hell).' },
    ],
    examples:[
      ['¿Quedamos a las ocho?','Shall we meet at eight?','The single most useful verb in Spain.'],
      ['Me da igual, elige tú.','I don\'t mind, you choose.',''],
      ['Echo de menos Valencia.','I miss Valencia.',''],
      ['Está chupado, tío.','It\'s dead easy, mate.',''],
    ],
    drills:[
      { q:'"Shall we meet on Friday?" →', a:'¿Quedamos el viernes?', opts:['¿Quedamos el viernes?','¿Encontramos el viernes?'], why:'Quedar is the verb for arranging to meet.' },
      { q:'"I miss Spain" →', a:'Echo de menos España', opts:['Echo de menos España','Pierdo España'], why:'Fixed expression — echar de menos.' },
      { q:'"I couldn\'t care less" (mild) →', a:'Me da igual', opts:['Me da igual','Me da mismo'], why:'"Me da igual" is the neutral version.' },
    ],
  },
];

/* ---------------- conversation scenarios ---------------- */
export const SCENARIOS = [
  { id:'bar',    icon:'food', title:'At the bar',        prompt:'ordering drinks and tapas, chatting with the barman' },
  { id:'gym',    icon:'training', title:'At the gym',        prompt:'asking about equipment, machines, a routine' },
  { id:'piso',   icon:'money', title:'Renting a flat',    prompt:'viewing a piso, asking about the contract and bills' },
  { id:'work',   icon:'note', title:'Work small talk',   prompt:'colleagues chatting before a meeting starts' },
  { id:'friend', icon:'people', title:'Catching up',       prompt:'seeing an old friend after a long time' },
  { id:'doctor', icon:'pill', title:'At the doctor',     prompt:'describing a shoulder injury and symptoms' },
];

export const levelOf = id => LESSONS.find(l => l.id === id)?.level;
export const lessonsIn = level => LESSONS.filter(l => l.level === level);
