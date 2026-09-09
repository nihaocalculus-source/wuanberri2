// quiz.js — score tracking for Wuanberri quiz pages (quiz-*.html).
// Each question is a .mcq form bound by app.js; this file watches clicks
// and keeps a running score in #quiz-score.
(function () {
  function score() {
    let answered = 0, correct = 0;
    document.querySelectorAll('.mcq[data-mcq]').forEach((form) => {
      if (!form.dataset.answered) return;
      answered++;
      if (form.dataset.correct === '1') correct++;
    });
    const total = document.querySelectorAll('.mcq[data-mcq]').length;
    return { answered, correct, total };
  }

  function render() {
    const el = document.getElementById('quiz-score');
    if (!el) return;
    const s = score();
    if (s.total === 0) return;
    el.textContent = s.answered === 0
      ? '0 of ' + s.total + ' answered'
      : s.answered + ' of ' + s.total + ' answered — ' + s.correct + ' correct';
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-choice]');
    if (!btn) return;
    const form = btn.closest('.mcq[data-mcq]');
    if (!form || form.dataset.answered) return;
    form.dataset.answered = '1';
    form.dataset.correct = btn.classList.contains('correct') ? '1' : '0';
    render();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();