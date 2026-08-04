# Alex HQ

Six tools, one app, on your phone. No build step, no server, no subscription.

| | Tool | What it does |
|---|---|---|
| 🍳 | **Fuel** | Macro tracking for the lean bulk. Photo a label or a plate, describe what you ate, get suggestions built around the gap left in your day. |
| 💪 | **Forge** | Four-day training split built for a swimmer physique, working around a weak shoulder, hypermobility and a cranky tricep insertion. |
| 💰 | **Ledger** | Budget tracking, plus property scenarios — repayments, strata, stamp duty, and what happens if rates rise 3%. |
| 🍻 | **Shout** | Mates roster. Surfaces who's quietly drifted, drafts the text, suggests something worth doing. |
| 🌱 | **Clear** | Nicotine taper. A daily mg budget that steps down each week. |
| 🇪🇸 | **Vale** | Spanish for someone who lived in Spain and has gone rusty. Real grammar explanations, then spaced repetition. |

---

## Get it on your phone

**1. Turn on GitHub Pages** — repo → Settings → Pages → Source: **GitHub Actions**.

**1b. Allow this branch to deploy.** The `github-pages` environment only accepts deploys from the
repository's *default* branch out of the box, and this app lives on a feature branch — so the first
run fails in about 3 seconds with *"not allowed to deploy to github-pages due to environment
protection rules"*. Fix it once:

> Settings → **Environments** → `github-pages` → **Deployment branches and tags** →
> *Add deployment branch or tag rule* → `claude/*`

Then re-run the failed job. Your URL will be:

```
https://smartaleex.github.io/Claude/
```

**2. Add it to your home screen** — open that URL in Safari, tap Share → *Add to Home Screen*.
It then runs full-screen with no browser chrome, and works offline.

**3. Turn on the AI (2 minutes, free)** — open Settings (⚙ on the home screen) → *Set up free AI*.

---

## About the "free AI without tokens" bit

Worth being straight about this, because it shaped the architecture.

The original `fuelv2.html` called `api.anthropic.com` with **no API key**. That works *only* inside a
Claude artifact, where the runtime proxies the request and bills it to your chat. On a real URL that
call returns 401 — a public web page can't spend Anthropic's money anonymously. There's no
workaround; it's the whole point of the restriction.

So Alex HQ has **three tiers**, and picks the best one available:

| Tier | When | Cost |
|---|---|---|
| **1 · Claude** | Running inside a Claude artifact | Free — billed to the chat, keyless, exactly as before |
| **2 · Gemini** | Running at a real URL (this is the one you'll use) | Free — Google's free tier, no credit card, ~1,500 requests/day |
| **3 · Offline** | No key, or no signal | Free — deterministic local logic |

Tier 3 is not a stub. The food database parses portions (`180g chicken`, `25 strawberries`,
`1/2 pizza`, `half a croissant`), the suggestion engine solves against your remaining macros, and
every lesson, drill, workout and calculation runs with no network at all. You lose photo analysis
and open-ended text, nothing else.

**Getting the Gemini key:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → sign in
→ *Create API key* → paste it into Settings. It's stored in your browser's localStorage and is sent to
Google when you use an AI feature, and nowhere else. No account for Alex HQ exists, because Alex HQ
has no server.

---

## Where your data lives

On your device. There is no backend, no account, no sync. Storage prefers the Claude artifact store,
falls back to `localStorage`, then to memory.

That means: **clearing your browser data wipes it.** Settings → *Download a backup* gives you a JSON
file; *Restore from backup* reads it back. Worth doing occasionally.

---

## Running it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

No dependencies, no build. Edit a file, refresh.

---

## Layout

```
index.html              shell
manifest.webmanifest    home-screen install
sw.js                   offline cache — bump CACHE when deploying
assets/
  css/tokens.css        design tokens: colour, type, elevation, motion
  css/app.css           shared components
  js/main.js            registry, router, tab bar, home dashboard, settings
  js/core/store.js      persistence + date helpers
  js/core/ui.js         view helpers, sheets, toasts, charts
  js/core/ai.js         the three-tier adapter
  js/apps/*.js          the six tools — each exports mount() and summary()
  js/data/foods.js      offline food DB + portion parser
  js/data/workouts.js   the training program and its reasoning
  js/data/spanish.js    the Spanish curriculum
```

Every tool exports `summary()`, which is what the home dashboard reads. Adding a seventh tool means
writing one module and adding one line to `APPS` in `main.js`.

---

## Notes on the training program

`assets/js/data/workouts.js` carries its reasoning in comments, because the constraints matter more
than the exercise list:

- **Lean bulk, not a cut.** Already lean at 185cm/75kg — the gap to the reference physique is
  shoulder and lat *width*, not body fat. Target ~83kg.
- **Hypermobility + unstable shoulder.** Passive tissue won't protect the joint at end range, so:
  no deep-stretch overhead loading, nothing behind the neck, no deep barbell bench or dips.
  Neutral grips, controlled ROM, dumbbells and cables.
- **Tricep insertion pain.** Every pressing day opens with high-rep light pushdowns to perfuse the
  tendon. No hard lockouts.
- **Three 6-week blocks** rotate automatically — Width, Density, Detail.

Stamp duty uses current NSW general rates. Thresholds are indexed annually, so check them against
Revenue NSW before relying on the number for an actual offer.
