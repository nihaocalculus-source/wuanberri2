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

## Stripe / Google setup

Wuanberri has a "Go Pro" checkout wired to Stripe, and an optional "Continue with Google" button on the auth page. Both are off by default — the buttons appear only when the relevant public credential is present. This walkthrough runs the setup end-to-end.

### What's safe to commit, and what isn't

| Credential | Type | Where it goes |
|---|---|---|
| Stripe **publishable** key (`pk_test_...` / `pk_live_...`) | public | `assets/__STRIPE_CONFIG__.js` (via setup script) |
| Stripe **secret** key (`sk_...`) | SECRET | Vercel env var `STRIPE_SECRET_KEY` |
| Stripe **price** id (`price_...`) | SECRET-ish | Vercel env var `STRIPE_PRICE_ID` |
| Stripe **webhook** secret (`whsec_...`) | SECRET | Vercel env var `STRIPE_WEBHOOK_SECRET` |
| Google **Client ID** (`...apps.googleusercontent.com`) | public | `assets/__GOOGLE_CONFIG__.js` (via setup script) |
| Google **Client secret** | SECRET | Vercel env var `GOOGLE_CLIENT_SECRET` |

### One-time setup

1. **Run the setup script** to write the public credentials. The script is interactive and refuses to accept anything that looks like a secret key — if you paste your `sk_...` by mistake, it tells you so instead of writing it.
   ```powershell
   node scripts/setup-secrets.mjs
   ```
   It will ask for your Stripe publishable key and your Google Client ID. Press Enter to skip either. To wipe both stubs back to empty, run `node scripts/setup-secrets.mjs --reset`.

2. **Set the secret env vars in Vercel.** See `.env.example` for the full list and the dashboard.stripe.com / console.cloud.google.com paths to grab each one. Vercel dashboard: Project → Settings → Environment Variables → "Add New". Paste the name and value, pick Production (and Preview if you want it there too), Save.

3. **Create the Stripe webhook endpoint** (after your first deploy so you have a URL to point at). Dashboard path: Developers → Webhooks → Add endpoint. URL: `https://YOUR-DOMAIN.vercel.app/api/stripe-webhook`. Events: `checkout.session.completed`, `customer.subscription.deleted`. After saving, click into the endpoint and "Reveal" the signing secret — that's your `STRIPE_WEBHOOK_SECRET`.

4. **Add your domain to Google OAuth origins** (if using Google sign-in). console.cloud.google.com → APIs & Services → Credentials → your OAuth client → Authorized JavaScript origins → add `https://YOUR-DOMAIN.vercel.app` and `http://localhost:8000` for dev.

5. **Redeploy.** Vercel env vars apply to new deploys, not to live code. After step 2, push a commit (or click Redeploy in the dashboard) to pick them up.

### Sanity-check after deploy

- Auth page shows the green "Continue with Google" button (only if Google Client ID is set).
- Clicking "Go Pro" on the pricing section opens Stripe Checkout (only if Stripe is configured).
- Vercel function logs (`vercel.com/dashboard` → your project → Logs → Functions) show no `STRIPE_SECRET_KEY not set` errors when you click checkout.

The setup script validates pasted values — see `scripts/setup-secrets.mjs` for the exact format checks. If you ever want to rotate keys, re-run the script and update the Vercel env vars.

## Generating lesson content

The hub pages currently show "demo content" for each subject. To populate real lessons for a subject:

1. Get an OpenAI or Anthropic API key (paste it in Settings, or set it in the generator script below).
2. Run the content pipeline:
   ```powershell
   node scripts/generate-lessons.mjs --subject calculus
   ```
   Add `--all` to generate every subject. Output is written to `lessons/<subject>/<slug>.html`. Each generated lesson matches the existing `lesson-calc-demo.html` template — same `data-lesson-flip` and `data-mcq` markup, same footer, same header.

Approximate cost: 30 lessons × ~$0.01 per lesson ≈ **$0.30 per subject** with gpt-4o-mini. Full coverage (all 6 existing subjects) is ~$2.

## License

Personal project. All rights reserved.

<!-- deploy trigger 2026-08-20 -->

