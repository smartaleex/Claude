/* ============================================================
   foods.js — offline food database + portion parser.
   Australian serves. This is the tier-3 fallback: no network,
   no key, still logs something sane.

   g  = grams in the listed serve (enables "180g chicken" scaling)
   pc = grams per piece      (enables "25 strawberries")
   w  = serves in a whole    (enables "1/2 a pizza")
   ============================================================ */

export const FOOD_DB = [
  // --- protein ---
  { a:['chicken breast','chicken'], n:'Chicken breast (100g)', kcal:165, p:31, c:0, f:4, g:100 },
  { a:['chicken thigh'], n:'Chicken thigh (100g)', kcal:209, p:26, c:0, f:11, g:100 },
  { a:['beef mince','mince'], n:'Beef mince, lean (100g)', kcal:217, p:26, c:0, f:12, g:100 },
  { a:['steak','porterhouse','scotch fillet','eye fillet'], n:'Steak (200g)', kcal:400, p:50, c:0, f:22, g:200 },
  { a:['lamb chop','lamb'], n:'Lamb chop', kcal:180, p:17, c:0, f:12, g:75 },
  { a:['pork','bacon'], n:'Bacon (2 rashers)', kcal:180, p:12, c:0, f:14, g:60 },
  { a:['salmon'], n:'Salmon (150g)', kcal:280, p:31, c:0, f:17, g:150 },
  { a:['tuna'], n:'Tuna (95g tin)', kcal:100, p:22, c:0, f:1, g:95 },
  { a:['prawns','prawn'], n:'Prawns (100g)', kcal:99, p:24, c:0, f:0, g:100, pc:12 },
  { a:['egg','eggs'], n:'Egg', kcal:74, p:6, c:1, f:5, g:50, pc:50 },
  { a:['egg white'], n:'Egg white', kcal:17, p:4, c:0, f:0, g:33, pc:33 },
  { a:['tofu'], n:'Tofu (150g)', kcal:170, p:18, c:4, f:10, g:150 },
  { a:['protein shake','protein scoop','whey','protein powder'], n:'Protein shake (1 scoop)', kcal:120, p:24, c:3, f:2, g:30 },
  { a:['protein bar'], n:'Protein bar', kcal:200, p:20, c:20, f:7, g:60 },
  { a:['greek yoghurt','greek yogurt','yoghurt','yogurt'], n:'Greek yoghurt (200g)', kcal:190, p:20, c:8, f:9, g:200 },
  { a:['cottage cheese'], n:'Cottage cheese (100g)', kcal:98, p:11, c:3, f:4, g:100 },

  // --- carbs ---
  { a:['white rice','brown rice','rice'], n:'Rice (1 cup cooked)', kcal:205, p:4, c:45, f:0, g:158 },
  { a:['pasta','spaghetti','penne'], n:'Pasta (1 cup cooked)', kcal:220, p:8, c:43, f:1, g:140 },
  { a:['potato','potatoes'], n:'Potato (medium)', kcal:130, p:3, c:30, f:0, g:170 },
  { a:['sweet potato','kumara'], n:'Sweet potato (medium)', kcal:112, p:2, c:26, f:0, g:130 },
  { a:['bread','toast'], n:'Bread (1 slice)', kcal:80, p:3, c:14, f:1, g:32, pc:32 },
  { a:['sourdough'], n:'Sourdough (1 slice)', kcal:95, p:4, c:18, f:1, g:40, pc:40 },
  { a:['bagel'], n:'Bagel', kcal:250, p:10, c:48, f:2, g:95 },
  { a:['wrap','tortilla'], n:'Wrap', kcal:180, p:5, c:30, f:4, g:64 },
  { a:['pita','pide'], n:'Pita bread', kcal:165, p:5, c:33, f:1, g:60 },
  { a:['oats','porridge','rolled oats'], n:'Oats (1/2 cup dry)', kcal:150, p:5, c:27, f:3, g:45 },
  { a:['weetbix','weet-bix'], n:'Weet-Bix (1 biscuit)', kcal:54, p:2, c:10, f:0, g:15, pc:15 },
  { a:['muesli','granola'], n:'Muesli (60g)', kcal:250, p:6, c:38, f:8, g:60 },
  { a:['couscous','quinoa'], n:'Quinoa (1 cup cooked)', kcal:222, p:8, c:39, f:4, g:185 },

  // --- fruit & veg ---
  { a:['banana'], n:'Banana', kcal:105, p:1, c:27, f:0, g:118, pc:118 },
  { a:['apple'], n:'Apple', kcal:95, p:0, c:25, f:0, g:180, pc:180 },
  { a:['orange','mandarin'], n:'Orange', kcal:62, p:1, c:15, f:0, g:130, pc:130 },
  { a:['berries','blueberries'], n:'Blueberries (100g)', kcal:57, p:1, c:14, f:0, g:100 },
  { a:['strawberries','strawberry'], n:'Strawberries (100g)', kcal:32, p:1, c:8, f:0, g:100, pc:12 },
  { a:['grapes'], n:'Grapes (100g)', kcal:69, p:1, c:18, f:0, g:100, pc:5 },
  { a:['mango'], n:'Mango', kcal:200, p:3, c:50, f:1, g:340 },
  { a:['avocado','avo'], n:'Avocado (half)', kcal:160, p:2, c:9, f:15, g:100 },
  { a:['broccoli'], n:'Broccoli (1 cup)', kcal:55, p:4, c:11, f:1, g:90 },
  { a:['spinach'], n:'Spinach (100g)', kcal:23, p:3, c:4, f:0, g:100 },
  { a:['salad','garden salad'], n:'Garden salad', kcal:35, p:2, c:6, f:0, g:100 },
  { a:['tomato'], n:'Tomato', kcal:22, p:1, c:5, f:0, g:120, pc:120 },

  // --- fats & dairy ---
  { a:['full cream milk','milk','skim milk'], n:'Milk (1 cup)', kcal:149, p:8, c:12, f:8, g:250 },
  { a:['cheese','cheddar'], n:'Cheese (30g)', kcal:120, p:7, c:0, f:10, g:30 },
  { a:['feta'], n:'Feta (30g)', kcal:75, p:4, c:1, f:6, g:30 },
  { a:['halloumi'], n:'Halloumi (60g)', kcal:190, p:13, c:2, f:15, g:60 },
  { a:['butter'], n:'Butter (1 tsp)', kcal:36, p:0, c:0, f:4, g:5 },
  { a:['olive oil','oil'], n:'Olive oil (1 tbsp)', kcal:119, p:0, c:0, f:14, g:14 },
  { a:['peanut butter','pb'], n:'Peanut butter (1 tbsp)', kcal:95, p:4, c:3, f:8, g:16 },
  { a:['almonds'], n:'Almonds (30g)', kcal:174, p:6, c:6, f:15, g:30, pc:1.2 },
  { a:['cashews'], n:'Cashews (30g)', kcal:165, p:5, c:9, f:13, g:30, pc:1.5 },
  { a:['hummus'], n:'Hummus (2 tbsp)', kcal:70, p:2, c:4, f:5, g:30 },

  // --- meals & takeaway ---
  { a:['gyros','souvlaki','yiros'], n:'Chicken gyros wrap', kcal:550, p:35, c:50, f:22, g:330 },
  { a:['schnitzel','schnitty'], n:'Chicken schnitzel', kcal:400, p:35, c:20, f:20, g:180 },
  { a:['meat pie','pie'], n:'Meat pie', kcal:450, p:17, c:40, f:25, g:180 },
  { a:['sausage roll'], n:'Sausage roll', kcal:380, p:10, c:30, f:25, g:120 },
  { a:['kebab'], n:'Kebab', kcal:600, p:32, c:55, f:26, g:350 },
  { a:['hsp','halal snack pack'], n:'HSP (small)', kcal:1100, p:45, c:95, f:60, g:500 },
  { a:['burrito'], n:'Burrito', kcal:650, p:32, c:70, f:26, g:400 },
  { a:['sushi','sushi roll'], n:'Sushi roll', kcal:200, p:7, c:36, f:3, g:170, pc:170 },
  { a:['poke bowl','poke'], n:'Poke bowl', kcal:600, p:35, c:70, f:18, g:450 },
  { a:['pad thai'], n:'Pad thai', kcal:700, p:25, c:85, f:28, g:400 },
  { a:['butter chicken'], n:'Butter chicken + rice', kcal:850, p:40, c:75, f:42, g:500 },
  { a:['margherita pizza','pizza slice','pizza'], n:'Pizza (1 slice)', kcal:270, p:11, c:33, f:10, g:105, w:8 },
  { a:['burger','cheeseburger'], n:'Cheeseburger', kcal:500, p:26, c:40, f:26, g:220 },
  { a:['big mac'], n:'Big Mac', kcal:493, p:27, c:43, f:24, g:210 },
  { a:['hot chips','chips','fries'], n:'Hot chips (medium)', kcal:430, p:5, c:53, f:21, g:150 },
  { a:['fried rice'], n:'Fried rice', kcal:550, p:15, c:80, f:18, g:400 },

  // --- drinks & treats ---
  { a:['flat white'], n:'Flat white', kcal:120, p:6, c:9, f:6, g:250 },
  { a:['cappuccino','latte','coffee'], n:'Coffee w/ milk', kcal:110, p:6, c:9, f:6, g:250 },
  { a:['long black','espresso','black coffee'], n:'Long black', kcal:5, p:0, c:1, f:0, g:200 },
  { a:['orange juice','juice'], n:'Juice (1 cup)', kcal:112, p:2, c:26, f:0, g:250 },
  { a:['coke','soft drink','pepsi'], n:'Soft drink (can)', kcal:140, p:0, c:35, f:0, g:375 },
  { a:['chocolate','choc bar'], n:'Chocolate bar (45g)', kcal:230, p:3, c:26, f:13, g:45 },
  { a:['ice cream'], n:'Ice cream (2 scoops)', kcal:280, p:5, c:32, f:15, g:130 },
  { a:['biscuit','cookie'], n:'Biscuit', kcal:80, p:1, c:11, f:4, g:18, pc:18 },
  { a:['croissant'], n:'Croissant', kcal:230, p:5, c:26, f:12, g:60 },
  { a:['beer','schooner','pint'], n:'Beer (schooner)', kcal:160, p:2, c:13, f:0, g:425 },
  { a:['wine','pinot','shiraz','sauvignon','sauv blanc','chardonnay','cab sav','merlot','rose','prosecco','champagne'],
    n:'Wine (glass)', kcal:125, p:0, c:4, f:0, g:150 },
  { a:['gin','vodka','whisky','whiskey','rum','tequila'], n:'Spirit (30ml nip)', kcal:65, p:0, c:0, f:0, g:30 },
  { a:['espresso martini'], n:'Espresso martini', kcal:200, p:1, c:16, f:0, g:120 },
  { a:['aperol'], n:'Aperol spritz', kcal:160, p:0, c:16, f:0, g:200 },
];

/** Brands worth a web lookup rather than a guess. */
export const BRANDED = /mcdonald|maccas|kfc|hungry jack|subway|guzman|nando|domino|pizza hut|red rooster|grill'?d|zambrero|boost juice|schnitz|oporto|betty'?s|chargrill|starbucks|gong cha|chatime|soul origin|sumo salad|roll'?d|fishbowl/i;

export const looksBranded = s => BRANDED.test(s || '');

/* ---------------- offline matcher ---------------- */

export function offlineMatch(desc){
  if (!desc) return null;
  const d = ' ' + desc.toLowerCase().replace(/[^a-z0-9\s/']/g, ' ').replace(/\s+/g, ' ') + ' ';
  const found = [];
  const usedNum = new Set();

  for (const item of FOOD_DB){
    if (found.length >= 3) break;
    for (const alias of item.a){
      const idx = d.indexOf(' ' + alias + ' ') !== -1 ? d.indexOf(' ' + alias + ' ') : d.indexOf(' ' + alias);
      if (idx === -1) continue;

      const before = d.slice(0, idx + 1);
      let mult = 1, how = 'typical serve assumed';

      const gM = before.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?\s*(?:of\s*)?$/);
      const nM = before.match(/(?:(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?))\s*(?:x\s*)?((?:[a-z]+\s+){0,2})(?:of\s+)?$/);
      const midWords = nM ? (nM[4] || '') : '';
      const isSize = /(inch|inches|cm|centimetre|foot|ft|litre|liter|ml)\b/.test(midWords);
      const numPos = nM ? before.length - nM[0].length : -1;

      if (gM && item.g){
        mult = (+gM[1]) / item.g;
        how = `${gM[1]}g vs ${item.g}g serve`;
      } else if (nM && !isSize && !usedNum.has(numPos)){
        usedNum.add(numPos);
        if (nM[1] && nM[2]){
          const frac = (+nM[1]) / (+nM[2]);
          if (item.w){ mult = frac * item.w; how = `${nM[1]}/${nM[2]} of a whole = ${Math.round(frac*item.w*10)/10} serves`; }
          else { mult = frac; how = `${nM[1]}/${nM[2]} of a serve`; }
        } else {
          const n = +nM[3];
          if (n > 0 && n < 200){
            if (item.pc && item.g){ mult = n * item.pc / item.g; how = `${n} pieces ≈ ${Math.round(n*item.pc)}g`; }
            else { mult = n; how = `${n} × standard serve`; }
          }
        }
      } else if (/half(?:\s+a)?\s+(?:[a-z]+\s+){0,2}$/.test(before)){
        if (item.w){ mult = item.w/2; how = `half a whole = ${item.w/2} serves`; }
        else { mult = 0.5; how = 'half a serve'; }
      } else if (/handful|some|a few|bit of/.test(before.slice(-14))){
        how = 'handful ≈ 1 serve';
      }

      found.push({
        name: mult !== 1 ? `${item.n} ×${Math.round(mult*10)/10}` : item.n,
        kcal: Math.round(item.kcal*mult),
        p: Math.round(item.p*mult),
        c: Math.round(item.c*mult),
        f: Math.round(item.f*mult),
        reasoning: `Offline database: ${item.n} at ${item.kcal} kcal/serve, ${how}.`,
      });
      break;
    }
  }
  return found.length ? found : null;
}

/* ---------------- offline suggestion engine ----------------
   Greedy fill against the remaining macro gap. Not clever, but it
   never returns nonsense and it works on a train with no signal. */

const SUGGESTIONS = [
  { name:'Greek yoghurt + berries + honey', kcal:330, p:24, c:42, f:7, desc:'Fast, high protein, barely touches your fat budget.' },
  { name:'Two-egg omelette on sourdough',   kcal:420, p:24, c:36, f:19, desc:'Ten minutes, hits protein and carbs together.' },
  { name:'Chicken breast, rice and broccoli', kcal:520, p:45, c:52, f:8, desc:'The reliable one. Big protein, low fat.' },
  { name:'Protein shake + banana + PB',     kcal:420, p:29, c:38, f:14, desc:'When you need calories and cannot be bothered cooking.' },
  { name:'Tuna, avo and rice bowl',         kcal:560, p:32, c:50, f:22, desc:'Good fats, no cooking beyond the rice.' },
  { name:'Souvlaki with extra chicken',     kcal:640, p:45, c:52, f:24, desc:'Takeaway that still respects the protein target.' },
  { name:'Steak with potato and salad',     kcal:680, p:55, c:38, f:32, desc:'Big dinner when you are well behind on calories.' },
  { name:'Cottage cheese, oats and honey',  kcal:380, p:26, c:48, f:8, desc:'Slow protein before bed, easy on the stomach.' },
  { name:'Salmon, quinoa and greens',       kcal:610, p:40, c:44, f:28, desc:'Fat-heavy — use it when fat is the gap, not protein.' },
  { name:'Two Weet-Bix with full cream milk', kcal:260, p:11, c:34, f:9, desc:'Small gap filler, five seconds of effort.' },
];

export function offlineSuggest({ kcal, p, c, f }){
  const scored = SUGGESTIONS.map(s => {
    // Penalise overshoot harder than undershoot — going over is worse
    // than leaving a little on the table on a lean bulk.
    const over = Math.max(0, s.kcal - kcal) * 1.6;
    const pFit = Math.abs(s.p - Math.min(p, s.p)) * 2;
    const gap  = Math.abs(kcal - s.kcal) * 0.4;
    return { ...s, score: over + pFit + gap - Math.min(s.p, p) * 3 };
  }).sort((a,b) => a.score - b.score);

  return scored.slice(0,3).map(s => ({
    name: s.name, desc: s.desc, kcal: s.kcal, p: s.p, c: s.c, f: s.f,
  }));
}
