// Wuanberri — Square checkout client.
// Wired by [data-checkout] on any button. Asks /api/square-checkout for a payment
// link and redirects there. Square hosts the actual card page — no card data
// ever touches this site.
//
// If Square isn't configured yet the probe says so up front, and the button
// answers honestly ("checkout is being set up") instead of failing silently.
(function () {
  'use strict';

  var ready = null;          // null = not checked yet, true/false = probe result
  var reason = '';

  // Stable for the life of this page load: a double-click (or a retry of the
  // same click) reuses the same id, so Square's idempotency key dedupes
  // instead of minting a second payment link.
  var attemptId = (function () {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) {}
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  })();

  function probe() {
    return fetch('/api/square-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe: true })
    }).then(function (r) { return r.json(); })
      .then(function (j) { ready = !!j.ready; reason = j.reason || ''; })
      .catch(function () { ready = false; reason = 'The checkout endpoint did not answer.'; });
  }

  function startCheckout() {
    var user = (window.Store && Store.getUser) ? Store.getUser() : null;
    return fetch('/api/square-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user && user.id ? user.id : 'guest',
        email: user && user.email ? user.email : null,
        attemptId: attemptId
      })
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, body: j }; });
    }).then(function (res) {
      if (!res.ok || !res.body.url) {
        throw new Error(res.body.error || res.body.reason || 'No checkout link came back.');
      }
      window.location.href = res.body.url;
    });
  }

  function wireButtons() {
    document.querySelectorAll('[data-checkout]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        btn.disabled = true;
        var originalText = btn.textContent;
        btn.textContent = 'Loading…';
        startCheckout().catch(function (err) {
          btn.disabled = false;
          btn.textContent = originalText;
          if (ready === false) {
            alert('Checkout is being set up — the Square account is not connected yet. Please check back soon.');
          } else {
            // Soft-fail: tell the user, don't dump a stack trace.
            alert((err && err.message ? err.message : 'Checkout failed.') + '\n\nIf it keeps happening, email info@wuanberri.com.');
          }
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { wireButtons(); probe(); });
  } else {
    wireButtons(); probe();
  }

  // Exposed for debugging + for pages that want to know if checkout is live.
  window.WuanberriCheckout = { startCheckout: startCheckout, isReady: function () { return ready; }, reason: function () { return reason; } };
})();