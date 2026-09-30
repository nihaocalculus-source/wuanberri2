# Wuanberri

> Your personal academic coach for calculus, physics, and the rest of the college-math core.

A static web app that generates AI-powered flashcards, quick practice sets, worked examples, problem solutions, and study plans across the full college-math core. Built as a 1:1 functional analog of [Lemma](https://www.trylemma.io) for STEM.

## What's in it

- **27 pages** of static HTML — no build step
- **Bring-your-own LLM key** — calls go directly from the browser to OpenAI or Anthropic; Wuanberri never sees the key
- **All state is local** — accounts, progress, decks, plans, and library are stored in the browser's `localStorage`
- **Auth, dashboard, adaptive placement, AI tutors, multi-step workouts, 9 demo lessons, 5 generators**

## Local development

You need Python (any 3.x).

```powershell
cd C:\Users\nihao\wuanberri
python -m http.server 8000
```

Open http://localhost:8000/.

## Deploy

The fastest path is Vercel, since the site is pure static.

1. Push this folder to a new GitHub repo
2. Sign in to [vercel.com](https://vercel.com) with GitHub
3. Click "New Project" → import the repo
4. Leave every setting at default (no build command, no output directory)
5. Click **Deploy** — your site will be live at `wuanberri.vercel.app` in about 30 seconds

`vercel.json` is included and configures clean URLs (`.html` is optional in the browser bar) and long-lived caching for the `assets/` directory.

## File layout

```
.
├── index.html              Landing
├── auth.html               Sign up / log in
├── placement.html          5-question adaptive test
├── dashboard.html          Logged-in home
├── calculus.html           Subject hub
├── physics.html            Subject hub
├── linear-algebra.html     Subject hub
├── differential-equations.html  Subject hub
├── discrete-math.html      Subject hub
├── statistics.html         Subject hub
├── partners.html           4 AI tutors
├── workout.html            Multi-step problem
├── decks.html              AI Decks generator
├── practice.html           Quick Practice generator
├── library.html            Worked Examples generator
├── solve.html              Solve a Problem generator
├── plan.html               Study Plan generator
├── settings.html           API key + account settings
├── lesson-*.html           9 demo lessons (calculus, physics, and one per new subject)
├── assets/
│   ├── styles.css          Design system
│   ├── app.js              Flashcards, tabs, coach router, MCQ, mobile menu, auth gate
│   ├── store.js            localStorage wrapper
│   ├── llm.js              OpenAI + Anthropic client
│   └── generators.js       The 5 generators with strict JSON schemas
├── vercel.json             Vercel config
├── package.json            Local dev server config
└── .gitignore
```

## How the LLM works

Every page that calls the model goes through `assets/llm.js`. The user pastes their own OpenAI or Anthropic key in **Settings** — the key is stored only in their browser under `wuanberri:v1.llm.*` and is sent directly from their browser to the provider. Wuanberri's servers never see it.

The 5 generator pages use `assets/generators.js`, which wraps the LLM call in a strict-JSON system prompt and renders the result.

## How auth works

By default Wuanberri runs in **local-only mode**: signup/login writes to your browser's `localStorage` under `wuanberri:v1.user`, and there's no cross-device sync. Useful for trying the app.

To turn on **real auth** backed by a real database:

1. Create a free project at [supabase.com](https://supabase.com) (no card required).
2. In the project dashboard, click **Settings → API** and copy the **Project URL** and **anon public** key.
3. Open `assets/__SUPABASE_CONFIG__.js` in this folder and paste both values into `window.__SUPABASE_URL__` and `window.__SUPABASE_ANON_KEY__`. The file has step-by-step comments and the RLS (Row Level Security) setup you'll need on the `profiles` table.
4. Vendor the Supabase JS library so the deploy stays self-contained:
   ```powershell
   Invoke-WebRequest -Uri "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js" -OutFile "assets/vendor/supabase.min.js"
   ```
5. Save, refresh, and your next signup will create a real account in your Supabase database. Sessions survive across devices.

The auth banner on the signup page shows the current mode (local-only or real auth) so you always know which one is active.

## Square / Google setup

Wuanberri has a "Go Pro" checkout wired to Square, and an optional "Continue with Google" button on the auth page. Both are off by default — the checkout button says "being set up" until Square is configured, and the Google button appears only when its credential is present. This walkthrough runs the setup end-to-end.

### What's safe to commit, and what isn't

| Credential | Type | Where it goes |
|---|---|---|
| Square **payment link URL** (Tier 1) | semi-secret | Vercel env var `SQUARE_CHECKOUT_URL` |
| Square **access token** (`EAAA...`) | SECRET | Vercel env var `SQUARE_ACCESS_TOKEN` |
| Square **location id** (`L...`) | SECRET-ish | Vercel env var `SQUARE_LOCATION_ID` |
| Square **subscription plan id** (`PLAN_...`) | SECRET-ish | Vercel env var `SQUARE_SUBSCRIPTION_PLAN_ID` |
| Square **price** (optional, cents) | config | Vercel env var `SQUARE_PRO_PRICE_CENTS` (default `999` = $9.99) |
| Google **Client ID** (`...apps.googleusercontent.com`) | public | `assets/__GOOGLE_CONFIG__.js` (via setup script) |
| Google **Client secret** | SECRET | Vercel env var `GOOGLE_CLIENT_SECRET` |

### One-time setup

1. **Pick your Square tier.** You only need ONE of these:
   - **Tier 1 — zero API (fastest).** In the Square dashboard: Items → Payment links → Create a link for your Wuanberri Pro subscription plan. Copy the link URL. That's the whole thing — the site hands that URL to buyers.
   - **Tier 2 — full API.** Grabs `SQUARE_ACCESS_TOKEN` (Square dashboard → Developer → Credentials), `SQUARE_LOCATION_ID` (Locations → your store → ID), and `SQUARE_SUBSCRIPTION_PLAN_ID` (Subscriptions → Plans → your Pro plan — use the plan **variation** id, and make sure its price is $9.99/month so it doesn't get overridden).

2. **Set the secret env vars in Vercel** — as **Secret** type, never Config (Config echoes values into the terminal). See `.env.example` for the full checklist. Vercel dashboard: Project → Settings → Environment Variables → "Add New" → paste name + value → type **Secret** → Production → Save.

3. **Add your domain to Google OAuth origins** (if using Google sign-in). console.cloud.google.com → APIs & Services → Credentials → your OAuth client → Authorized JavaScript origins → add `https://YOUR-DOMAIN.vercel.app` and `http://localhost:8000` for dev. The public Client ID goes in `assets/__GOOGLE_CONFIG__.js` via `node scripts/setup-secrets.mjs`.

4. **Redeploy.** Vercel env vars apply to new deploys, not to live code. After step 2, redeploy to pick them up.

### Sanity-check after deploy

- Auth page shows the green "Continue with Google" button (only if Google Client ID is set).
- Clicking "Start 7-day trial" on the pricing section opens Square checkout (only if Square is configured — until then it says "Checkout is being set up", which is the honest fallback).
- Vercel function logs (`vercel.com/dashboard` → your project → Logs → Functions) show no `SQUARE_* not set` errors when you click checkout.

If you ever want to rotate keys, update the Vercel env vars and redeploy.

## Generating lesson content

The hub pages currently show "demo content" for each subject. To populate real lessons for a subject:

1. Get an OpenAI or Anthropic API key (paste it in Settings, or set it in the generator script below).
2. Run the content pipeline:
   ```powershell
   node scripts/generate-lessons.mjs --subject calculus
   ```
   Add `--all` to generate every subject. Output is written to the project root as `lesson-<subject>-<unit>-<n>.html`. Each generated lesson matches the existing `lesson-calc-demo.html` template — same `data-lesson-flip` and `data-mcq` markup, same footer, same header.

   For lessons authored offline (no API key), content JSON lives in `scripts/content/<subject>/<unit>.json` and quizzes in `scripts/content/<subject>/quizzes/<unit>.json`. Render both with:
   ```powershell
   node scripts/render-lessons.mjs
   node scripts/render-quizzes.mjs
   ```
   Then apply the post-processing chain (nav, footer, SEO heads, cache-bust) and verify:
   ```powershell
   node scripts/subjects-nav-swap.mjs
   python scripts/apply-canonical-footer.py
   node scripts/seo-heads.mjs
   node scripts/bust-cache.mjs
   python scripts/verify-content.py
   ```

Approximate cost: 30 lessons × ~$0.01 per lesson ≈ **$0.30 per subject** with gpt-4o-mini. Full coverage (all 6 existing subjects) is ~$2.

## License

Personal project. All rights reserved.

<!-- deploy trigger 2026-08-20 -->

