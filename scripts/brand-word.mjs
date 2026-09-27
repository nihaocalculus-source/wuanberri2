import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let n = 0;
for (const f of readdirSync(".").filter((f) => f.endsWith(".html"))) {
  const p = join(process.cwd(), f);
  let s = readFileSync(p, "utf8");
  const before = s;
  s = s.replaceAll(
    '<img src="assets/wuanberri-logo.png" alt="Wuanberri"></a>',
    '<img src="assets/wuanberri-logo.png" alt="Wuanberri"><span class="brand-word">Wuanberri</span></a>'
  );
  s = s.replaceAll("styles.css?v=20260926a", "styles.css?v=20260926b");
  s = s.replaceAll("app.js?v=20260926a", "app.js?v=20260926b");
  if (s !== before) {
    writeFileSync(p, s);
    n++;
  }
}
console.log(`updated ${n} pages`);