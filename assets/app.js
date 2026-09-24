// Wuanberri — interactivity
// No external dependencies. Everything is plain DOM + a tiny keyword router for the coach.

(function () {
  'use strict';

  // ---------- Bootstrap auth (Supabase config + wrapper) ----------
  // app.js is loaded by every page. Pull in the Supabase config and
  // the auth wrapper so the rest of the file can rely on
  // `Store.isAuthed()` being accurate — including the case where
  // Supabase restored a session from localStorage.
  const ensureAuth = () => {
    if (window.Auth) return Promise.resolve();
    return new Promise((resolve) => {
      let pending = 0;
      const done = () => { if (--pending <= 0) resolve(); };
      const load = (src) => {
        // Skip if a script tag for this src is already in the document
        // (auth.html pre-loads them; we don't want to double-execute).
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) { resolve(); return; }
        pending++;
        const s = document.createElement('script');
        s.src = src;
        s.onload = done;
        s.onerror = done;   // local mode if either file is missing
        document.head.appendChild(s);
      };
      load('assets/__SUPABASE_CONFIG__.js');
      // auth-supabase.js depends on the config having been read.
      // It's a tiny file so we just queue it; the script order is
      // preserved by synchronous-append of the script tag.
      load('assets/auth-supabase.js');
      // If neither script loaded (offline, weird CSP), resolve immediately.
      setTimeout(resolve, 50);
    });
  };

  // ---------- Lazy-load chatbox on every page ----------
  // The chatbox lives in its own file so it's easy to iterate. We load
  // it lazily so the FAB doesn't appear before the page's own inline
  // scripts have finished (matters for the landing-page coach upgrade
  // and the dashboard hydration).
  const lazyLoad = (src) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.body.appendChild(s);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => lazyLoad('assets/chatbox.js'));
  } else {
    setTimeout(() => lazyLoad('assets/chatbox.js'), 0);
  }

  // ---------- Hero flashcard: "Explain" reveal + "Next" cycle ----------
  const flashcard = document.querySelector('[data-flashcard]');
  if (flashcard) {
    const glyph = flashcard.querySelector('[data-glyph]');
    const meta = flashcard.querySelector('[data-meta]');
    const meaning = flashcard.querySelector('[data-meaning]');
    const example = flashcard.querySelector('[data-example]');
    const decomp = flashcard.querySelector('[data-decomp]');
    const explainBtn = flashcard.querySelector('[data-explain]');
    const nextBtn = flashcard.querySelector('[data-next]');

    const deck = [
      {
        glyph: 'd/dx',
        meta: 'calculus · derivative operator',
        meaning: 'The derivative — instantaneous rate of change.',
        example: 'Applied to f(x) = x², it returns 2x — the slope of the curve at any point.',
        decomp: '<strong>d</strong> = "an infinitesimal change in" &nbsp;·&nbsp; <strong>dx</strong> = "with respect to x". The whole notation asks: as x moves by an infinitely small amount, by how much does f move?',
      },
      {
        glyph: '∫ f(x) dx',
        meta: 'calculus · integral',
        meaning: 'The integral — accumulate infinitely many tiny pieces.',
        example: '∫ 2x dx = x² + C. The integral inverts the derivative.',
        decomp: '<strong>∫</strong> = elongated S for "sum" &nbsp;·&nbsp; <strong>dx</strong> = "infinitesimal slice of x". You are summing f(x)·dx over a range of x.',
      },
      {
        glyph: 'F = ma',
        meta: 'physics · Newton\'s second law',
        meaning: 'A net force on an object accelerates it proportionally to its mass.',
        example: 'A 2 kg object pushed by 10 N accelerates at 5 m/s².',
        decomp: '<strong>F</strong> = net force (N) &nbsp;·&nbsp; <strong>m</strong> = mass (kg) &nbsp;·&nbsp; <strong>a</strong> = acceleration (m/s²). Rearranged: a = F/m.',
      },
    ];

    let i = 0;
    const render = () => {
      const c = deck[i];
      glyph.textContent = c.glyph;
      meta.textContent = c.meta;
      meaning.textContent = c.meaning;
      example.innerHTML = c.example;
      decomp.innerHTML = c.decomp;
      decomp.classList.remove('show');
    };
    render();

    explainBtn?.addEventListener('click', () => decomp.classList.toggle('show'));
    nextBtn?.addEventListener('click', () => { i = (i + 1) % deck.length; render(); });
  }

  // ---------- Subject profile tabs ----------
  document.querySelectorAll('[data-tabs]').forEach((tabsRoot) => {
    const tabs = tabsRoot.querySelectorAll('.tab');
    const panel = tabsRoot.querySelector('[data-panel]');
    if (!panel) return;
    const data = JSON.parse(tabsRoot.getAttribute('data-tabs'));

    const render = (key) => {
      const entry = data[key];
      if (!entry) return;
      panel.innerHTML = `
        <h4>${entry.title}</h4>
        <p>${entry.note}</p>
        <div class="bars">
          ${entry.bars.map(b => `
            <div class="bar-row">
              <span class="label">${b.label}</span>
              <div class="track"><div class="fill" style="width:${b.pct}%"></div></div>
              <span class="val">${b.pct}</span>
            </div>
          `).join('')}
        </div>
      `;
    };

    tabs.forEach((t) => {
      t.addEventListener('click', () => {
        tabs.forEach(x => x.setAttribute('aria-selected', 'false'));
        t.setAttribute('aria-selected', 'true');
        render(t.dataset.key);
      });
    });
    const initial = tabsRoot.querySelector('.tab[aria-selected="true"]') || tabs[0];
    if (initial) render(initial.dataset.key);
  });

  // ---------- Coach chat (keyword router) ----------
  const chat = document.querySelector('[data-chat]');
  if (chat) {
    const body = chat.querySelector('.chat-body');
    const form = chat.querySelector('form');
    const input = chat.querySelector('input');

    const respond = (text) => {
      const msg = text.toLowerCase().trim();
      let reply;

      if (!msg) {
        reply = "Ask me anything about calculus or physics — try <em>explain derivatives</em> or <em>make me a plan</em>.";
      } else if (/deriv/.test(msg)) {
        reply = "A <strong>derivative</strong> measures how a function changes as its input changes. Geometrically, it's the slope of the tangent line. Formally, <span class='math'>f'(x) = lim<sub>h→0</sub> (f(x+h) − f(x)) / h</span>. Want a worked example?";
      } else if (/integr|antideriv/.test(msg)) {
        reply = "An <strong>integral</strong> accumulates change. The definite integral <span class='math'>∫<sub>a</sub><sup>b</sup> f(x) dx</span> gives the signed area under f from a to b. By the Fundamental Theorem, it's the antiderivative evaluated at the endpoints.";
      } else if (/limit/.test(msg)) {
        reply = "A <strong>limit</strong> asks: what value does a function approach as the input approaches something? <span class='math'>lim<sub>x→2</sub> (x² − 4)/(x − 2) = 4</span> — the function isn't defined at x=2, but it gets arbitrarily close to 4 there.";
      } else if (/newton|force|kinematic|motion/.test(msg)) {
        reply = "<strong>Newton's second law:</strong> <span class='math'>F = ma</span>. For motion along a line, kinematics gives you the SUVAT equations: <span class='math'>v = u + at</span>, <span class='math'>s = ut + ½at²</span>, <span class='math'>v² = u² + 2as</span>.";
      } else if (/energy|work|kinetic|potential/.test(msg)) {
        reply = "<strong>Work–energy theorem:</strong> net work equals change in kinetic energy, <span class='math'>W = ΔKE = ½mv² − ½mu²</span>. <strong>Conservation of energy:</strong> in a closed system, KE + PE = constant.";
      } else if (/plan|study|schedule|roadmap/.test(msg)) {
        reply = "Here's a 4-week starter: <br>1) Limits & continuity · <br>2) Derivatives, rules, chain rule · <br>3) Applications (related rates, optimization) · <br>4) Intro integrals. <br>Want me to drop a deck for unit 1?";
      } else if (/deck|flashcard|cards/.test(msg)) {
        reply = "Opening a deck on that topic now. Each card has an <em>Explain</em> button for the breakdown and a <em>Next</em> button for spaced repetition.";
      } else if (/hello|hi|hey|hola/.test(msg)) {
        reply = "Hey! I'm your study coach. I can see what you're working on and I can act — build a deck, generate practice problems, or sketch a study plan.";
      } else if (/calc/.test(msg)) {
        reply = "Got it — calculus. Are we on limits, derivatives, integrals, or series?";
      } else if (/phys/.test(msg)) {
        reply = "Got it — physics. Mechanics, E&M, thermo, or waves?";
      } else {
        reply = "I'm a demo coach with a small keyword vocabulary. Try <em>explain derivatives</em>, <em>Newton's second law</em>, or <em>make me a plan</em>.";
      }

      const b = document.createElement('div');
      b.className = 'bubble bot';
      b.innerHTML = reply;
      body.appendChild(b);
      body.scrollTop = body.scrollHeight;
    };

    const send = (text) => {
      if (!text.trim()) return;
      const u = document.createElement('div');
      u.className = 'bubble user';
      u.textContent = text;
      body.appendChild(u);
      body.scrollTop = body.scrollHeight;
      input.value = '';
      setTimeout(() => respond(text), 350);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      send(input.value);
    });

    chat.querySelectorAll('[data-chip]').forEach((c) => {
      c.addEventListener('click', () => send(c.textContent));
    });
  }

  // ---------- Lesson page: flashcard + MCQ ----------
  // Each lesson card is parsed and bound independently: a malformed
  // data-lesson-flip attribute on one card must not stop the MCQ handler
  // below (users saw "Check your understanding" go dead across lesson
  // pages because of exactly that coupling).
  document.querySelectorAll('[data-lesson-flip]').forEach((card) => {
    try {
      const reveal = card.querySelector('[data-flip-reveal]');
      const toggle = card.querySelector('[data-flip-toggle]');
      const next = card.querySelector('[data-flip-next]');
      const glyph = card.querySelector('[data-flip-glyph]');
      const meaning = card.querySelector('[data-flip-meaning]');
      const explain = card.querySelector('[data-flip-explain]');

      let deck;
      try {
        deck = JSON.parse(card.getAttribute('data-lesson-flip'));
      } catch (err) {
        console.warn('Wuanberri: bad flashcard data:', err.message);
        return;
      }
      if (!Array.isArray(deck) || !deck.length) return;
      if (!glyph || !meaning || !explain || !reveal || !toggle || !next) return;

      let i = 0;
      const render = () => {
        const c = deck[i];
        glyph.textContent = c.glyph;
        meaning.textContent = c.meaning;
        explain.innerHTML = c.explain;
        reveal.classList.remove('show');
        toggle.textContent = 'Show explanation';
      };
      render();
      toggle.addEventListener('click', () => {
        reveal.classList.toggle('show');
        toggle.textContent = reveal.classList.contains('show') ? 'Hide explanation' : 'Show explanation';
      });
      next.addEventListener('click', () => { i = (i + 1) % deck.length; render(); });
    } catch (err) {
      console.warn('Wuanberri: flashcard failed to bind:', err);
    }
  });

  document.querySelectorAll('[data-mcq]').forEach((form) => {
    const correct = form.getAttribute('data-mcq');
    const buttons = form.querySelectorAll('button[data-choice]');
    const feedback = form.querySelector('[data-feedback], .feedback');
    buttons.forEach((b) => {
      b.addEventListener('click', () => {
        buttons.forEach(x => { x.disabled = true; x.classList.remove('correct', 'wrong'); });
        const isRight = b.dataset.choice === correct;
        b.classList.add(isRight ? 'correct' : 'wrong');
        if (!isRight) {
          buttons.forEach(x => { if (x.dataset.choice === correct) x.classList.add('correct'); });
        }
        feedback.textContent = isRight
          ? 'Correct. ' + (form.dataset.rightExplain || '')
          : 'Not quite. ' + (form.dataset.wrongExplain || '');
      });
    });
  });

  // ---------- Mobile menu toggle ----------
  // Inject the button into the header on small screens if not already present.
  const header = document.querySelector('.site-header .wrap');
  const nav = document.querySelector('.site-header .nav');
  if (header && nav && !header.querySelector('.menu-toggle')) {
    const btn = document.createElement('button');
    btn.className = 'menu-toggle';
    btn.setAttribute('aria-label', 'Toggle menu');
    btn.innerHTML = '<span></span>';
    btn.addEventListener('click', () => nav.classList.toggle('open'));
    // Place the toggle before the primary CTA
    const cta = header.querySelector('.btn-primary, .btn-ghost');
    if (cta) header.insertBefore(btn, cta);
    else header.appendChild(btn);
    // Close on link click (mobile UX)
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  // ---------- Generator links in nav ----------
  // Auto-inject the 5 generator pages into any nav that doesn't already have them.
  if (nav && !nav.querySelector('a[href="decks.html"]')) {
    const gens = [
      { href: 'decks.html',    label: 'Decks' },
      { href: 'practice.html', label: 'Practice' },
      { href: 'library.html',  label: 'Examples' },
      { href: 'solve.html',    label: 'Solve' },
      { href: 'plan.html',     label: 'Plan' },
    ];
    gens.forEach(g => {
      const a = document.createElement('a');
      a.href = g.href;
      a.textContent = g.label;
      // Insert before the Dashboard link, or at the end
      const dash = nav.querySelector('a[href="dashboard.html"]');
      if (dash) nav.insertBefore(a, dash);
      else nav.appendChild(a);
    });
  }

  // ---------- Auth-aware header CTA ----------
  // If signed in: header shows the user's name and a Sign out option.
  // If not signed in: header CTA is "Sign in" instead of "Start free".
  const cta = document.querySelector('.site-header .wrap .btn-primary, .site-header .wrap .btn-ghost');
  if (cta) {
    const isExit = cta.getAttribute('href') === 'index.html' && cta.textContent.trim() === 'Back to home';
    const isSettings = cta.getAttribute('href') === 'settings.html';
    if (!isExit && !isSettings) {
      const user = (window.Store && Store.getUser && Store.getUser()) || null;
      if (user) {
        cta.textContent = `Sign out · ${user.name.split(' ')[0]}`;
        cta.setAttribute('href', '#');
        cta.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('Sign out? Your local progress will be cleared.')) {
            Store.signOut();
            window.location.href = 'index.html';
          }
        });
      }
    }
  }

  // ---------- Auth gate ----------
  // Gated pages redirect to /auth.html if not signed in. We wait for
  // the Supabase auth bootstrap (if any) so a returning user with a
  // restored session doesn't get bounced.
  const gatedPages = ['dashboard.html', 'partners.html', 'workout.html', 'decks.html', 'practice.html', 'library.html', 'solve.html', 'plan.html', 'settings.html'];
  const here = window.location.pathname.split('/').pop() || 'index.html';
  if (gatedPages.includes(here) && window.Store) {
    const decide = () => {
      if (!Store.isAuthed()) window.location.href = 'auth.html';
    };
    if (window.Auth) {
      // Wait one tick for the INITIAL auth-state event to land.
      let resolved = false;
      Auth.onChange(({ event, user }) => {
        if (event === 'INITIAL' && !resolved) { resolved = true; decide(); }
      });
      setTimeout(() => { if (!resolved) { resolved = true; decide(); } }, 800);
    } else {
      // Auth wrapper not loaded yet — bootstrap then decide.
      ensureAuth().then(() => {
        if (window.Auth) {
          let resolved = false;
          Auth.onChange(({ event, user }) => {
            if (event === 'INITIAL' && !resolved) { resolved = true; decide(); }
          });
          setTimeout(() => { if (!resolved) { resolved = true; decide(); } }, 800);
        } else {
          decide();
        }
      });
    }
  }
})();
