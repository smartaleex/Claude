# Alex HQ

Eight tools, one app, on your phone. No build step, no server, no subscription.

| Tool | What it does |
|---|---|
| **Day** | Meds, sleep, mood and the daily anchors, with a summary you can show a doctor. |
| **Food** | Macro tracking for the lean bulk. Photo a label or a plate, or describe what you ate; suggestions are built around what is left in the day. |
| **Training** | The swimmer build: a four-day split that works around an unstable shoulder, a sore triceps tendon and knee valgus. Comeback ramp after a gap, swaps when a machine is busy, progress photos. |
| **Nicotine** | The taper. A daily budget that steps down each week. |
| **People** | Mates roster. Shows who has drifted, drafts the text, suggests something worth doing. |
| **Money** | Budget tracking, plus property scenarios: repayments, strata, stamp duty, what a rate rise does. |
| **Spanish** | Spanish for someone who lived in Spain and has gone rusty. Real grammar explanations, then spaced repetition. |
| **Cryptic** | One cryptic clue a day, with hints, and unlimited machine-made clues that are checked letter by letter before you see them. |

There is also a "Lift me" button for a bad hour, and a brain dump for getting a
thought out of your head in four seconds.

---

## Get it on your phone

**1. Turn on GitHub Pages** — repo → **Settings → Pages**:

> Source: **Deploy from a branch** · Branch: **`gh-pages`** · Folder: **`/ (root)`** → Save

The `gh-pages` branch is created automatically the first time the workflow runs, so if it isn't in
the dropdown yet, let the Action finish once and come back. Your URL will be:

```
https://smartaleex.github.io/Claude/
```

<details>
<summary>Why not the newer "GitHub Actions" Pages source?</summary>

That path deploys through the `github-pages` *environment*, which only accepts deployments from the
repository's default branch unless you add a deployment branch rule. Alex HQ lives on a feature
branch, so it was rejected in ~2 seconds with *"not allowed to deploy to github-pages due to
environment protection rules"* — before the build even ran.

Publishing to a `gh-pages` branch avoids the environment altogether: the workflow just commits
files. Fewer settings to get right, and it works from any branch.
</details>

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

Tests, lint and a code audit are dev tools only (the app itself has no
dependencies):

```bash
npm install
npm test            # unit + headless-browser tests
npm run lint        # catches a missing import before a phone does
npm run audit       # dead exports, duplicates, files that have grown too big
```

---

## Changing the code

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). It has the file map and a
"where do I fix X?" table. The short version: every file does one job, logic that
makes a decision lives in `assets/js/core/` with a unit test, and a screen is a
function that returns HTML.

---

## Notes on the training program

`assets/js/data/workouts.js` carries its reasoning in comments, because the
constraints matter more than the exercise list:

- **Lean bulk, not a cut.** Already lean at 185cm/75kg. The gap to the reference
  physique is shoulder and lat width, not body fat. Target about 83kg.
- **Unstable shoulder.** Passive tissue will not protect the joint at end range, so:
  no deep-stretch overhead loading, nothing behind the neck, no deep barbell bench
  or dips. Neutral grips, controlled range, dumbbells and cables.
- **Distal triceps pain.** Every pressing day opens with high-rep light pushdowns to
  perfuse the tendon. No hard lockouts.
- **Knees and back.** Leg days are built to be back-friendly, and the comeback ramp
  keeps full sets while easing reps and weight after a break.
- **Three 6-week blocks** rotate automatically: Width, Density, Detail.

Stamp duty in Money uses current NSW general rates. Thresholds are indexed
annually, so check them against Revenue NSW before relying on the number for an
actual offer.
