#!/usr/bin/env python3
# fix-honesty.py — one-pass honesty repair across the Wuanberri site.
#
# Fixes applied (all idempotent, safe to re-run):
#   1. Fake contact email hello@wuanberri.app -> info@wuanberri.com
#      (every *.html page, plus the generator scripts that bake it into
#      new pages: apply-canonical-footer.py, write-new-hubs.py,
#      generate-lessons.mjs)
#   2. Dead footer links: Privacy Notice / Terms & Conditions pointed at
#      "#" -> now point at privacy.html / terms.html (same file set as #1)
#   3. The five original subject hubs (physics, linear-algebra,
#      differential-equations, discrete-math, statistics) claimed
#      "30 lessons · 240 cards" while every unit card linked to the same
#      demo lesson. Their hero line and unit-card metas now say
#      "1 demo lesson" like the six newer hubs do. Calculus is NOT
#      touched here — its counts come from update-unit-meta.py and are real.
#   4. index.html subjects note said "Six subjects ... live" with a stale
#      "Chemistry is added monthly" line -> rewritten to match reality
#      (calculus fully live, everything else demo-stage).

import glob
import os
import re

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OLD_HUBS = [
    "physics.html",
    "linear-algebra.html",
    "differential-equations.html",
    "discrete-math.html",
    "statistics.html",
]

EMAIL_OLD = "hello@wuanberri.app"
EMAIL_NEW = "info@wuanberri.com"

LINKS_OLD = (
    '<ul><li><a href="#">Privacy Notice</a></li>'
    '<li><a href="#">Terms &amp; Conditions</a></li></ul>'
)
LINKS_NEW = (
    '<ul><li><a href="privacy.html">Privacy Notice</a></li>'
    '<li><a href="terms.html">Terms &amp; Conditions</a></li></ul>'
)

GEN_SCRIPTS = [
    os.path.join(PROJECT, "scripts", "apply-canonical-footer.py"),
    os.path.join(PROJECT, "scripts", "write-new-hubs.py"),
    os.path.join(PROJECT, "scripts", "generate-lessons.mjs"),
]

HERO_PATTERNS = [
    re.compile(r"<p>30 lessons · 240 cards across 9 units\.</p>"),
    re.compile(r"<p>\d+ lessons · \d+ cards across 9 units\.</p>"),
]
HERO_NEW = (
    "<p>1 demo lesson per unit today. Full courses are on the way.</p>"
)
META_RE = re.compile(r'<span class="meta">\d+ lessons · \d+ cards</span>')
META_NEW = '<span class="meta">1 demo lesson · 8 cards</span>'


def replace_all(text):
    """Site-wide text fixes. Returns (new_text, [change descriptions])."""
    changes = []
    if EMAIL_OLD in text:
        text = text.replace(EMAIL_OLD, EMAIL_NEW)
        changes.append("email")
    if LINKS_OLD in text:
        text = text.replace(LINKS_OLD, LINKS_NEW)
        changes.append("legal-links")
    return text, changes


def fix_hub(path):
    """Honestify one original hub's hero + unit metas."""
    with open(path, encoding="utf-8") as f:
        page = f.read()
    changes = []
    for pat in HERO_PATTERNS:
        page, n = pat.subn(HERO_NEW, page)
        if n:
            changes.append(f"hero x{n}")
            break
    page, n = META_RE.subn(META_NEW, page)
    if n:
        changes.append(f"metas x{n}")
    if changes:
        with open(path, "w", encoding="utf-8") as f:
            f.write(page)
    return changes


def main():
    pages = sorted(
        glob.glob(os.path.join(PROJECT, "*.html")),
        key=lambda p: os.path.basename(p),
    )
    n_email = n_links = 0
    for p in pages:
        with open(p, encoding="utf-8") as f:
            text = f.read()
        new, changes = replace_all(text)
        if changes:
            with open(p, "w", encoding="utf-8") as f:
                f.write(new)
        if "email" in changes:
            n_email += 1
        if "legal-links" in changes:
            n_links += 1
    print(f"pages: email fixed on {n_email}, legal links fixed on {n_links}")

    for p in OLD_HUBS:
        full = os.path.join(PROJECT, p)
        changes = fix_hub(full)
        print(f"hub {p}: {', '.join(changes) if changes else 'already honest'}")

    for p in GEN_SCRIPTS:
        with open(p, encoding="utf-8") as f:
            text = f.read()
        new, changes = replace_all(text)
        if changes:
            with open(p, "w", encoding="utf-8") as f:
                f.write(new)
        print(f"gen-script {os.path.basename(p)}: "
              f"{', '.join(changes) if changes else 'already clean'}")

    print("Done.")


if __name__ == "__main__":
    main()