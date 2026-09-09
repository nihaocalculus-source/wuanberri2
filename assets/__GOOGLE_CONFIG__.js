// Wuanberri — Google OAuth Client ID stub
//
// Fill in your Google OAuth "Client ID" (the public one, not the secret).
// Empty by default — the "Continue with Google" button stays hidden until
// this is set.
//
// To enable:
//   1. Go to https://console.cloud.google.com/apis/credentials
//      (create a project first if you don't have one).
//   2. Click "Create credentials" → "OAuth client ID" → Application type
//      "Web application".
//   3. Under "Authorized JavaScript origins", add:
//        - http://localhost:8000        (for local dev)
//        - https://YOUR-DOMAIN.vercel.app  (your production URL)
//   4. Click "Create" — copy the Client ID. It looks like:
//        123456789-abcdefghijklmnop.apps.googleusercontent.com
//   5. Either paste it below by hand, OR run the setup script which will
//      write it here for you (and refuse to accept a Client secret):
//        node scripts/setup-secrets.mjs
//   6. The "Continue with Google" button on auth.html will appear on next
//      page load.
//
// Security
// --------
// The Client ID is NOT a secret — it's safe to commit to a public repo.
// (The Client SECRET is a secret and lives only in Vercel env vars —
// see .env.example.)
window.__GOOGLE_CLIENT_ID__ = '';   // e.g. '123456789-abc...xyz.apps.googleusercontent.com'
