#!/usr/bin/env node
// Wuanberri — lesson content generator
//
// Reads scripts/lessons-manifest.json, calls an LLM with a strict-JSON
// prompt per lesson, and writes HTML files matching the existing
// lesson-calc-demo.html template. Output goes to the project root as
// `lesson-<slug>.html`.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/generate-lessons.mjs --subject calculus
//   node scripts/generate-lessons.mjs --all
//   node scripts/generate-lessons.mjs --dry-run
//
// Cost: ~$0.01 per lesson with gpt-4o-mini. A full 30-lesson subject
// is ~$0.30. All 6 existing subjects is ~$2.
//
// Re-runnable: existing files are skipped unless --force is passed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons-manifest.json'), 'utf-8'));

const args = new Set(process.argv.slice(2));
const targetSubject = process.argv.find((a, i) => process.argv[i - 1] === '--subject');
const all = args.has('--all');
const dry = args.has('--dry-run');
const force = args.has('--force');

const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
const useAnthropic = !!process.env.ANTHROPIC_API_KEY;

const SUBJECT_LABELS = {
  calculus: 'Calculus',
  physics: 'Physics',
  'linear-algebra': 'Linear Algebra',
  'differential-equations': 'Differential Equations',
  'discrete-math': 'Discrete Math',
  statistics: 'Statistics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  'anatomy-physiology': 'Anatomy & Physiology',
  microeconomics: 'Microeconomics',
  macroeconomics: 'Macroeconomics',
  'english-composition': 'English Composition',
};

const SYSTEM_PROMPT = `You are the Wuanberri lesson writer.
You produce structured JSON only — no prose, no markdown fences, no commentary.
The JSON must match this exact shape:
{
  "title": "string (3-6 words, the lesson title)",
  "lede": "string (1 sentence, the punchline)",
  "cards": [
    {
      "heading": "string (1-4 words)",
      "body": "string (1 short paragraph, 2-4 sentences, plain text)",
      "math": "string (optional, a single LaTeX expression, no $...$ delimiters)"
    },
    { "heading": "...", "body": "...", "math": "..." },
    { "heading": "...", "body": "...", "math": "..." }
  ],
  "flashcards": [
    { "glyph": "string (a short LaTeX or math expression, no $...$ delimiters)",
      "meaning": "string (one short line, 5-15 words)",
      "explain": "string (one short paragraph, 20-50 words, plain text)" },
    { "glyph": "...", "meaning": "...", "explain": "..." },
    { "glyph": "...", "meaning": "...", "explain": "..." }
  ],
  "mcq": {
    "prompt": "string (the question, 1-2 sentences)",
    "choices": ["A", "B", "C", "D"],
    "answerIndex": 0,
    "rightExplain": "string (1-2 sentences, why the correct answer is right)",
    "wrongExplain": "string (1-2 sentences, why a wrong answer is wrong)"
  }
}

Rules:
- All math should be plain LaTeX without $ delimiters (e.g. "f'(x) = 2x" not "$f'(x) = 2x$").
- 3 concept cards. 3 flashcards. Exactly 1 MCQ with 4 choices.
- "answerIndex" is 0, 1, 2, or 3.
- Title should be specific (e.g. "Power rule for derivatives", not "Derivatives").
- Don't repeat material from a general intro lesson — go deeper.
- Content should be self-contained and reviewable.
Return ONLY the JSON.`;

async function callLLM(userPrompt) {
  if (useAnthropic) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
    const data = await r.json();
    return data.content[0].text;
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.choices[0].message.content;
}

function parseJSON(raw) {
  let s = raw.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
  return JSON.parse(s.slice(start, end + 1));
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLessonHTML({ subjectSlug, subjectLabel, lesson, quizHref }) {
  const flashcardJson = JSON.stringify(lesson.flashcards.map((c) => ({
    glyph: c.glyph,
    meaning: c.meaning,
    explain: c.explain,
  })));
  const letters = ['a', 'b', 'c', 'd'];
  const correctLetter = letters[lesson.mcq.answerIndex] || 'a';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(lesson.title)} — Wuanberri ${escapeHtml(subjectLabel)}</title>
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
  <link rel="apple-touch-icon" href="apple-touch-icon.svg" />
  <link rel="manifest" href="site.webmanifest" />
  <meta name="theme-color" content="#c2410c" />
  <meta name="description" content="${escapeHtml(lesson.lede)}" />
  <link rel="stylesheet" href="assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a href="index.html" class="brand">Wuanberri.</a>
      <nav class="nav">
        <a href="index.html#why">Why Wuanberri</a>
        <a href="index.html#features">Features</a>
        <a href="index.html#coach">The Coach</a>
        <a href="index.html#pricing">Pricing</a>
        <a href="calculus.html">Calculus</a>
        <a href="physics.html">Physics</a>
        <a href="partners.html">Partners</a>
        <a href="dashboard.html">Dashboard</a>
      </nav>
      <a href="placement.html" class="btn btn-primary">Start free</a>
    </div>
  </header>

  <main>
    <div class="lesson-wrap">
      <a class="back" href="${escapeHtml(subjectSlug)}.html">← Back to ${escapeHtml(subjectLabel)}</a>
      <h1>${escapeHtml(lesson.title)}</h1>
      <p class="lede">${escapeHtml(lesson.lede)}</p>

${lesson.cards.map((c) => `
      <div class="lesson-card">
        <h2>${escapeHtml(c.heading)}</h2>
        <p>${escapeHtml(c.body)}</p>
${c.math ? `        <span class="math">${escapeHtml(c.math)}</span>\n` : ''}      </div>
`).join('')}
      <div class="q-flashcard" data-lesson-flip='${escapeHtml(flashcardJson)}'>
        <p class="hint">Flashcard</p>
        <div class="q" data-flip-glyph>${escapeHtml(lesson.flashcards[0].glyph)}</div>
        <p data-flip-meaning>${escapeHtml(lesson.flashcards[0].meaning)}</p>
        <div class="answer" data-flip-reveal>
          <div class="math" data-flip-explain>${escapeHtml(lesson.flashcards[0].explain)}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" data-flip-toggle>Show explanation</button>
          <button class="btn btn-accent" data-flip-next>Next card</button>
        </div>
      </div>

      <div class="lesson-card">
        <h2>Check your understanding</h2>
        <p>${escapeHtml(lesson.mcq.prompt)}</p>
        <form class="mcq" data-mcq="${correctLetter}" data-right-explain="${escapeHtml(lesson.mcq.rightExplain)}" data-wrong-explain="${escapeHtml(lesson.mcq.wrongExplain)}">
${lesson.mcq.choices.map((c, i) => `          <button type="button" data-choice="${letters[i]}">${escapeHtml(c)}</button>`).join('\n')}
          <div class="feedback"></div>
        </form>
      </div>
${quizHref ? `      <p style="margin-top:24px"><a class="btn btn-accent" href="${quizHref}">Take the unit quiz</a></p>\n` : ''}    </div>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div>
        <a href="index.html" class="brand">Wuanberri.</a>
        <p style="margin-top:8px">info@wuanberri.com</p>
      </div>
      <div>
        <h5>Product</h5>
        <ul>
          <li><a href="index.html#why">Why Wuanberri</a></li>
          <li><a href="index.html#features">Features</a></li>
          <li><a href="index.html#coach">The Coach</a></li>
          <li><a href="index.html#pricing">Pricing</a></li>
          <li><a href="calculus.html">Calculus</a></li>
          <li><a href="physics.html">Physics</a></li>
          <li><a href="linear-algebra.html">Linear Algebra</a></li>
          <li><a href="differential-equations.html">Differential Equations</a></li>
          <li><a href="discrete-math.html">Discrete Math</a></li>
          <li><a href="statistics.html">Statistics</a></li>
          <li><a href="decks.html">AI Decks</a></li>
          <li><a href="practice.html">Quick Practice</a></li>
          <li><a href="library.html">Worked Examples</a></li>
          <li><a href="solve.html">Solve a Problem</a></li>
          <li><a href="plan.html">Study Plan</a></li>
          <li><a href="partners.html">Study Partners</a></li>
          <li><a href="workout.html">Sample Workout</a></li>
        </ul>
      </div>
      <div>
        <h5>Legal</h5>
        <ul><li><a href="privacy.html">Privacy Notice</a></li><li><a href="terms.html">Terms &amp; Conditions</a></li></ul>
      </div>
      <div class="copy">© 2026 Wuanberri. All rights reserved.</div>
    </div>
  </footer>

  <script src="assets/app.js"></script>
</body>
</html>
`;
}

// ---------- Plan generation ----------

function plan(subjectKey, subjectCfg) {
  // Two planning modes:
  // 1. Topic-driven: units with a `topics` array get exactly one lesson per
  //    topic, in book order (curriculum is named, not invented by the LLM).
  // 2. Weight-driven: units without topics keep the old behavior —
  //    distribute `total` lessons across units by weight, min 1 per unit.
  const units = subjectCfg.units;
  const hasTopics = units.some((u) => Array.isArray(u.topics) && u.topics.length);
  const plan = [];
  if (hasTopics) {
    units.forEach((u) => {
      const topics = u.topics || [];
      topics.forEach((t, k) => plan.push({ unit: u.title, ordinal: k + 1, totalInUnit: topics.length, topic: t }));
    });
    return plan;
  }
  const total = subjectCfg.total || units.reduce((a, u) => a + u.weight, 0);
  const totalWeight = units.reduce((a, u) => a + u.weight, 0);
  let assigned = 0;
  units.forEach((u, i) => {
    const isLast = i === units.length - 1;
    const n = isLast ? (total - assigned) : Math.max(1, Math.round((u.weight / totalWeight) * total));
    for (let k = 0; k < n; k++) {
      plan.push({ unit: u.title, ordinal: k + 1, totalInUnit: n });
    }
    assigned += n;
  });
  return plan;
}

async function generateLesson({ subjectKey, subjectLabel, unit, ordinal, totalInUnit, topic }) {
  const ordinalLabel = totalInUnit > 1 ? ` (${ordinal} of ${totalInUnit})` : '';
  const focusLine = topic
    ? `Lesson topic: ${topic}${ordinalLabel}. Use this exact topic. Make the title specific to it.`
    : `Lesson focus: a specific concept within "${unit}" that a college student would study${ordinalLabel}. Make the title specific to that focus, not the unit title.`;
  const userPrompt = `Write a single lesson on the following topic for the Wuanberri ${subjectLabel} course.

Subject: ${subjectLabel}
Unit: ${unit}
${focusLine}
Audience: a first- or second-year undergraduate.
Prerequisite: the student has read the demo lesson for this subject.

Return STRICT JSON matching the schema in the system prompt. No prose, no markdown.`;
  const raw = await callLLM(userPrompt);
  return parseJSON(raw);
}

async function main() {
  if (!apiKey && !dry) {
    console.error('Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your environment.');
    console.error('Example: $env:OPENAI_API_KEY="sk-..."; node scripts/generate-lessons.mjs --subject calculus');
    process.exit(1);
  }
  const allSubjects = { ...MANIFEST.subjects, ...MANIFEST.new_subjects };
  let subjectKeys;
  if (targetSubject) {
    if (!allSubjects[targetSubject]) {
      console.error(`Unknown subject: ${targetSubject}`);
      console.error('Available:', Object.keys(allSubjects).join(', '));
      process.exit(1);
    }
    subjectKeys = [targetSubject];
  } else if (all) {
    subjectKeys = Object.keys(allSubjects);
  } else {
    console.error('Specify --subject <name> or --all');
    console.error('Available subjects:', Object.keys(allSubjects).join(', '));
    process.exit(1);
  }

  let totalWritten = 0, totalSkipped = 0, totalFailed = 0;
  for (const sk of subjectKeys) {
    const cfg = allSubjects[sk];
    const label = SUBJECT_LABELS[sk] || sk;
    const lessons = plan(sk, cfg);
    console.log(`\n[${label}] generating ${lessons.length} lessons`);
    let i = 0;
    for (const l of lessons) {
      i++;
      const slug = `${sk}-${slugify(l.unit)}-${l.ordinal}`;
      const filename = `lesson-${slug}.html`;
      const out = path.join(PROJECT, filename);
      if (!force && fs.existsSync(out)) { totalSkipped++; continue; }
      if (dry) {
        console.log(`  [dry] ${filename} — ${l.topic || l.unit}`);
        continue;
      }
      try {
        const data = await generateLesson({ subjectKey: sk, subjectLabel: label, unit: l.unit, ordinal: l.ordinal, totalInUnit: l.totalInUnit, topic: l.topic });
        fs.writeFileSync(out, renderLessonHTML({ subjectSlug: sk, subjectLabel: label, lesson: data }), 'utf-8');
        console.log(`  [${i}/${lessons.length}] wrote ${filename} — "${data.title}"`);
        totalWritten++;
      } catch (e) {
        console.error(`  [FAIL] ${filename}: ${e.message}`);
        totalFailed++;
        // Don't blow up the whole run for one bad lesson.
      }
      // Throttle to be polite to the API.
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  console.log(`\nDone. Wrote ${totalWritten}, skipped ${totalSkipped}, failed ${totalFailed}.`);
  if (totalFailed > 0) process.exit(2);
}

// Only auto-run when invoked directly (render-lessons.mjs imports this module).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

// Exported for scripts/render-lessons.mjs (offline authoring path).
export { renderLessonHTML, slugify, escapeHtml };
