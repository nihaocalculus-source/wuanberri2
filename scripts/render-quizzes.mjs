#!/usr/bin/env node
// Wuanberri — quiz page renderer.
//
// Renders multi-question quiz pages from authored JSON:
//   scripts/content/<subject>/quizzes/<unit-slug>.json  (array of questions)
//     each question: { prompt, choices[4], answerIndex, rightExplain, wrongExplain }
//
// Output: quiz-<subject>-<unit-slug>.html (project root).
// Same header/footer as lessons; scoring via assets/quiz.js.
//
// Usage: node scripts/render-quizzes.mjs [--subject calculus]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './generate-lessons.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const CONTENT = path.resolve(__dirname, 'content');

const LABELS = {
  calculus: 'Calculus',
  physics: 'Physics',
  'linear-algebra': 'Linear Algebra',
  'differential-equations': 'Differential Equations',
  'discrete-math': 'Discrete Math',
  statistics: 'Statistics',
};

const args = process.argv.slice(2);
const only = args.includes('--subject') ? args[args.indexOf('--subject') + 1] : null;
if (!fs.existsSync(CONTENT)) {
  console.error(`No content dir at ${CONTENT}`);
  process.exit(1);
}

function renderQuizHTML({ subjectSlug, subjectLabel, unitTitle, unitSlug, questions }) {
  const letters = ['a', 'b', 'c', 'd'];
  const title = `${unitTitle} quiz`;
  const blocks = questions.map((q, i) => {
    const correctLetter = letters[q.answerIndex] || 'a';
    return `
      <div class="lesson-card">
        <h2>Question ${i + 1} of ${questions.length}</h2>
        <p>${escapeHtml(q.prompt)}</p>
        <form class="mcq" data-mcq="${correctLetter}" data-right-explain="${escapeHtml(q.rightExplain)}" data-wrong-explain="${escapeHtml(q.wrongExplain)}">
${q.choices.map((c, j) => `          <button type="button" data-choice="${letters[j]}">${escapeHtml(c)}</button>`).join('\n')}
          <div class="feedback"></div>
        </form>
      </div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Wuanberri ${escapeHtml(subjectLabel)}</title>
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
  <link rel="apple-touch-icon" href="apple-touch-icon.svg" />
  <link rel="manifest" href="site.webmanifest" />
  <meta name="theme-color" content="#c2410c" />
  <meta name="description" content="Five-question quiz on ${escapeHtml(unitTitle)} — Wuanberri ${escapeHtml(subjectLabel)}." />
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
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">Five questions on ${escapeHtml(unitTitle)}. Answer all ${questions.length} to see your score.</p>
      <p id="quiz-score" class="meta" style="font-variant-numeric: tabular-nums">0 of ${questions.length} answered</p>
${blocks}
      <p style="margin-top:24px"><a class="btn btn-ghost" href="calculus.html">Back to all units</a></p>
    </div>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div>
        <a href="index.html" class="brand">Wuanberri.</a>
        <p style="margin-top:8px">hello@wuanberri.app</p>
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
        <ul><li><a href="#">Privacy Notice</a></li><li><a href="#">Terms &amp; Conditions</a></li></ul>
      </div>
      <div class="copy">© 2026 Wuanberri. All rights reserved.</div>
    </div>
  </footer>

  <script src="assets/app.js"></script>
  <script src="assets/quiz.js"></script>
</body>
</html>
`;
}

let written = 0, failed = 0;
for (const subject of fs.readdirSync(CONTENT)) {
  const subjectDir = path.join(CONTENT, subject);
  if (!fs.statSync(subjectDir).isDirectory()) continue;
  if (only && subject !== only) continue;
  const label = LABELS[subject] || subject;
  const quizDir = path.join(subjectDir, 'quizzes');
  if (!fs.existsSync(quizDir)) continue;
  for (const unitFile of fs.readdirSync(quizDir).filter((f) => f.endsWith('.json'))) {
    const unitSlug = unitFile.replace(/\.json$/, '');
    const questions = JSON.parse(fs.readFileSync(path.join(quizDir, unitFile), 'utf-8'));
    if (!Array.isArray(questions) || questions.length === 0) {
      console.error(`  [SKIP] ${subject}/${unitFile}: not a non-empty array`);
      continue;
    }
    // Unit display title: derive from the lessons file (topic list order).
    let unitTitle = unitSlug;
    const lessonsFile = path.join(subjectDir, `${unitSlug}.json`);
    if (fs.existsSync(lessonsFile)) {
      const first = JSON.parse(fs.readFileSync(lessonsFile, 'utf-8'))[0];
      if (first && first.topic) unitTitle = first.topic.split(' and ')[0].split(',')[0];
    }
    try {
      const filename = `quiz-${subject}-${unitSlug}.html`;
      fs.writeFileSync(
        path.join(PROJECT, filename),
        renderQuizHTML({ subjectSlug: subject, subjectLabel: label, unitTitle, unitSlug, questions }),
        'utf-8'
      );
      console.log(`  wrote ${filename} — ${questions.length} questions`);
      written++;
    } catch (e) {
      console.error(`  [FAIL] ${subject}/${unitFile}: ${e.message}`);
      failed++;
    }
  }
}
console.log(`\nDone. Rendered ${written} quiz pages, failed ${failed}.`);
if (failed > 0) process.exit(2);