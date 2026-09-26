// Build 4 placeholder subject pages from privacy.html skeleton.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const subjects = [
  { file: "algebra.html", name: "Algebra", tag: "From solving for x to functions and graphs." },
  { file: "geometry.html", name: "Geometry", tag: "Angles, triangles, circles, and proofs." },
  { file: "intro-to-business.html", name: "Intro to Business", tag: "How businesses start, run, and grow." },
  { file: "statics.html", name: "Statics", tag: "Forces in equilibrium." },
];

const skeleton = readFileSync(join(ROOT, "privacy.html"), "utf8");
const before = skeleton.slice(0, skeleton.indexOf("<main>") + 6);
const after = skeleton.slice(skeleton.indexOf("</main>"));

for (const s of subjects) {
  let page = before;
  page = page.replace("<title>Privacy Notice — Wuanberri</title>", `<title>${s.name} — Wuanberri</title>`);
  page = page.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="Wuanberri ${s.name} — launching soon. ${s.tag}">`);
  const body = `\n    <section class="subject-hero">
      <div class="wrap">
        <span class="eyebrow">${s.name}</span>
        <h1>${s.name} is coming to Wuanberri.</h1>
        <p>${s.tag} Full lessons, decks, and practice are in the works — Calculus is live today, and ${s.name} lands unit by unit.</p>
      </div>
    </section>
    <section class="section">
      <div class="wrap" style="max-width:720px">
        <p>Want to be first in line when ${s.name} goes live? Start the placement and tell the coach you're here for ${s.name}.</p>
        <a href="placement.html" class="btn btn-accent">Start learning</a>
        <p style="margin-top:18px"><a href="index.html">&larr; Back to home</a></p>
      </div>
    </section>
`;

  page += body + after;
  writeFileSync(join(ROOT, s.file), page);
  console.log(`built ${s.file}`);
}
