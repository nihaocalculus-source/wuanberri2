import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const V = "v=20260926a";
let n = 0;
for (const f of readdirSync(".").filter((f) => f.endsWith(".html"))) {
  const p = join(process.cwd(), f);
  let s = readFileSync(p, "utf8");
  const before = s;
  s = s.replace('href="assets/styles.css"', `href="assets/styles.css?${V}"`);
  s = s.replace('src="assets/app.js"', `src="assets/app.js?${V}"`);
  if (s !== before) {
    writeFileSync(p, s);
    n++;
  }
}
console.log(`updated ${n} pages`);