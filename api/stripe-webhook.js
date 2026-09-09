// /api/stripe-webhook — verifies the Stripe signature, then handles events.
// Runs as a Vercel serverless function. Plain ESM.
//
// Required env vars:
//   STRIPE_SECRET_KEY       sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET   whsec_... (from Stripe dashboard → Developers → Webhooks)
//
// IMPORTANT: We need the RAW body to verify the signature, so we disable the
// automatic JSON parser for this route. Vercel's `bodyParser: false` does that.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Stripe env vars not set.');
  }

  const sig = req.headers['stripe-signature'];
  const raw = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event. The source of truth for "is this user Pro?" lives in
  // Stripe (customer.subscription.*). For Wuanberri's static-only setup, the
  // success_url bounce (dashboard.html?pro=1) is what flips Store.pro client-side.
  // This webhook is the safety net — log + (later) write to Supabase.
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        console.log('[stripe] checkout.session.completed', {
          user: s.client_reference_id,
          customer: s.customer,
          subscription: s.subscription,
        });
        // TODO: when a Supabase table exists for Pro status, write here.
        break;
      }
      case 'customer.subscription.deleted': {
        const s = event.data.object;
        console.log('[stripe] subscription cancelled', { subscription: s.id });
        // TODO: flip Store.pro off in the DB.
        break;
      }
      default:
        // Ignore other events — Stripe sends a lot.
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Handler error.');
  }
}
