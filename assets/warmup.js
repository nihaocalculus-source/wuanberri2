// Wuanberri — daily warm-up
// On dashboard load, check whether the user has already done today's
// warm-up. If not, render a banner with a 3-question quick quiz from
// the user's weakest subjects. On completion (or "Skip for today"),
// record the date so it stays hidden for the rest of the day.

(function (global) {
  'use strict';

  if (!global.Store || !global.Generators) return;

  const today = () => new Date().toISOString().slice(0, 10);
  const KEY = 'warmup';

  const get = () => {
    const w = Store.get(KEY, null);
    if (!w) return { date: null, completed: 0, total: 0, skipped: false };
    return w;
  };
  const set = (w) => Store.set(KEY, w);

  const isDone = () => {
    const w = get();
    return w.date === today() && (w.completed >= w.total || w.skipped);
  };

  // ---------- Topic selection ----------
  // 3 subjects the user is weakest in, based on 7-day review history.
  // Falls back to the placement test's strongest skills, then to calc+phys.
  const pickTopics = () => {
    const reviews = Store.getReviews() || [];
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
    const ranked = Object.keys(subjectStats).map((subj) => ({
      subject: subj,
      acc: subjectStats[subj].correct / Math.max(1, subjectStats[subj].total),
      n: subjectStats[subj].total,
    })).sort((a, b) => a.acc - b.acc || b.n - a.n);
    if (ranked.length >= 3) return ranked.slice(0, 3).map((r) => r.subject);
    if (ranked.length === 2) return [ranked[0].subject, ranked[1].subject, 'calculus'];
    if (ranked.length === 1) return [ranked[0].subject, 'calculus', 'physics'];
    return ['calculus', 'physics', 'linear-algebra'];
  };

  // ---------- DOM ----------

  let slot;
  let modal, card, promptEl, choicesEl, feedbackEl, progressEl, actionBtn;
  let state = { questions: [], current: 0, correct: 0, answered: false };

  const ensureSlot = () => {
    if (slot) return slot;
    slot = document.querySelector('[data-warmup-slot]');
    return slot;
  };

  const ensureModal = () => {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'pop-quiz-modal';
    modal.innerHTML = `
      <div class="pop-quiz-card">
        <div class="pop-quiz-progress" data-warmup-progress></div>
        <p class="pop-quiz-prompt" data-warmup-prompt>Loading…</p>
        <div class="pop-quiz-choices" data-warmup-choices></div>
        <div class="pop-quiz-feedback" data-warmup-feedback></div>
        <div class="pop-quiz-foot">
          <span class="progress-text" data-warmup-progress-text></span>
          <button class="btn btn-accent" data-warmup-action disabled>Next</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    promptEl = modal.querySelector('[data-warmup-prompt]');
    choicesEl = modal.querySelector('[data-warmup-choices]');
    feedbackEl = modal.querySelector('[data-warmup-feedback]');
    progressEl = modal.querySelector('[data-warmup-progress-text]');
    actionBtn = modal.querySelector('[data-warmup-action]');
    const progressDots = modal.querySelector('[data-warmup-progress]');
    // Reuse the progress-dot rendering from popquiz by populating same shape
    Object.defineProperty(modal, '_dots', { value: progressDots });
  };

  const renderDots = () => {
    if (!modal) return;
    const dots = modal.querySelector('[data-warmup-progress]');
    if (!dots) return;
    dots.innerHTML = state.questions.map((_, i) => {
      const cls = i < state.current ? 'done' : i === state.current ? 'current' : '';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
  };

  // ---------- Render banner ----------

  const renderBanner = () => {
    const slotEl = ensureSlot();
    if (!slotEl) return;
    slotEl.innerHTML = `
      <div class="warmup-banner">
        <div class="text">
          <h3>3-question daily warm-up</h3>
          <p>Quick check on your weakest topics. Takes about a minute.</p>
        </div>
        <div class="actions">
          <button class="btn btn-accent" data-warmup-start>Start warm-up</button>
          <button class="skip" data-warmup-skip>Skip for today</button>
        </div>
      </div>
    `;
    slotEl.querySelector('[data-warmup-start]').addEventListener('click', open);
    slotEl.querySelector('[data-warmup-skip]').addEventListener('click', skip);
  };

  // ---------- Quiz state machine ----------

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

  const answer = (idx, btn) => {
    if (state.answered) return;
    state.answered = true;
    const q = state.questions[state.current];
    const correctIdx = q.answerIndex;
    const isRight = idx === correctIdx;
    q.wasCorrect = isRight;
    if (isRight) state.correct += 1;
    const buttons = choicesEl.querySelectorAll('button');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === correctIdx) b.classList.add('correct');
      if (i === idx && !isRight) b.classList.add('wrong');
    });
    feedbackEl.textContent = isRight ? 'Correct.' : 'Not quite. ' + (q.explain || '');
    feedbackEl.style.color = isRight ? '#2f7a3e' : '#7a2a1f';
    actionBtn.disabled = false;
    try { Store.addReview(q._topic || 'warmup', isRight); } catch (e) {}
  };

  const next = () => {
    if (!state.answered) return;
    state.current += 1;
    if (state.current >= state.questions.length) {
      finish();
    } else {
      renderQuestion();
    }
  };

  const finish = () => {
    const w = get();
    w.date = today();
    w.completed = state.questions.length;
    w.total = state.questions.length;
    w.skipped = false;
    set(w);
    close();
    // Remove the banner from the DOM so the next reload of the day
    // doesn't show it again.
    const slotEl = ensureSlot();
    if (slotEl) slotEl.innerHTML = '';
  };

  const open = async () => {
    if (!LLM.activeProvider()) {
      // No LLM — skip silently rather than nag. The pop-quiz button
      // already does the "add a key" nag explicitly.
      skip();
      return;
    }
    ensureModal();
    modal.classList.add('open');
    modal.dataset.state = 'loading';
    state = { questions: [], current: 0, correct: 0, answered: false };

    const topics = pickTopics();
    promptEl.textContent = `Generating a 3-question warm-up on ${topics.join(', ')}…`;
    choicesEl.innerHTML = '';
    feedbackEl.textContent = '';
    progressEl.textContent = '';
    actionBtn.disabled = true;
    actionBtn.textContent = 'Loading…';
    renderDots();

    try {
      const result = await Generators.generatePopQuiz({ topics, count: 3, difficulty: 'easy' });
      if (!result || !result.quiz || !Array.isArray(result.quiz.questions) || !result.quiz.questions.length) {
        throw new Error('No questions returned.');
      }
      state.questions = result.quiz.questions.map((q, i) => ({
        ...q,
        _topic: topics[Math.min(i, topics.length - 1)] || 'warmup',
      }));
      modal.dataset.state = 'playing';
      renderQuestion();
    } catch (e) {
      modal.dataset.state = 'result';
      promptEl.textContent = 'Warm-up could not be generated.';
      feedbackEl.textContent = e && e.message ? e.message : 'Unknown error.';
      actionBtn.textContent = 'Close';
      actionBtn.disabled = false;
    }
  };

  const close = () => {
    if (modal) {
      modal.classList.remove('open');
      modal.dataset.state = '';
    }
  };

  const skip = () => {
    const w = get();
    w.date = today();
    w.skipped = true;
    set(w);
    const slotEl = ensureSlot();
    if (slotEl) slotEl.innerHTML = '';
  };

  // ---------- Mount ----------

  const mount = () => {
    // The banner slot is only present on the dashboard. If we can't
    // find it, this isn't the dashboard — bail.
    if (!ensureSlot()) return;
    if (isDone()) {
      ensureSlot().innerHTML = '';
      return;
    }
    renderBanner();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // Wire the action button + ESC once.
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-warmup-action]')) {
      if (!modal) return;
      if (modal.dataset.state === 'result') { close(); return; }
      next();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open') && modal.dataset.state === 'result') close();
  });
})(window);
