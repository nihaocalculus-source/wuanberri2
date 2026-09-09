#!/usr/bin/env python3
"""Write the 6 new subject hub files with the shared canonical footer.

The new subject hubs (chemistry, biology, anatomy-physiology,
microeconomics, macroeconomics, english-composition) all share the
same footer, header, and meta blocks — only the hero and unit grid
differ. This script emits all 6 files in one pass.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CANONICAL_FOOTER = """  <footer class="site-footer">
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
  </footer>"""

HEADER = """  <header class="site-header">
    <div class="wrap">
      <a href="index.html" class="brand">Wuanberri.</a>
      <nav class="nav">
        <a href="index.html#why">Why Wuanberri</a>
        <a href="index.html#features">Features</a>
        <a href="index.html#coach">The Coach</a>
        <a href="index.html#pricing">Pricing</a>
        <a href="calculus.html">Calculus</a>
        <a href="physics.html">Physics</a>
        <a href="partners.html">Partners</a>
        <a href="dashboard.html">Dashboard</a>
      </nav>
      <a href="placement.html" class="btn btn-primary">Start free</a>
    </div>
  </header>"""


def unit_card(unit_num, tag_label, title, blurb):
    return f'''          <a class="unit" href="lesson-{slug_of(title)}-demo.html">
            <span class="tag">{tag_label}</span>
            <h3>{title}</h3>
            <p>{blurb}</p>
            <span class="meta">1 demo lesson · 8 cards</span>
          </a>'''


# The slug of the demo lesson for each unit. Since we only ship 1 demo
# per new subject, every unit links to the same demo file.
def slug_of(_title):
    return '{SUBJECT_SLUG}'


def render(slug, eyebrow, h1, blurb, units):
    # Each tuple: (tag_label, unit_title, blurb).
    cards_html = '\n'.join(
        unit_card(i, u[0], u[1], u[2]).replace('{SUBJECT_SLUG}', slug)
        for i, u in enumerate(units, 1)
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{eyebrow} — Wuanberri</title>
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
  <link rel="apple-touch-icon" href="apple-touch-icon.svg">
  <link rel="manifest" href="site.webmanifest">
  <meta name="theme-color" content="#c2410c">
  <meta name="description" content="Wuanberri {eyebrow} — {blurb.split('.')[0].lower()}.">
  <link rel="stylesheet" href="assets/styles.css" />
</head>
<body>
{HEADER}

  <main>
    <section class="subject-hero">
      <div class="wrap">
        <span class="eyebrow">{eyebrow}</span>
        <h1>{h1}</h1>
        <p>1 demo lesson today. We're shipping the full unit over the next 6 months.</p>
      </div>
    </section>

    <section>
      <div class="wrap">
        <div class="unit-grid">
{cards_html}
        </div>
      </div>
    </section>
  </main>

{CANONICAL_FOOTER}

  <script src="assets/app.js"></script>
</body>
</html>
"""


# Hub content: (slug, eyebrow, h1, blurb, [(tag_label, unit_title, blurb)*9])
HUBS = [
    ('chemistry', 'Chemistry', 'Atoms to thermodynamics.',
     'Atoms, bonding, thermodynamics, kinetics, and equilibrium.',
     [
       ('Unit 1 · Foundations', 'Atomic structure', 'Protons, neutrons, electrons. Isotopes, ions, electron configurations, and the periodic table’s organization.'),
       ('Unit 2 · Connections', 'Bonding', 'Ionic, covalent, metallic. Lewis structures, VSEPR, polarity, intermolecular forces.'),
       ('Unit 3 · Quantities', 'Stoichiometry', 'Moles, molar mass, balancing equations, limiting reagents, percent yield.'),
       ('Unit 4 · Reactions', 'Reactions', 'Types: synthesis, decomposition, single/double replacement, redox. Net ionic equations.'),
       ('Unit 5 · Phases', 'States of matter', 'Gases (ideal gas law), liquids (phase diagrams), solids (crystal structures).'),
       ('Unit 6 · pH', 'Acids &amp; bases', 'Brønsted-Lowry, pH scale, strong vs weak, buffers, titrations.'),
       ('Unit 7 · Energy', 'Thermodynamics', 'Enthalpy, entropy, Gibbs free energy. Calorimetry, Hess’s law.'),
       ('Unit 8 · Rate', 'Kinetics', 'Rate laws, reaction order, Arrhenius, activation energy, mechanisms.'),
       ('Unit 9 · Balance', 'Equilibrium', 'Le Chatelier’s principle, Keq, Ksp, common-ion effect, solubility.'),
     ]),
    ('biology', 'Biology', 'Cells to ecosystems.',
     'Cells, genetics, evolution, ecology, and bioinformatics.',
     [
       ('Unit 1 · Foundation', 'Cell biology', 'Prokaryotes vs eukaryotes, organelles, membranes, transport.'),
       ('Unit 2 · Inheritance', 'Genetics', 'Mendelian, molecular, population. DNA replication, transcription, translation.'),
       ('Unit 3 · Change', 'Evolution', 'Natural selection, speciation, phylogenetic trees, Hardy-Weinberg.'),
       ('Unit 4 · Systems', 'Ecology', 'Populations, communities, ecosystems, biomes, energy flow.'),
       ('Unit 5 · Ourselves', 'Human biology', 'Major organ systems, homeostasis, immunity.'),
       ('Unit 6 · Small', 'Microbiology', 'Bacteria, viruses, fungi, protists. Pathogens and the microbiome.'),
       ('Unit 7 · Plants', 'Plant biology', 'Photosynthesis, transport, reproduction, hormones.'),
       ('Unit 8 · Molecules', 'Molecular biology', 'Gene regulation, recombinant DNA, CRISPR, biotechnology.'),
       ('Unit 9 · Data', 'Bioinformatics', 'Sequencing, BLAST, alignment, phylogenetics from sequences.'),
     ]),
    ('anatomy-physiology', 'Anatomy &amp; Physiology', 'The body as a system.',
     'Tissues, organs, and the systems that keep you running.',
     [
       ('Unit 1 · Building blocks', 'Tissues', 'Epithelial, connective, muscle, nervous. Histology basics.'),
       ('Unit 2 · Frame', 'Skeletal', 'Bone structure, joints, axial vs appendicular skeleton.'),
       ('Unit 3 · Movement', 'Muscular', 'Skeletal muscle, contraction, muscle types, major groups.'),
       ('Unit 4 · Signals', 'Nervous', 'Neurons, action potentials, CNS/PNS, reflexes, senses.'),
       ('Unit 5 · Hormones', 'Endocrine', 'Glands, hormones, feedback loops, glucose regulation.'),
       ('Unit 6 · Pump', 'Cardiovascular', 'Heart, blood vessels, blood, cardiac cycle, pressure.'),
       ('Unit 7 · Gas exchange', 'Respiratory', 'Lungs, ventilation, gas exchange, O₂/CO₂ transport.'),
       ('Unit 8 · Processing', 'Digestive', 'GI tract, enzymes, absorption, metabolism, liver.'),
       ('Unit 9 · Continuity', 'Reproductive', 'Male/female anatomy, gametogenesis, fertilization, pregnancy.'),
     ]),
    ('microeconomics', 'Microeconomics', 'How individuals and firms choose.',
     'Supply, demand, elasticity, consumer and producer theory.',
     [
       ('Unit 1 · Markets', 'Supply &amp; demand', 'Equilibrium, shifts, surplus, shortage, market clearing.'),
       ('Unit 2 · Sensitivity', 'Elasticity', 'Price, income, cross-price. Total revenue test.'),
       ('Unit 3 · Buyers', 'Consumer theory', 'Utility, indifference curves, budget constraints, demand derivation.'),
       ('Unit 4 · Sellers', 'Producer theory', 'Production functions, costs (fixed/variable/marginal), supply derivation.'),
       ('Unit 5 · Structures', 'Market structures', 'Perfect competition, monopoly, monopolistic competition, oligopoly.'),
       ('Unit 6 · Strategy', 'Game theory', 'Nash equilibrium, dominant strategies, prisoners’ dilemma, sequential games.'),
       ('Unit 7 · Imperfections', 'Market failure', 'Public goods, information asymmetries, equity.'),
       ('Unit 8 · Spillovers', 'Externalities', 'Positive/negative, Pigouvian taxes, Coase theorem.'),
       ('Unit 9 · Across borders', 'Trade', 'Comparative advantage, tariffs, quotas, gains from trade.'),
     ]),
    ('macroeconomics', 'Macroeconomics', 'The economy as a whole.',
     'GDP, inflation, unemployment, fiscal and monetary policy.',
     [
       ('Unit 1 · Output', 'National income', 'GDP, real vs nominal, expenditure approach, income approach.'),
       ('Unit 2 · Prices', 'Inflation', 'CPI, PPI, demand-pull vs cost-push, hyperinflation.'),
       ('Unit 3 · Labor', 'Unemployment', 'Types (frictional, structural, cyclical), natural rate, Phillips curve.'),
       ('Unit 4 · Spending', 'Fiscal policy', 'Government spending, taxation, deficits, debt, multipliers.'),
       ('Unit 5 · Money', 'Monetary policy', 'Central banks, interest rates, money supply, transmission mechanism.'),
       ('Unit 6 · World', 'Open economy', 'Exchange rates, balance of payments, trade balances.'),
       ('Unit 7 · Long run', 'Growth', 'Solow model, productivity, capital accumulation, technology.'),
       ('Unit 8 · Cycles', 'Business cycles', 'Recession, expansion, AD/AS, leading indicators.'),
       ('Unit 9 · Plumbing', 'Financial system', 'Banks, money creation, financial markets, regulation.'),
     ]),
    ('english-composition', 'English Composition', 'Write to think.',
     'Rhetoric, argument, evidence, structure, revision.',
     [
       ('Unit 1 · Context', 'Rhetorical situation', 'Audience, purpose, genre, stance. The rhetorical triangle.'),
       ('Unit 2 · Claim', 'Thesis &amp; argument', 'Forming a defensible claim. Classical and Rogerian argument.'),
       ('Unit 3 · Support', 'Evidence &amp; analysis', 'Using sources, integrating quotes, the "so what?" move.'),
       ('Unit 4 · Shape', 'Structure', 'Paragraphs, transitions, signposting, reverse outlines.'),
       ('Unit 5 · Voice', 'Style', 'Sentence variety, diction, concision, active vs passive.'),
       ('Unit 6 · Polish', 'Revision', 'Macro vs micro edits. Peer review, self-editing checklists.'),
       ('Unit 7 · Sources', 'Research', 'Library databases, source evaluation, lateral reading.'),
       ('Unit 8 · Credit', 'Citation', 'MLA, APA, Chicago. Avoiding plagiarism, quoting vs paraphrasing.'),
       ('Unit 9 · Genre', 'Genres', 'Literary analysis, research paper, personal essay, technical writing.'),
     ]),
]


def main():
    for slug, eyebrow, h1, blurb, units in HUBS:
        out = ROOT / f'{slug}.html'
        # If file already exists (e.g. chemistry.html was written by hand
        # above), skip — keep the hand-written version.
        if out.exists():
            print(f'  [skip] {out.name} (already exists)')
            continue
        html = render(slug, eyebrow, h1, blurb, units)
        out.write_text(html, encoding='utf-8')
        print(f'  [wrote] {out.name}')


if __name__ == '__main__':
    main()
