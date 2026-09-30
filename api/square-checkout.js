// /api/square-checkout — mints a Square payment link for the Pro subscription.
// Runs as a Vercel serverless function. No SDK, no dependencies — plain fetch.
//
// Two ways to make it live (set in Vercel env, NEVER in this file):
//
//   Tier 1 — zero API: SQUARE_CHECKOUT_URL
//     A payment link created by hand in the Square dashboard (Items → Payment links).
//     The handler just hands that URL back. This is enough to go live today.
//
//   Tier 2 — full API: SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID + SQUARE_SUBSCRIPTION_PLAN_ID
//     Mints a fresh link per checkout so the buyer's email can be pre-filled and
//     Square_Version stays current. SQUARE_PRO_PRICE_CENTS must match the subscription
//     plan variation's price (default 999 = $9.99) or Square treats it as a price override.
//
// Neither set -> the probe reports { ready: false, reason } and the button on the
// page says checkout is being set up, instead of sending anyone into a wall.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
  const LOCATION = process.env.SQUARE_LOCATION_ID || '';
  const PLAN_ID = process.env.SQUARE_SUBSCRIPTION_PLAN_ID || '';
  const STATIC_URL = process.env.SQUARE_CHECKOUT_URL || '';
  const body = req.body || {};
  const email = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim() : '';
  const userId = typeof body.userId === 'string' ? body.userId.slice(0, 64) : 'guest';

  // redirect_url must come back to our own site. Trusting req.headers.origin
  // let a third party mint a real Square payment link whose success page was
  // their own domain. Allowlist it; anything missing or unrecognized falls
  // back to the canonical origin. (localhost entries are for local dev only
  // and cannot be reached by a real buyer.)
  const CANONICAL_ORIGIN = 'https://wuanberri.com';
  const ALLOWED_ORIGINS = new Set([
    'https://wuanberri.com',
    'https://www.wuanberri.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:31337',
  ]);
  const origin = ALLOWED_ORIGINS.has(req.headers.origin) ? req.headers.origin : CANONICAL_ORIGIN;

  // A genuine double-click must not create two links, so the idempotency key
  // has to be stable across retries. The old code embedded Date.now(), which
  // made the key unique on every call — it could never dedupe. Use the
  // client's per-attempt id when it is an opaque token, else a key that
  // depends only on the user.
  const attemptRaw = typeof body.attemptId === 'string' ? body.attemptId.trim() : '';
  const attemptId = /^[A-Za-z0-9-]{1,64}$/.test(attemptRaw) ? attemptRaw : 'default';

  if (body.probe) {
    const ready = !!STATIC_URL || !!(TOKEN && LOCATION && PLAN_ID);
    const reason = ready
      ? 'Square checkout is configured.'
      : 'Square is not connected yet. The site owner needs to add SQUARE_CHECKOUT_URL (a dashboard payment link) or SQUARE_ACCESS_TOKEN + SQUARE_LOCATION_ID + SQUARE_SUBSCRIPTION_PLAN_ID in the Vercel env.';
    return res.status(200).json({ ready, reason, tier: STATIC_URL ? 'link' : (TOKEN && LOCATION && PLAN_ID ? 'api' : 'none') });
  }

  // Tier 1 — the dashboard-made link. Nothing to create.
  if (STATIC_URL && !(TOKEN && LOCATION && PLAN_ID)) {
    return res.status(200).json({ url: STATIC_URL, tier: 'link' });
  }

  // Tier 2 — mint a fresh payment link.
  if (!TOKEN || !LOCATION || !PLAN_ID) {
    return res.status(500).json({ error: 'Square is not configured on this deployment. The site owner needs to set the SQUARE_* env vars.' });
  }

  const priceCents = parseInt(process.env.SQUARE_PRO_PRICE_CENTS || '999', 10);

  try {
    const resp = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
        // Square pins behavior by version header; 2025-09 is current at build time.
        'Square-Version': '2025-09-24',
      },
      body: JSON.stringify({
        idempotency_key: 'wuanberri-pro-' + userId + '-' + attemptId,
        description: 'Wuanberri Pro — $9.99/month, 7-day free trial',
        quick_pay: {
          name: 'Wuanberri Pro (monthly)',
          price_money: { amount: priceCents, currency: 'USD' },
          location_id: LOCATION,
        },
        checkout_options: {
          subscription_plan_id: PLAN_ID,
          redirect_url: origin + '/dashboard.html?pro=1',
          ask_for_shipping_address: false,
        },
        pre_populated_data: email ? { buyer_email: email } : undefined,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const detail = (data.errors && data.errors[0] && data.errors[0].detail) || ('HTTP ' + resp.status);
      return res.status(502).json({ error: 'Square refused the checkout request: ' + detail });
    }
    if (!data.payment_link || !data.payment_link.url) {
      return res.status(502).json({ error: 'Square answered but returned no payment link URL.' });
    }
    return res.status(200).json({ url: data.payment_link.url, tier: 'api' });
  } catch (err) {
    return res.status(500).json({ error: 'Checkout init failed: ' + (err.message || String(err)) });
  }
};