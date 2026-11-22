/* ============================================================
   Shell: the "free AI" sheet. Paste a Gemini key, test it, or let the app
   find a model with free quota. Tiers and calls live in core/ai.js.
   ============================================================ */

import { aiSettings, setKey, testKey, discoverModels } from '../core/ai.js';
import { esc, toast, openSheet, closeSheet, sheetVal, bindActions } from '../core/ui.js';
import { rerender } from './router.js';

export function openAISetup(){
  const s = aiSettings();
  openSheet(`
    <h2>Free AI, no tokens</h2>
    <p class="sub">Google's Gemini free tier runs the smart features. No card, no cost.</p>

    <div class="card tight sunk" style="margin-bottom:16px">
      <ol style="margin:0;padding-left:19px;font-size:14px;line-height:1.85;color:var(--ink-2)">
        <li>Open <b>aistudio.google.com/apikey</b></li>
        <li>Sign in with any Google account</li>
        <li>Tap <b>Create API key</b></li>
        <li>Copy it and paste below</li>
      </ol>
    </div>

    <a class="btn btn-plain block" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
      Open Google AI Studio ↗
    </a>

    <label class="label" style="margin-top:18px">Your key</label>
    <input class="input" id="gk" type="password" autocomplete="off" spellcheck="false"
           placeholder="Paste your key" value="${esc(s.geminiKey||'')}">
    <div class="tiny muted" style="margin-top:8px">
      Paste whatever AI Studio gives you — keys start with <b>AQ.</b> or <b>AIza</b> depending on
      when they were made, and both work. Hit Test if you want to be sure.
    </div>
    <div class="tiny muted" style="margin-top:6px">
      Stored only in this browser. Sent to Google when you use an AI feature, and nowhere else.
    </div>

    <div class="grid2" style="margin-top:14px;gap:8px">
      <button class="btn btn-plain" data-act="test" id="test-btn">Test it</button>
      <button class="btn btn-plain" data-act="discover" id="disc-btn">Find a model</button>
    </div>
    <div class="tiny muted" style="margin-top:8px">
      Getting "quota" errors on the first try? That means the model has no free allowance on your
      Google project. <b>Find a model</b> checks each one and picks a working one.
    </div>
    <div id="test-out"></div>

    <button class="btn btn-primary block" style="margin-top:10px" data-act="save">Save key</button>
    ${s.geminiKey ? `<button class="btn btn-ghost block" data-act="clear">Remove key</button>` : ''}
    <button class="btn btn-ghost block" data-act="close">Cancel</button>
  `);

  const showResult = r => {
    const out = document.getElementById('test-out');
    if (out) out.innerHTML = `
      <div class="card tight sunk" style="margin-top:10px;
           background:${r.ok ? 'var(--good-tint)' : 'var(--bad-tint)'};border-color:transparent">
        <div class="tiny" style="color:${r.ok ? 'var(--good)' : 'var(--bad)'};line-height:1.55">
          ${r.ok ? '✓ ' : ''}${esc(r.message)}
        </div>
      </div>`;
  };

  bindActions(document.querySelector('.sheet'), {
    test: async () => {
      const k = sheetVal('gk').trim();
      if (!k){ toast('Paste a key first'); return; }
      const btn = document.getElementById('test-btn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spin dark"></span>`;
      setKey(k);                       // so the working model gets remembered
      showResult(await testKey(k));
      btn.disabled = false;
      btn.textContent = 'Test it';
    },

    discover: async () => {
      const k = sheetVal('gk').trim();
      if (!k){ toast('Paste a key first'); return; }
      const btn = document.getElementById('disc-btn');
      btn.disabled = true;
      btn.innerHTML = `<span class="spin dark"></span>`;
      const out = document.getElementById('test-out');
      try{
        setKey(k);
        const { results, picked } = await discoverModels(k);
        out.innerHTML = `
          <div class="card tight sunk" style="margin-top:10px;">
            <div class="tiny" style="font-weight:700;margin-bottom:8px;color:${picked?'var(--good)':'var(--bad)'}">
              ${picked ? `✓ Using ${esc(picked)}` : 'No model has free quota right now'}
            </div>
            ${results.map(r => `
              <div class="spread" style="padding:5px 0">
                <span class="tiny mono" style="opacity:${r.ok?1:.55}">${esc(r.model)}</span>
                <span class="tiny" style="color:${r.ok?'var(--good)':'var(--muted)'}">${esc(r.note)}</span>
              </div>`).join('')}
            ${!picked ? `<div class="tiny muted" style="margin-top:8px;line-height:1.55">
              Free quota resets at midnight US Pacific. Everything except photo analysis and
              open-ended text keeps working in the meantime.</div>` : ''}
          </div>`;
      }catch(e){
        showResult({ ok:false, message:e.message });
      }finally{
        btn.disabled = false;
        btn.textContent = 'Find a model';
      }
    },
    // Never block on format — Google is the authority on whether a
    // credential works, not a regex here.
    save: () => {
      const k = sheetVal('gk').trim();
      setKey(k);
      closeSheet();
      toast(k ? 'Key saved ✓' : 'Key removed');
      rerender();
    },
    clear: () => { setKey(''); closeSheet(); toast('Key removed'); rerender(); },
    close: closeSheet,
  });
}
