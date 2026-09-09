#!/usr/bin/env node
// Wuanberri — offline lesson renderer.
//
// Renders hand-authored (or DA-authored) lesson JSON into the same HTML
// template the LLM generator uses. Lives next to generate-lessons.mjs so
// lessons can be produced WITHOUT an API key.
//
// Content layout:  scripts/content/<subject>/<unit-slug>.json
//   each file = JSON array of lesson objects:
//     { "topic": "...", "title": "...", "lede": "...",
//       "cards": [{heading, body, math?} x3],
//       "flashcards": [{glyph, meaning, explain} x3],
//       "mcq": {prompt, choices[4], answerIndex, rightExplain, wrongExplain} }
//
// Output: project root, lesson-<subject>-<unit-slug>-<ordinal>.html
// (same filenames generate-lessons.mjs writes, so link-units.py works for both).
//
// Usage: node scripts/render-lessons.mjs [--subject calculus]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLessonHTML, slugify } from './generate-lessons.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');
const CONTENT = path.join(__dirname, 'content');

const LABELS = {
  calculus: 'Calculus',
  physics: 'Physics',
  'linear-algebra': 'Linear Algebra',
  'differential-equations': 'Differential Equations',
  'discrete-math': 'Discrete Math',
  statistics: 'Statistics',
};

const only = process.argv.find((a, i) => process.argv[i - 1] === '--subject');
if (!fs.existsSync(CONTENT)) {
  console.error(`No content dir at ${CONTENT}`);
  process.exit(1);
}

let written = 0, failed = 0;
for (const subject of fs.readdirSync(CONTENT)) {
  const subjectDir = path.join(CONTENT, subject);
  if (!fs.statSync(subjectDir).isDirectory()) continue;
  if (only && subject !== only) continue;
  const label = LABELS[subject] || subject;
  for (const unitFile of fs.readdirSync(subjectDir).filter((f) => f.endsWith('.json'))) {
    const unitSlug = unitFile.replace(/\.json$/, '');
    const lessons = JSON.parse(fs.readFileSync(path.join(subjectDir, unitFile), 'utf-8'));
    lessons.forEach((lesson, i) => {
      const filename = `lesson-${subject}-${unitSlug}-${i + 1}.html`;
      const quizHref = fs.existsSync(path.join(PROJECT, `quiz-${subject}-${unitSlug}.html`)) ? `quiz-${subject}-${unitSlug}.html` : null;
      try {
        fs.writeFileSync(
          path.join(PROJECT, filename),
          renderLessonHTML({ subjectSlug: subject, subjectLabel: label, lesson, quizHref }),
          'utf-8'
        );
        console.log(`  wrote ${filename} — "${lesson.title}"`);
        written++;
      } catch (e) {
        console.error(`  [FAIL] ${filename}: ${e.message}`);
        failed++;
      }
    });
  }
}
console.log(`\nDone. Rendered ${written}, failed ${failed}.`);
if (failed > 0) process.exit(2);