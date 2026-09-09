#!/usr/bin/env python3
# verify-content.py — programmatic check that every lesson, flashcard, quiz,
# and internal link on the site is real and wired. Exit 0 = everything valid.
#
# Checks:
#   A. Site-wide hygiene: no fake email remnants, no dead "#" links
#      (auth.html footToggle is an allowed exception), all lesson/quiz
#      hrefs on hubs resolve to files on disk.
#   B. Every calculus lesson page: data-lesson-flip JSON parses, exactly
#      3 flashcards (glyph/meaning/explain non-empty), 1 MCQ with a valid
#      letter + 4 choices + explain attrs.
#   C. Every quiz page: 5 .mcq forms with valid letters, #quiz-score
#      present, quiz.js loaded, "Question i of 5" headers present.
#   D. Content JSON <-> rendered pages agree (counts + filenames).

import glob
import html
import json
import os
import re
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT)

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def check_lessons():
    """Lesson pages: flashcard JSON + MCQ structure."""
    lesson_files = sorted(glob.glob("lesson-calculus-*.html"))
    json_files = sorted(
        os.path.join("scripts", "content", "calculus", f)
        for f in os.listdir(os.path.join("scripts", "content", "calculus"))
        if f.endswith(".json")
    )
    if len(json_files) != 9:
        err(f"expected 9 calculus content files, found {len(json_files)}")
        return

    expected = {}
    for jf in json_files:
        slug = os.path.splitext(os.path.basename(jf))[0]
        with open(jf, encoding="utf-8") as f:
            lessons = json.load(f)
        expected[slug] = lessons
        for i, lesson in enumerate(lessons, 1):
            fn = f"lesson-calculus-{slug}-{i}.html"
            if not os.path.exists(fn):
                err(f"missing lesson page {fn}")
                continue
            with open(fn, encoding="utf-8") as f:
                page = f.read()

            m = re.search(r"data-lesson-flip='([^']*)'", page)
            if not m:
                err(f"{fn}: no data-lesson-flip")
                continue
            try:
                cards = json.loads(html.unescape(m.group(1)))
            except json.JSONDecodeError as e:
                err(f"{fn}: flashcard JSON does not parse: {e}")
                continue
            if len(cards) != 3:
                err(f"{fn}: expected 3 flashcards, got {len(cards)}")
            for idx, c in enumerate(cards, 1):
                for key in ("glyph", "meaning", "explain"):
                    if not str(c.get(key, "")).strip():
                        err(f"{fn}: flashcard {idx} missing {key}")

            mcq = re.search(r'<form class="mcq" data-mcq="([a-d])"', page)
            if not mcq:
                err(f"{fn}: no valid data-mcq letter")
            choices = re.findall(r'data-choice="([a-d])"', page)
            if len(choices) != 4 or set(choices) != {"a", "b", "c", "d"}:
                err(f"{fn}: MCQ choices wrong ({choices})")
            if "data-right-explain" not in page or "data-wrong-explain" not in page:
                err(f"{fn}: missing explain attributes")

            if f"quiz-calculus-{slug}.html" not in page:
                warnings.append(f"{fn}: no quiz CTA (quiz page missing?)")
            title_ok = re.search(r"<title>([^<]+)</title>", page)
            if not title_ok:
                err(f"{fn}: no <title>")

    # Every rendered lesson file accounted for?
    rendered = {
        os.path.basename(p) for p in glob.glob("lesson-calculus-*.html")
    }
    expected_names = {
        f"lesson-calculus-{slug}-{i}.html"
        for slug, lessons in expected.items()
        for i in range(1, len(lessons) + 1)
    }
    extra = rendered - expected_names
    if extra:
        err(f"lesson pages on disk with no JSON source: {sorted(extra)}")


def check_quizzes():
    """Quiz pages: 5 MCQ forms, score element, quiz.js, headers."""
    qdir = os.path.join("scripts", "content", "calculus", "quizzes")
    qfiles = sorted(f for f in os.listdir(qdir) if f.endswith(".json"))
    if len(qfiles) != 9:
        err(f"expected 9 quiz JSON files, found {len(qfiles)}")
        return

    for qf in qfiles:
        slug = os.path.splitext(qf)[0]
        with open(os.path.join(qdir, qf), encoding="utf-8") as f:
            questions = json.load(f)
        fn = f"quiz-calculus-{slug}.html"
        if not os.path.exists(fn):
            err(f"missing quiz page {fn}")
            continue
        with open(fn, encoding="utf-8") as f:
            page = f.read()

        forms = re.findall(r'<form class="mcq" data-mcq="([a-d])"', page)
        if len(forms) != len(questions):
            err(f"{fn}: {len(forms)} MCQ forms but {len(questions)} questions in JSON")
        if len(set(re.findall(r"<h3>(Question \d+ of \d+)</h3>", page))) != len(questions):
            # header format is <h3>Question i of N</h3> inside .mcq block
            if len(re.findall(r"Question \d+ of \d+", page)) < len(questions):
                err(f"{fn}: missing per-question headers")

        if 'id="quiz-score"' not in page:
            err(f"{fn}: no #quiz-score element")
        if 'src="assets/quiz.js"' not in page:
            err(f"{fn}: quiz.js not loaded")

        # Each question must have exactly 4 choices and explain attrs.
        for i, q in enumerate(questions, 1):
            for key in ("prompt", "choices", "answerIndex", "rightExplain", "wrongExplain"):
                if key not in q:
                    err(f"{qf} Q{i}: missing {key}")
            if not isinstance(q.get("choices"), list) or len(q["choices"]) != 4:
                err(f"{qf} Q{i}: choices != 4")
            if q.get("answerIndex") not in (0, 1, 2, 3):
                err(f"{qf} Q{i}: answerIndex out of range")


def check_site_hygiene():
    """Fake email remnants, dead links, and hub link resolution."""
    html_files = sorted(glob.glob("*.html"))
    for f in html_files:
        with open(f, encoding="utf-8") as fh:
            page = fh.read()
        if "wuanberri.app" in page:
            err(f"{f}: still contains fake email domain wuanberri.app")
        for m in re.finditer(r'href="#"', page):
            line = page[: m.start()].count("\n") + 1
            # auth.html footToggle is a real JS toggle, not a dead link
            if f == "auth.html" and "footToggle" in page[max(0, m.start() - 120): m.start() + 120]:
                continue
            err(f"{f}:{line}: dead href=\"#\" link")

    # Hub unit-card and quiz-strip links must resolve.
    for hub in glob.glob("calculus.html") + sorted(
        f for f in html_files if re.match(r"^[a-z-]+\.html$", os.path.basename(f))
        and os.path.basename(f) not in ("index.html", "auth.html", "dashboard.html",
                                        "placement.html", "settings.html", "workout.html",
                                        "decks.html", "practice.html", "library.html", "solve.html",
                                        "plan.html", "partners.html", "tutor-market.html", "wuanberri-prd.html")
    ):
        with open(hub, encoding="utf-8") as fh:
            page = fh.read()
        for m in re.finditer(r'href="(lesson-[a-z0-9-]+\.html|quiz-[a-z0-9-]+\.html)"', page):
            target = m.group(1)
            if not os.path.exists(target):
                err(f"{os.path.basename(hub)}: links to missing {target}")


def main():
    check_lessons()
    check_quizzes()
    check_site_hygiene()
    print(f"Lessons checked: {len(glob.glob('lesson-calculus-*.html'))}, "
          f"quizzes: {len(glob.glob('quiz-calculus-*.html'))}")
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  ~ {w}")
    if errors:
        print(f"\nFAILED — {len(errors)} problem(s):")
        for e in errors:
            print(f"  X {e}")
        sys.exit(2)
    print("\nPASS — all lessons, flashcards, quizzes, and links verified.")


if __name__ == "__main__":
    main()