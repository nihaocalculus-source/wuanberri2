// One-shot migration: Subjects dropdown + logo in all page headers.
// Handles CRLF or LF. Idempotent: skips files already migrated.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const NAV_RE = /^[ \t]*<a href="calculus.html">Calculus<\/a>\r?\n[ \t]*<a href="physics.html">Physics<\/a>\r?\n/m;
const BRAND_RE = /<a href="index.html" class="brand">Wuanberri\.<\/a>/g;

const DD_HEAD = `<div class="nav-dd">
          <button class="nav-dd-btn" type="button" aria-haspopup="true" aria-expanded="false">Subjects <span class="nav-dd-caret">&#9662;</span></button>
          <div class="nav-dd-panel" role="menu">`;
const COLS = [
  ["Math", [["algebra.html","Algebra"],["geometry.html","Geometry"],["calculus.html","Calculus"],["linear-algebra.html","Linear Algebra"],["differential-equations.html","Differential Equations"],["discrete-math.html","Discrete Math"],["statistics.html","Statistics"]]],
  ["Science", [["biology.html","Biology"],["chemistry.html","Chemistry"],["physics.html","Physics"],["anatomy-physiology.html","Anatomy &amp; Physiology"]]],
  ["Finance", [["intro-to-business.html","Intro to Business"],["microeconomics.html","Microeconomics"],["macroeconomics.html","Macroeconomics"]]],
  ["English", [["english-composition.html","English Composition"]]],
  ["Engineering", [["electrical-engineering.html","Electrical Engineering"],["statics.html","Statics"]]],
  ["Tools", [["tutor-market.html","Tutor Market"],["decks.html","AI Decks"],["practice.html","Quick Practice"],["library.html","Worked Examples"]]],
];

const DD_TAIL = `          </div>
        </div>`;
const NEW_BRAND = '<a href="index.html" class="brand brand-img"><img src="assets/wuanberri-logo.png" alt="Wuanberri"></a>';

function buildDD() {
  const cols = COLS.map(([title, links]) => {
    const items = links.map(([href, label]) => `              <a href="${href}">${label}</a>`).join("\n");
    return `            <div class="dd-col">\n              <h6>${title}</h6>\n${items}\n            </div>`;
  });
  return DD_HEAD + "\n" + cols.join("\n") + "\n" + DD_TAIL;
}

let migrated = 0;
for (const file of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
  const path = join(ROOT, file);
  let html = readFileSync(path, "utf8");
  if (html.includes("nav-dd")) continue;
  const navMatch = html.match(NAV_RE);
  if (!navMatch || !BRAND_RE.test(html)) {
    console.log(`SKIP ${file}`);
    continue;
  }
  BRAND_RE.lastIndex = 0;
  html = html.replace(NAV_RE, buildDD());
  html = html.replace(BRAND_RE, NEW_BRAND);
  writeFileSync(path, html);
  migrated++;
}
console.log(`migrated ${migrated} files`);
