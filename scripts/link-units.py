#!/usr/bin/env python3
# link-units.py — re-runnable hub wiring for Wuanberri.
#
# For each subject hub, points each unit card at the first REAL lesson of
# that unit (lesson-<subject>-<unit-slug>-1.html) once that file exists.
# Until then the card keeps pointing at the subject's demo lesson.
#
# Usage:  python scripts/link-units.py            # all subjects
#         python scripts/link-units.py calculus   # one subject
#
# Reads unit titles + demo slugs from scripts/lessons-manifest.json, so it
# stays in sync with the generator — no duplicated unit lists.

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


def link_subject(subject_key, cfg):
    hub_path = os.path.join(PROJECT, cfg["hub"])
    demo = cfg["demo"]
    with open(hub_path, encoding="utf-8") as f:
        page = f.read()

    # One target per unit card, in unit order: first real lesson if it
    # exists on disk, else the demo.
    targets = []
    linked = 0
    for u in cfg["units"]:
        fn = f"lesson-{subject_key}-{slugify(u['title'])}-1.html"
        if os.path.exists(os.path.join(PROJECT, fn)):
            targets.append(fn)
            linked += 1
        else:
            targets.append(demo)

    it = iter(targets)
    new_page, n = re.subn(
        r'href="' + re.escape(demo) + '"',
        lambda m: f'href="{next(it)}"',
        page,
    )
    if n != len(targets):
        print(f"  [{subject_key}] SKIP: hub has {n} '{demo}' links but {len(targets)} units — not rewriting")
        return False

    if new_page == page:
        print(f"  [{subject_key}] unchanged ({linked}/{len(targets)} units have real lessons)")
        return False

    with open(hub_path, "w", encoding="utf-8") as f:
        f.write(new_page)
    print(f"  [{subject_key}] linked {linked}/{len(targets)} units to real lessons ({n} hrefs rewritten)")
    return True


def main():
    args = sys.argv[1:]
    subjects = {**manifest["subjects"], **manifest.get("new_subjects", {})}
    only = args[0] if args else None
    changed = False
    for key, cfg in subjects.items():
        if only and key != only:
            continue
        hub = os.path.join(PROJECT, cfg["hub"])
        if not os.path.exists(hub):
            print(f"  [{key}] SKIP: hub {cfg['hub']} not found")
            continue
        if link_subject(key, cfg):
            changed = True
    print("Done." + (" Re-apply the canonical footer if hubs changed." if changed else " No changes."))


if __name__ == "__main__":
    main()