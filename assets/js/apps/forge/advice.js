/* ============================================================
   Training: ask-the-coach sheet (form checks, swaps, working around a niggle).
   ============================================================ */

import { ask } from '../../core/ai.js';
import { esc, toast, openSheet, closeSheet, sheetVal, bindActions } from '../../core/ui.js';
import { phase } from './state.js';

export async function askAdvice(){
  openSheet(`
    <h2>Ask about training</h2>
    <p class="sub">Form checks, swaps for a machine you don't have, or working around a niggle.</p>
    <textarea class="textarea" id="q" placeholder="e.g. My shoulder clicks on incline press — what should I swap it for?"></textarea>
    <button class="btn btn-primary block" style="margin-top:12px" data-act="go" id="ask-btn">Ask</button>
    <button class="btn btn-ghost block" data-act="close">Close</button>
    <div id="ans" style="margin-top:14px"></div>
  `);

  bindActions(document.querySelector('.sheet'), {
    go: async () => {
      const q = sheetVal('q').trim();
      if (!q){ toast('Type a question'); return; }
      const btn = document.getElementById('ask-btn');
      btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Thinking…`;
      const p = phase();
      try{
        const res = await ask({
          prompt: `You are a strength coach. Your client: 185cm, ~75kg, already lean with visible abs, chasing a swimmer physique (wide delts, wide lats, high upper chest). Lean bulking, 4 days a week, 3 supersets a session, ~40 minutes, fasted in the morning, at Anytime Fitness Jannali.

He is on Phase ${p.phase} (${p.name}): ${p.focus}

Critical constraints you must respect:
- Weak/unstable shoulder AND generalised hypermobility. Passive structures won't protect his joints: avoid deep-stretch overhead loading, behind-the-neck work, deep barbell benching and deep dips. Prefer neutral grips, controlled ROM, dumbbells, cables and machines.
- Distal triceps/elbow pain when pressing. He warms up with high-rep light pushdowns. Avoid hard lockouts and overhead triceps positions.
- Knees cave inward under load.
He cares about how he looks, not what he lifts.

His question: "${q}"

Respond with ONLY this JSON:
{"answer":"2-4 short paragraphs, plain language, specific and practical","swaps":[{"instead":"exercise name","use":"replacement","why":"one line"}]}`,
          offline: () => ({
            answer: 'AI is off right now, so here are the standing rules: if a movement hurts the shoulder, move to a neutral grip and cut the range before you cut the weight. If the elbow is the problem, add a second round of light pushdowns before pressing and stop short of lockout. Anything that loads a deep stretch overhead is the wrong exercise for your joints, no matter how good it is for everyone else.',
            swaps: [
              { instead:'Barbell overhead press', use:'Machine shoulder press', why:'Fixed path, no stabilising demand on an unstable shoulder.' },
              { instead:'Deep barbell bench',     use:'Incline machine press', why:'Stops the shoulder reaching the end range that bothers it.' },
              { instead:'Overhead triceps extension', use:'Cross-body cable pushdown', why:'Long head without the overhead position that flares the elbow.' },
            ],
          }),
        });
        const a = res.data;
        document.getElementById('ans').innerHTML = `
          <div class="card tight sunk">
            <div style="font-size:14.5px;line-height:1.65;white-space:pre-wrap">${esc(a.answer)}</div>
            ${(a.swaps||[]).length ? `<div class="hr"></div>${a.swaps.map(s => `
              <div style="padding:8px 0">
                <div class="tiny" style="color:var(--accent-1);font-weight:700">${esc(s.instead)} → ${esc(s.use)}</div>
                <div class="tiny muted" style="margin-top:2px">${esc(s.why)}</div>
              </div>`).join('')}` : ''}
          </div>`;
      }catch(e){ toast(e.message || 'Could not reach AI'); }
      finally{ btn.disabled = false; btn.textContent = 'Ask'; }
    },
    close: closeSheet,
  });
}

export const actions = { advice: askAdvice };
