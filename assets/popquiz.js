// Wuanberri — pop quiz modal
// Opens a 5-question MCQ quiz in a modal overlay. Topics are derived
// from the user's review history (or the placement test if no reviews
// yet). The score and per-question correctness are recorded via
// Store.addReview so the dashboard's "Accuracy (7d)" stat reflects
// what the user actually got right.

(function (global) {
  'use strict';

  if (!global.Store || !global.Generators || !global.LLM) return;

  // ---------- Topic selection ----------

  const pickTopics = () => {
    const reviews = Store.getReviews() || [];
    const placement = Store.getPlacement();

    // Build a per-subject accuracy map from the last 7 days of reviews.
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const subjectStats = {};
    reviews.forEach((r) => {
      if (!r || !r.subject || !r.at) return;
      const t = new Date(r.at).getTime();
      if (!Number.isFinite(t) || t < sevenDaysAgo) return;
      const s = subjectStats[r.subject] || { correct: 0, total: 0 };
      s.total += 1;
      if (r.wasCorrect) s.correct += 1;
      subjectStats[r.subject] = s;
    });

    // If we have review data, return the 2 subjects with the lowest
    // accuracy. If accuracy is tied, fall back to the one with the
    // most total reviews (most signal).
    const ranked = Object.keys(subjectStats).map((subj) => ({
      subject: subj,
      acc: subjectStats[subj].correct / Math.max(1, subjectStats[subj].total),
      n: subjectStats[subj].total,
    })).sort((a, b) => a.acc - b.acc || b.n - a.n);

    if (ranked.length >= 2) return [ranked[0].subject, ranked[1].subject];
    if (ranked.length === 1) return [ranked[0].subject, 'calculus'];

    // No review data — use the placement's strongest skills as a proxy
    // for "what the user is studying."
    if (placement && placement.scores) {
      const sorted = Object.keys(placement.scores).sort((a, b) => (placement.scores[b] || 0) - (placement.scores[a] || 0));
      return sorted.slice(0, 2);
    }

    return ['calculus', 'physics'];
  };

  // ---------- DOM ----------

  let modal, card, dotsEl, promptEl, choicesEl, feedbackEl, progressEl, actionBtn;

  const ensureDom = () => {
    if (modal) return;

    modal = document.createElement('div');
    modal.className = 'pop-quiz-modal';
    modal.innerHTML = `
      <div class="pop-quiz-card">
        <div class="pop-quiz-progress" data-popquiz-progress></div>
        <p class="pop-quiz-prompt" data-popquiz-prompt>Loading…</p>
        <div class="pop-quiz-choices" data-popquiz-choices></div>
        <div class="pop-quiz-feedback" data-popquiz-feedback></div>
        <div class="pop-quiz-foot">
          <span class="progress-text" data-popquiz-progress-text></span>
          <button class="btn btn-accent" data-popquiz-action disabled>Next</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    dotsEl = modal.querySelector('[data-popquiz-progress]');
    promptEl = modal.querySelector('[data-popquiz-prompt]');
    choicesEl = modal.querySelector('[data-popquiz-choices]');
    feedbackEl = modal.querySelector('[data-popquiz-feedback]');
    progressEl = modal.querySelector('[data-popquiz-progress-text]');
    actionBtn = modal.querySelector('[data-popquiz-action]');

    // Click on the dark backdrop closes the quiz (only if the user
    // hasn't answered yet — once they're mid-quiz, force an explicit
    // "Finish" or "Close" via the result screen).
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.dataset.state === 'result') closeQuiz();
    });
  };

  // ---------- State ----------

  let state = {
    questions: [],
    current: 0,
    correct: 0,
    answered: false,
  };

  // ---------- Render ----------

  const renderDots = () => {
    dotsEl.innerHTML = state.questions.map((_, i) => {
      const cls = i < state.current ? 'done' : i === state.current ? 'current' : '';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
  };

  const renderQuestion = () => {
    const q = state.questions[state.current];
    if (!q) return;
    state.answered = false;
    feedbackEl.textContent = '';
    progressEl.textContent = `Question ${state.current + 1} of ${state.questions.length}`;
    actionBtn.textContent = state.current === state.questions.length - 1 ? 'Finish' : 'Next';
    actionBtn.disabled = true;

    promptEl.textContent = q.prompt;
    renderDots();
    choicesEl.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${letters[i]}. ${c}`;
      b.addEventListener('click', () => answer(i, b));
      choicesEl.appendChild(b);
    });
  };

  const renderResult = () => {
    const score = state.correct;
    const total = state.questions.length;
    const pct = Math.round((score / total) * 100);
    let message;
    if (pct === 100) message = 'Perfect run.';
    else if (pct >= 80) message = 'Strong — a couple of tweaks and you\'re there.';
    else if (pct >= 60) message = 'Solid foundation. Re-read the explanations below.';
    else message = 'Worth another pass. Open a related lesson and try again.';

    promptEl.textContent = `Pop quiz · ${score} of ${total} (${pct}%) — ${message}`;
    choicesEl.innerHTML = '';
    feedbackEl.innerHTML = state.questions.map((q, i) => `
      <div style="margin:6px 0;padding:8px 10px;border-radius:var(--radius-sm);background:${q.wasCorrect ? '#e7f6ec' : '#fbe9e6'};font-size:13px;line-height:1.4">
        <strong>${i + 1}. ${q.prompt}</strong><br>
        ${q.explain}
      </div>
    `).join('');
    progressEl.textContent = '';
    actionBtn.textContent = 'Close';
    actionBtn.disabled = false;
    dotsEl.innerHTML = '';
    modal.dataset.state = 'result';
  };

  // ---------- Interactions ----------

  const answer = (idx, btn) => {
    if (state.answered) return;
    state.answered = true;
    const q = state.questions[state.current];
    const correctIdx = q.answerIndex;
    const isRight = idx === correctIdx;
    q.wasCorrect = isRight;
    if (isRight) state.correct += 1;

    // Mark buttons
    const buttons = choicesEl.querySelectorAll('button');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correctIdx) b.classList.add('correct');
      if (i === idx && !isRight) b.classList.add('wrong');
    });

    feedbackEl.textContent = isRight ? 'Correct.' : 'Not quite. ' + (q.explain || '');
    feedbackEl.style.color = isRight ? '#2f7a3e' : '#7a2a1f';
    actionBtn.disabled = false;

    // Log to Store for the dashboard accuracy stat.
    const subject = q._topic || 'pop-quiz';
    try { Store.addReview(subject, isRight); } catch (e) {}

    // Auto-advance after a short pause.
    setTimeout(() => {
      if (state.answered) {
        actionBtn.focus();
      }
    }, 50);
  };

  const next = () => {
    if (!state.answered && state.current < state.questions.length) return;
    state.current += 1;
    if (state.current >= state.questions.length) {
      renderResult();
    } else {
      renderQuestion();
    }
  };

  const closeQuiz = () => {
    modal.classList.remove('open');
    modal.dataset.state = '';
  };

  // ---------- Public open ----------

  const open = async () => {
    if (!LLM.activeProvider()) {
      const ok = confirm('Pop quiz needs an LLM key. Open Settings to add one?');
      if (ok) window.location.href = 'settings.html';
      return;
    }

    ensureDom();
    modal.classList.add('open');
    modal.dataset.state = 'loading';
    state = { questions: [], current: 0, correct: 0, answered: false };

    const topics = pickTopics();
    promptEl.textContent = `Generating a pop quiz on ${topics.join(' & '}…`;
    choicesEl.innerHTML = '';
    feedbackEl.textContent = '';
    progressEl.textContent = '';
    actionBtn.disabled = true;
    actionBtn.textContent = 'Loading…';
    dotsEl.innerHTML = '';

    try {
      const result = await Generators.generatePopQuiz({ topics, count: 5, difficulty: 'medium' });
      if (!result || !result.quiz || !Array.isArray(result.quiz.questions) || !result.quiz.questions.length) {
        throw new Error('No questions returned.');
      }
      // Tag each question with its dominant subject so addReview has a tag.
      state.questions = result.quiz.questions.map((q, i) => ({
        ...q,
        _topic: topics[Math.min(i, topics.length - 1)] || 'pop-quiz',
      }));
      modal.dataset.state = 'playing';
      renderQuestion();
    } catch (e) {
      modal.dataset.state = 'result';
      promptEl.textContent = 'Pop quiz could not be generated.';
      feedbackEl.textContent = e && e.message ? e.message : 'Unknown error. Please try again.';
      actionBtn.textContent = 'Close';
      actionBtn.disabled = false;
    }
  };

  // ---------- Mount ----------

  const mount = () => {
    // Bind every "data-popquiz-open" button on the page.
    document.querySelectorAll('[data-popquiz-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.preventDefault(); open(); });
    });

    // Also expose a global helper so any page can call window.PopQuiz.open().
    global.PopQuiz = { open, close: closeQuiz };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // Wire the action button + ESC once DOM is built.
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-popquiz-action]')) {
      const m = document.querySelector('.pop-quiz-modal');
      if (!m) return;
      if (m.dataset.state === 'result') { closeQuiz(); return; }
      next();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = document.querySelector('.pop-quiz-modal');
      if (m && m.classList.contains('open') && m.dataset.state === 'result') closeQuiz();
    }
  });
})(window);
