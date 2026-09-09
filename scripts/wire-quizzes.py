#!/usr/bin/env python3
# wire-quizzes.py — re-runnable: inserts a "Unit quizzes" strip into a subject
# hub, between the unit grid and </main>, linking every rendered quiz page.
# Idempotent: strip is delimited by <!-- quiz-strip:start/end --> markers and
# rebuilt in place on re-run.

import json
import os
import re
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(PROJECT, "scripts", "lessons-manifest.json")

with open(MANIFEST, encoding="utf-8") as f:
    manifest = json.load(f)


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def wire(subject_key):
    cfg = {**manifest["subjects"], **manifest.get("new_subjects", {})}[subject_key]
    hub_path = os.path.join(PROJECT, cfg["hub"])
    with open(hub_path, encoding="utf-8") as f:
        page = f.read()

    units = cfg["units"]
    cards = []
    linked = 0
    for i, u in enumerate(units, 1):
        slug = slugify(u["title"])
        quiz_file = f"quiz-{subject_key}-{slug}.html"
        if not os.path.exists(os.path.join(PROJECT, quiz_file)):
            continue
        linked += 1
        cards.append(
            f'        <a class="unit" href="{quiz_file}">\n'
            f'          <span class="tag">UNIT {i} · QUIZ</span>\n'
            f'          <h3>{u["title"]} quiz</h3>\n'
            f'          <p>Five auto-scored questions on {u["title"].lower()}.</p>\n'
            f'          <span class="meta">5 questions · auto-scored</span>\n'
            f'        </a>'
        )

    if not cards:
        print(f"  [{subject_key}] no quiz pages found — nothing to wire")
        return

    strip = (
        "    <!-- quiz-strip:start -->\n"
        '    <section class="wrap" id="unit-quizzes" style="margin-top:56px">\n'
        "      <h2>Unit quizzes</h2>\n"
        f'      <p>Nine auto-scored quizzes — five questions each, one per unit.</p>\n'
        '      <div class="unit-grid">\n'
        + "\n".join(cards) +
        "\n      </div>\n    </section>\n"
        "    <!-- quiz-strip:end -->"
    )

    m = re.search(r"<!-- quiz-strip:start -->.*?<!-- quiz-strip:end -->", page, re.DOTALL)
    if m:
        page = page[:m.start()] + strip + page[m.end():]
        print(f"  [{subject_key}] quiz strip updated ({linked} quizzes)")
    else:
        idx = page.rfind("</main>")
        if idx == -1:
            print(f"  [{subject_key}] SKIP: no </main> found in {cfg['hub']}")
            return
        page = page[:idx] + strip + "\n  " + page[idx:]
        print(f"  [{subject_key}] quiz strip inserted ({linked} quizzes)")

    with open(hub_path, "w", encoding="utf-8") as f:
        f.write(page)


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else "calculus"
    wire(only)
    print("Done.")


if __name__ == "__main__":
    main()