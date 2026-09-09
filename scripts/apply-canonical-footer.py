"""Apply the canonical Wuanberri footer to every HTML file in this folder.

This is a one-time consistency pass. Re-run after adding a new page or
a new subject hub to keep the Product list identical across the site.
"""
import os
import re
import sys

CANONICAL_FOOTER = '''  <footer class="site-footer">
    <div class="wrap">
      <div>
        <a href="index.html" class="brand">Wuanberri.</a>
        <p style="margin-top:8px">info@wuanberri.com</p>
      </div>
      <div>
        <h5>Product</h5>
        <ul>
          <li><a href="index.html#why">Why Wuanberri</a></li>
          <li><a href="index.html#features">Features</a></li>
          <li><a href="index.html#coach">The Coach</a></li>
          <li><a href="index.html#pricing">Pricing</a></li>
          <li><a href="calculus.html">Calculus</a></li>
          <li><a href="physics.html">Physics</a></li>
          <li><a href="linear-algebra.html">Linear Algebra</a></li>
          <li><a href="differential-equations.html">Differential Equations</a></li>
          <li><a href="discrete-math.html">Discrete Math</a></li>
          <li><a href="statistics.html">Statistics</a></li>
          <li><a href="chemistry.html">Chemistry</a></li>
          <li><a href="biology.html">Biology</a></li>
          <li><a href="anatomy-physiology.html">Anatomy &amp; Physiology</a></li>
          <li><a href="microeconomics.html">Microeconomics</a></li>
          <li><a href="macroeconomics.html">Macroeconomics</a></li>
          <li><a href="english-composition.html">English Composition</a></li>
          <li><a href="electrical-engineering.html">Electrical Engineering</a></li>
          <li><a href="tutor-market.html">Tutor Market</a></li>
          <li><a href="decks.html">AI Decks</a></li>
          <li><a href="practice.html">Quick Practice</a></li>
          <li><a href="library.html">Worked Examples</a></li>
          <li><a href="solve.html">Solve a Problem</a></li>
          <li><a href="plan.html">Study Plan</a></li>
          <li><a href="partners.html">Study Partners</a></li>
          <li><a href="workout.html">Sample Workout</a></li>
        </ul>
      </div>
      <div>
        <h5>Legal</h5>
        <ul><li><a href="privacy.html">Privacy Notice</a></li><li><a href="terms.html">Terms &amp; Conditions</a></li></ul>
      </div>
      <div class="copy">© 2026 Wuanberri. All rights reserved.</div>
    </div>
  </footer>'''


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    project = os.path.dirname(here)
    files = sorted(f for f in os.listdir(project) if f.endswith('.html'))
    n_replaced = n_added = 0
    for f in files:
        path = os.path.join(project, f)
        with open(path, 'r', encoding='utf-8') as fh:
            s = fh.read()
        if 'class="site-footer"' in s:
            new = re.sub(
                r'  <footer class="site-footer">.*?</footer>',
                CANONICAL_FOOTER,
                s,
                count=1,
                flags=re.DOTALL,
            )
            action = 'REPLACED'
            n_replaced += 1
        else:
            new = s.replace('</body>', CANONICAL_FOOTER + '\n\n</body>')
            action = 'ADDED'
            n_added += 1
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(new)
        print(f'{action:10s} {f}')
    print(f'\nDone. {n_replaced} replaced, {n_added} added.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
