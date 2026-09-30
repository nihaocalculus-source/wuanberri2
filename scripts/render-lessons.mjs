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
// Units render in the manifest's unit order (course order), and each
// lesson gets a prev/next pager across the whole subject course.
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
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons-manifest.json'), 'utf-8'));

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
for (const [subject, cfg] of Object.entries({ ...MANIFEST.subjects, ...MANIFEST.new_subjects })) {
  if (only && subject !== only) continue;

  // Course-order sequence: manifest unit order, then lesson order in each unit.
  // Units without authored content are skipped.
  const seq = [];
  for (const u of cfg.units) {
    const unitSlug = u.slug || slugify(u.title);
    const unitFile = path.join(CONTENT, subject, `${unitSlug}.json`);
    if (!fs.existsSync(unitFile)) continue;
    const lessons = JSON.parse(fs.readFileSync(unitFile, 'utf-8'));
    if (!Array.isArray(lessons) || lessons.length === 0) continue;
    for (let i = 1; i <= lessons.length; i++) seq.push({ unitSlug, unitFile, idx: i });
  }
  if (seq.length === 0) {
    console.log(`  [${subject}] no authored units — skipped`);
    continue;
  }

  const label = LABELS[subject] || subject;
  console.log(`\n[${label}] rendering ${seq.length} lessons`);
  for (let i = 0; i < seq.length; i++) {
    const item = seq[i];
    const filename = `lesson-${subject}-${item.unitSlug}-${item.idx}.html`;
    const quizHref = fs.existsSync(path.join(PROJECT, `quiz-${subject}-${item.unitSlug}.html`))
      ? `quiz-${subject}-${item.unitSlug}.html`
      : null;
    const prevHref = i > 0 ? `lesson-${subject}-${seq[i - 1].unitSlug}-${seq[i - 1].idx}.html` : null;
    const nextHref = i < seq.length - 1 ? `lesson-${subject}-${seq[i + 1].unitSlug}-${seq[i + 1].idx}.html` : null;
    try {
      const lesson = JSON.parse(fs.readFileSync(item.unitFile, 'utf-8'))[item.idx - 1];
      fs.writeFileSync(
        path.join(PROJECT, filename),
        renderLessonHTML({ subjectSlug: subject, subjectLabel: label, lesson, quizHref, prevHref, nextHref }),
        'utf-8'
      );
      console.log(`  wrote ${filename} — "${lesson.title}"`);
      written++;
    } catch (e) {
      console.error(`  [FAIL] ${filename}: ${e.message}`);
      failed++;
    }
  }
}
console.log(`\nDone. Rendered ${written}, failed ${failed}.`);
if (failed > 0) process.exit(2);