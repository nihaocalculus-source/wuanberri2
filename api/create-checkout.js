// /api/create-checkout — mints a Stripe Checkout Session and returns its id.
// Runs as a Vercel serverless function. Plain ESM — Vercel handles the bundling.
//
// Required env vars (set in Vercel dashboard, NOT in this file):
//   STRIPE_SECRET_KEY   sk_test_... or sk_live_...
//   STRIPE_PRICE_ID     price_... (the recurring Pro price, with 7-day trial baked in)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set in env.' });
  }
  if (!process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'STRIPE_PRICE_ID not set in env.' });
  }

  try {
    const { userId = 'guest', email = null } = req.body || {};

    const origin =
      req.headers.origin ||
      (req.headers['x-forwarded-proto'] && req.headers.host
        ? `${req.headers['x-forwarded-proto']}://${req.headers.host}`
        : 'https://wuanberri.vercel.app');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      // Trial is configured on the Stripe Price itself (Billing → Pricing rules),
      // not here — keeps this file dumb.
      success_url: `${origin}/dashboard.html?pro=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/index.html#pricing`,
      client_reference_id: String(userId),
      customer_email: email || undefined,
      allow_promotion_codes: true,
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error('create-checkout error:', err);
    return res.status(500).json({ error: err.message || 'Checkout init failed.' });
  }
}
