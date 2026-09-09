// Wuanberri — first-time setup helper
//
// This script writes the *public* credentials (Stripe publishable key, and
// later, the Google Client ID) into the right stub files. It deliberately
// refuses to accept anything that looks like a secret key.
//
// Secrets (Stripe sk_/whsec_, Google client secret) must NEVER be committed.
// They go in the Vercel dashboard as environment variables — see .env.example
// for the list and the README for the runbook.
//
// Usage (PowerShell):
//   node scripts/setup-secrets.mjs
//
// It will prompt for each value. Press Enter to skip a value and leave the
// stub as-is. To start over, run with --reset (wipes both stubs back to empty).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const STRIPE_CFG = resolve(ROOT, 'assets', '__STRIPE_CONFIG__.js');
const GOOGLE_CFG = resolve(ROOT, 'assets', '__GOOGLE_CONFIG__.js');

// ---- Validation helpers ----

// Stripe publishable keys are pk_test_... or pk_live_... followed by a long
// opaque string. The exact length varies; we just check the prefix.
const PK_RE = /^pk_(test|live)_[A-Za-z0-9]+$/;

// Stripe secret keys look like sk_test_... or sk_live_... or rk_... —
// we never want these. Webhook secrets look like whsec_... — also never.
const SECRET_PREFIXES = ['sk_', 'rk_', 'whsec_'];

// Google OAuth client IDs end in .apps.googleusercontent.com.
const GOOGLE_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

function looksLikeSecret(s) {
  return SECRET_PREFIXES.some((p) => s.startsWith(p));
}

function validateStripePublishable(input) {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: '' }; // empty = skip
  if (looksLikeSecret(trimmed)) {
    return {
      ok: false,
      reason:
        'That looks like a SECRET key (sk_/rk_/whsec_). ' +
        'The publishable key starts with pk_test_ or pk_live_. ' +
        'The secret key goes in the Vercel dashboard env vars — see .env.example.',
    };
  }
  if (!PK_RE.test(trimmed)) {
    return {
      ok: false,
      reason:
        'A Stripe publishable key looks like "pk_test_51N..." or "pk_live_51N...". ' +
        'Double-check you copied the right one from dashboard.stripe.com/apikeys.',
    };
  }
  return { ok: true, value: trimmed };
}

function validateGoogleClientId(input) {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: '' };
  if (trimmed.includes('.apps.googleusercontent.com') === false) {
    return {
      ok: false,
      reason:
        'A Google Client ID looks like "123456789-abc...xyz.apps.googleusercontent.com". ' +
        'It does NOT end with just ".com".',
    };
  }
  if (!GOOGLE_RE.test(trimmed)) {
    return {
      ok: false,
      reason: 'That does not match the Google Client ID format. Paste it exactly from the Google Cloud console.',
    };
  }
  return { ok: true, value: trimmed };
}

// ---- File writers ----

function readStub(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function writeStripeStub(value) {
  // Preserve the leading comment block; only swap the publishableKey line.
  const current = readStub(STRIPE_CFG);
  if (current === null) {
    console.error(`!! ${STRIPE_CFG} not found. Did you run this from the repo root?`);
    process.exit(1);
  }
  const line = `  publishableKey: '${value}',  // pk_test_... in dev, pk_live_... in prod`;
  const next = current.replace(/publishableKey:\s*'[^']*',[^\n]*/, line);
  writeFileSync(STRIPE_CFG, next, 'utf8');
}

function writeGoogleStub(value) {
  const current = readStub(GOOGLE_CFG);
  if (current === null) {
    console.error(`!! ${GOOGLE_CFG} not found.`);
    process.exit(1);
  }
  const line = `window.__GOOGLE_CLIENT_ID__ = '${value}';`;
  const next = current.replace(/window\.__GOOGLE_CLIENT_ID__\s*=\s*'[^']*';/, line);
  writeFileSync(GOOGLE_CFG, next, 'utf8');
}

function resetStubs() {
  writeStripeStub('');
  writeGoogleStub('');
  console.log('Both stubs reset to empty.');
}

// ---- Main ----

async function promptOnce(rl, label, validate) {
  // Loop until the user enters something valid OR an empty value (skip).
  for (;;) {
    const raw = await rl.question(label + ' ');
    const result = validate(raw);
    if (result.ok) return result.value;
    if (raw.trim() === '') return '';
    console.log('  !! ' + result.reason);
    console.log('  Try again, or press Enter to skip.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--reset')) {
    resetStubs();
    return;
  }

  console.log('');
  console.log('Wuanberri — first-time credential setup');
  console.log('----------------------------------------');
  console.log('This writes PUBLIC credentials to your config stubs.');
  console.log('Secret keys (sk_/whsec_/client secrets) go in Vercel env vars.');
  console.log('See .env.example for the list.');
  console.log('');
  console.log('Press Enter to skip any value and leave the stub as-is.');
  console.log('');

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const pk = await promptOnce(
      rl,
      'Stripe publishable key (pk_test_... or pk_live_...):',
      validateStripePublishable,
    );
    if (pk) {
      writeStripeStub(pk);
      console.log('  -> wrote Stripe publishable key to assets/__STRIPE_CONFIG__.js');
    } else {
      console.log('  -> skipped Stripe');
    }

    console.log('');

    const gcid = await promptOnce(
      rl,
      'Google OAuth Client ID (xxxxx.apps.googleusercontent.com):',
      validateGoogleClientId,
    );
    if (gcid) {
      writeGoogleStub(gcid);
      console.log('  -> wrote Google Client ID to assets/__GOOGLE_CONFIG__.js');
    } else {
      console.log('  -> skipped Google');
    }
  } finally {
    rl.close();
  }

  console.log('');
  console.log('Done.');
  console.log('');
  console.log('Next: set the SECRET env vars in the Vercel dashboard.');
  console.log('  See .env.example for the full list.');
  console.log('  See README.md → "Stripe / Google setup" for the runbook.');
  console.log('');
}

main().catch((err) => {
  console.error('setup-secrets failed:', err);
  process.exit(1);
});
