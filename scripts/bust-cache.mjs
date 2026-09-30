import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Bump V, then run `bun scripts/bust-cache.mjs` to re-stamp every
// assets/*.js and assets/*.css reference in the root *.html files.
// assets/ is served `Cache-Control: public, max-age=31536000, immutable`,
// so the ?v= query is the only thing that can reach a returning visitor.
const V = "v=20260929c";

// Every versionable file that actually lives under assets/ (flat + one level
// of subdirectories). New asset files are picked up automatically; files in
// assets/ that nothing links to are simply never matched.
const assetNames = new Set();
for (const entry of readdirSync("assets", { withFileTypes: true })) {
  if (entry.isFile() && /\.(js|css)$/.test(entry.name)) assetNames.add(entry.name);
  else if (entry.isDirectory()) {
    for (const sub of readdirSync(join("assets", entry.name))) {
      if (/\.(js|css)$/.test(sub)) assetNames.add(sub);
    }
  }
}

// src="assets/x.js" / href="assets/x.css", with or without an existing ?v=.
const REF = /(<(?:script|link)\b[^>]*?(?:src|href)=")(assets\/[^"'>]+\.(?:js|css))(\?v=[A-Za-z0-9]+)?(")/g;

let n = 0;
for (const f of readdirSync(".").filter((f) => f.endsWith(".html"))) {
  const p = join(process.cwd(), f);
  const before = readFileSync(p, "utf8");
  const s = before.replace(REF, (m, pre, url, q, post) => {
    const base = url.split("/").pop();
    if (!assetNames.has(base)) return m;
    return `${pre}${url}?${V}${post}`;
  });
  if (s !== before) {
    writeFileSync(p, s);
    n++;
  }
}
console.log(`updated ${n} pages to ?${V}`);
