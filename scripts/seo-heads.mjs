// Wuanberri — SEO head pass (one-time / idempotent).
//
// For every root-level *.html page:
//   - inserts <link rel="canonical"> (https://wuanberri.com/<page>)
//   - inserts Open Graph tags (og:type, og:site_name, og:title, og:url,
//     og:image, and og:description when the page has a meta description)
//   - app-page exceptions (auth, dashboard, settings) get
//     <meta name="robots" content="noindex"> instead — they're app views,
//     not landing pages.
// - regenerates sitemap.xml from the indexable page list.
//
// Idempotent: a page that already has a canonical link is left untouched.
// JSON-LD on index.html is handled separately (hand-written), not by this.
//
// Usage (PowerShell, from repo root):
//   node scripts/seo-heads.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ORIGIN = 'https://wuanberri.com';
const OG_IMAGE = ORIGIN + '/assets/wuanberri-logo.png';

// App views, not landing pages — noindex them and keep them out of the sitemap.
const NOINDEX = new Set(['auth.html', 'dashboard.html', 'settings.html']);

const htmlFiles = readdirSync(ROOT).filter(
  (f) => f.endsWith('.html') && statSync(join(ROOT, f)).isFile()
);

const indexable = [];
let changed = 0;

for (const file of htmlFiles) {
  const full = join(ROOT, file);
  let src = readFileSync(full, 'utf8');

  // Repair pass (always runs, even on pages that already have canonical):
  // older versions of this script re-escaped already-escaped title/description
  // text, producing "&amp;amp;" and "&amp;#39;" inside og: attributes.
  let ogFixed = false;
  src = src.replace(
    /(<meta property="og:(?:title|description)" content=")([^"]*)(")/g,
    (m, open, value, close) => {
      const fixed = value.replace(/&amp;(amp;|#)/g, '&$1');
      if (fixed !== value) ogFixed = true;
      return open + fixed + close;
    }
  );
  if (ogFixed) {
    writeFileSync(full, src, 'utf8');
    console.log('repaired og entities: ' + file);
  }

  if (/<link\s+rel="canonical"/i.test(src)) {
    console.log('skip (has canonical): ' + file);
    if (!NOINDEX.has(file)) indexable.push(file);
    continue;
  }

  const pageUrl = file === 'index.html' ? ORIGIN + '/' : ORIGIN + '/' + file;

  const titleMatch = src.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Wuanberri';
  const descMatch = src.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/>/i);
  const desc = descMatch ? descMatch[1] : '';

  let insert;
  if (NOINDEX.has(file)) {
    insert = '  <meta name="robots" content="noindex" />\n';
  } else {
    insert =
      '  <link rel="canonical" href="' + pageUrl + '" />\n' +
      '  <meta property="og:type" content="website" />\n' +
      '  <meta property="og:site_name" content="Wuanberri" />\n' +
      '  <meta property="og:title" content="' + title + '" />\n' +
      (desc ? '  <meta property="og:description" content="' + desc + '" />\n' : '') +
      '  <meta property="og:url" content="' + pageUrl + '" />\n' +
      '  <meta property="og:image" content="' + OG_IMAGE + '" />\n';
  }

  // Insert right after the </title> line — every page's head has it.
  const after = src.replace(/(<title>.*?<\/title>\s*\n)/i, '$1' + insert);
  if (after === src) {
    console.log('!! no <title> anchor found in ' + file + ' — skipped');
    continue;
  }
  writeFileSync(full, after, 'utf8');
  changed++;
  console.log('updated: ' + file);

  if (!NOINDEX.has(file)) indexable.push(file);
}

// Sitemap from the indexable list.
const today = new Date().toISOString().slice(0, 10);
const urls = indexable
  .map((f) => {
    const loc = f === 'index.html' ? ORIGIN + '/' : ORIGIN + '/' + f;
    return '  <url><loc>' + loc + '</loc><lastmod>' + today + '</lastmod></url>';
  })
  .sort()
  .join('\n');

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls +
  '\n</urlset>\n';

writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
console.log('');
console.log('pages updated: ' + changed + ', noindex: ' + NOINDEX.size);
console.log('sitemap.xml written with ' + indexable.length + ' urls');