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

## License

Personal project. All rights reserved.
