// Wuanberri — first-time setup helper
//
// This script writes the *public* credential (the Google Client ID) into
// its stub file. It deliberately refuses to accept anything that looks like
// a secret key.
//
// Secrets (Google client secret, Square access token) must NEVER be committed.
// They go in the Vercel dashboard as environment variables — see .env.example
// for the list and the README for the runbook.
//
// Usage (PowerShell):
//   node scripts/setup-secrets.mjs
//
// It will prompt for the value. Press Enter to skip and leave the stub as-is.
// To start over, run with --reset (wipes the stub back to empty).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const GOOGLE_CFG = resolve(ROOT, 'assets', '__GOOGLE_CONFIG__.js');

// Google OAuth client IDs end in .apps.googleusercontent.com.
const GOOGLE_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

function validateGoogleClientId(input) {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: '' }; // empty = skip
  if (trimmed.includes('.apps.googleusercontent.com') === false) {
    return {
      ok: false,
      reason:
        'A Google Client ID looks like "123456789-abc...xyz.apps.googleusercontent.com". ' +
        'It does NOT end in just ".com".',
    };
  }
  if (!GOOGLE_RE.test(trimmed)) {
    return { ok: false, reason: 'That does not match the Google Client ID format. Paste it exactly from the Google Cloud console.' };
  }
  return { ok: true, value: trimmed };
}

// ---- File writers ----

function readStub(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
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
  writeGoogleStub('');
  console.log('Stub reset to empty.');
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
  console.log('Secrets (Google client secret, Square token) go in Vercel env vars.');
  console.log('See .env.example for the list.');
  console.log('');
  console.log('Press Enter to skip any value and leave the stub as-is.');
  console.log('');

  const rl = createInterface({ input: stdin, output: stdout });

  try {
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
  console.log('  See README.md → "Square / Google setup" for the runbook.');
  console.log('');
}

main().catch((err) => {
  console.error('setup-secrets failed:', err);
  process.exit(1);
});