#!/usr/bin/env python3
"""Wuanberri — update subject hub unit-card meta to match real lesson counts.

Each of the 6 existing subject hubs currently advertises inflated counts
(sums to ~720 lessons, 4,952 cards across all hubs). After Phase 6 we
have exactly 30 lessons × 8 cards per subject, distributed across 9
units by weight. This script rewrites every `.unit .meta` line to the
honest count.

The script reads each hub's unit titles (in DOM order) and the matching
weights from scripts/lessons-manifest.json, then computes the
`lessons × 8 = cards` meta string for each unit card.

For the 6 new subject hubs that don't exist yet, this script does
nothing for them — they're written by hand in `update-new-hubs.py`.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'scripts' / 'lessons-manifest.json').read_text(encoding='utf-8'))

# Per-subject unit titles in DOM order (must match the hub HTML).
# Pulled by reading the current hub files. If the hub changes these
# titles, update this map (or re-derive from the hub at run time).
HUB_UNIT_TITLES = {
    'calculus': [
        'Limits & continuity',
        'Derivatives',
        'Applied derivatives',
        'Integrals',
        'Integration techniques',
        'Applied integrals',
        'Series & convergence',
        'Multivariable calculus',
        'Differential equations',
    ],
    'physics': [
        'Kinematics',
        "Newton's laws",
        'Work & energy',
        'Momentum',
        'Rotational motion',
        'Gravitation',
        'Oscillations & waves',
        'Thermodynamics',
        'Electricity & magnetism',
    ],
    'linear-algebra': [
        'Vectors & spaces',
        'Systems of equations',
        'Matrix algebra',
        'Determinants',
        'Subspaces & basis',
        'Linear maps',
        'Inner product spaces',
        'Eigenvalues & eigenvectors',
        'Matrix decompositions',
    ],
    'differential-equations': [
        'First-order ODEs',
        'Second-order linear ODEs',
        'Higher-order ODEs',
        'Series solutions',
        'Laplace transforms',
        'Systems of ODEs',
        'Nonlinear systems & stability',
        'Partial differential equations',
        'Numerical methods',
    ],
    'discrete-math': [
        'Logic & proofs',
        'Sets & functions',
        'Induction & recursion',
        'Combinatorics',
        'Probability (discrete)',
        'Graph theory',
        'Trees',
        'Relations',
        'Number theory',
    ],
    'statistics': [
        'Descriptive statistics',
        'Probability foundations',
        'Random variables',
        'Common distributions',
        'Sampling & estimation',
        'Hypothesis testing',
        'Confidence intervals',
        'Linear regression',
        'Bayesian inference',
    ],
}

CARDS_PER_LESSON = 8  # 3 flashcards per lesson = 8 cards in the flashcard stack


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60]


def real_counts(subject_key, units):
    """Count REAL lessons + flashcards from scripts/content/<subject>/<unit-slug>.json.
    Returns [(lessons, cards), ...] per unit, or None when no authored content exists."""
    content = ROOT / 'scripts' / 'content' / subject_key
    if not content.is_dir():
        return None
    counts = []
    for u in units:
        f = content / (slugify(u['title']) + '.json')
        if not f.exists():
            return None
        lessons = json.loads(f.read_text(encoding='utf-8'))
        n = len(lessons)
        cards = sum(len(l.get('flashcards', [])) for l in lessons)
        counts.append((n, cards))
    return counts


def distribute(units, total):
    """Mirror of generate-lessons.mjs plan() — allocate lessons to units by weight."""
    total_weight = sum(u['weight'] for u in units)
    plan = []
    assigned = 0
    for i, u in enumerate(units):
        is_last = i == len(units) - 1
        n = (total - assigned) if is_last else max(1, round((u['weight'] / total_weight) * total))
        plan.append(n)
        assigned += n
    return plan


def meta_string(count):
    if isinstance(count, tuple):
        lessons, cards = count
        return f'{lessons} lesson{"s" if lessons != 1 else ""} · {cards} cards'
    lessons = count
    return f'{lessons} lesson{"s" if lessons != 1 else ""} · {lessons * CARDS_PER_LESSON} cards'


def update_hub(subject_key, hub_path: Path):
    units = MANIFEST['subjects'][subject_key]['units']
    titles = HUB_UNIT_TITLES[subject_key]
    real = real_counts(subject_key, units)
    if real is not None:
        counts = real  # authored content exists — count it, never guess
    else:
        counts = distribute(units, MANIFEST['subjects'][subject_key]['total'])
    if len(counts) != len(titles):
        raise RuntimeError(f'{subject_key}: count({len(counts)}) != titles({len(titles)})')

    html = hub_path.read_text(encoding='utf-8')

    # Repair + replace each unit-card meta line. The hub's 9 unit cards
    # are each `<a class="unit" …> … </a>` blocks. Inside each block,
    # the meta line is always `<span class="meta">…</span>` — the inner
    # well-formed tag. We parse each block, find the `<p>…</p>` boundary,
    # then locate the inner meta span and replace the entire span
    # (including any broken outer wrapper) with a clean line.
    block_re = re.compile(
        r'(<a class="unit" href="lesson-[^"]+">.*?</a>)',
        re.DOTALL,
    )

    blocks = block_re.findall(html)
    if len(blocks) != len(titles):
        raise RuntimeError(
            f'{subject_key}: matched {len(blocks)} unit cards but expected {len(titles)}. '
            f'Hub structure may have changed.'
        )

    def rewrite_block(block, count):
        # Find the </p> closing tag (end of card description).
        p_close = re.search(r'</p>', block)
        if not p_close:
            raise RuntimeError('unit card missing </p>')
        prefix = block[:p_close.end()]
        suffix = block[p_close.end():]
        # Drop everything in `suffix` until the inner `<span class="meta">…</span>`,
        # then replace it with a clean meta line.
        meta_match = re.search(
            r'<span class="meta">([^<]*)</span>',
            suffix,
        )
        if not meta_match:
            raise RuntimeError('unit card missing inner meta span')
        return prefix + '\n            ' + f'<span class="meta">{meta_string(count)}</span>' + suffix[meta_match.end():]

    new_blocks = [rewrite_block(b, c) for b, c in zip(blocks, counts)]
    # Splice the rewritten blocks back into the original document.
    new_html = html
    for old, new in zip(blocks, new_blocks):
        new_html = new_html.replace(old, new, 1)

    # Update the hero subtitle if it claims the old total.
    total_lessons = sum(c[0] if isinstance(c, tuple) else c for c in counts)
    total_cards = sum(c[1] if isinstance(c, tuple) else c * CARDS_PER_LESSON for c in counts)
    new_html = re.sub(
        r'(<h1>[^<]+</h1>\s*<p>)[^<]+(</p>)',
        r'\g<1>' + f'{total_lessons} lessons · {total_cards} cards across 9 units.' + r'\g<2>',
        new_html,
        count=1,
    )

    hub_path.write_text(new_html, encoding='utf-8')
    return list(zip(titles, counts))


def main():
    subjects = MANIFEST['subjects']
    for key in subjects:
        hub = ROOT / subjects[key]['hub']
        if not hub.exists():
            print(f'  [skip] {key}: {hub.name} not found')
            continue
        rows = update_hub(key, hub)
        print(f'  [ok] {key}: unit meta set to {rows}')


if __name__ == '__main__':
    main()
