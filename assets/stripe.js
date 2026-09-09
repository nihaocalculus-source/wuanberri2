// Wuanberri — Stripe Checkout client
// Lazy-loads Stripe.js, calls /api/create-checkout, then redirects.
// Wired by [data-stripe="checkout"] on any button.
//
// Requires window.STRIPE_CONFIG.publishableKey to be set in __STRIPE_CONFIG__.js.
// If empty, the buttons stay clickable but show a friendly message instead of failing silently.
(function () {
  'use strict';

  const cfg = window.STRIPE_CONFIG || {};
  const pk = cfg.publishableKey;

  let stripePromise = null;
  function loadStripe() {
    if (!pk) return Promise.reject(new Error('Stripe is not configured yet. Fill in assets/__STRIPE_CONFIG__.js.'));
    if (!stripePromise) {
      stripePromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.async = true;
        s.onload = () => resolve(window.Stripe(pk));
        s.onerror = () => reject(new Error('Failed to load stripe.com/v3 — check your network.'));
        document.head.appendChild(s);
      });
    }
    return stripePromise;
  }

  async function startCheckout() {
    const user = (window.Store && Store.getUser) ? Store.getUser() : null;
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user && user.id ? user.id : 'guest',
        email: user && user.email ? user.email : null,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('Checkout init failed (' + res.status + '): ' + txt);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.sessionId) throw new Error('No sessionId returned from server.');

    const stripe = await loadStripe();
    const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
    if (error) throw error;
  }

  function wireButtons() {
    document.querySelectorAll('[data-stripe="checkout"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Loading…';
        startCheckout().catch((err) => {
          btn.disabled = false;
          btn.textContent = originalText;
          // Soft-fail: tell the user what to do. Don't dump a stack trace.
          alert(err.message + '\n\nIf you are the site owner, set STRIPE_SECRET_KEY in Vercel env vars.');
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButtons);
  } else {
    wireButtons();
  }

  // Expose for debugging + for any page that wants to gate on Pro state.
  window.WuanberriStripe = { startCheckout };
})();
