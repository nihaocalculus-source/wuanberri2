# Vendor directory

This directory holds third-party JavaScript libraries that Wuanberri loads
directly from disk (rather than from a CDN) so the deploy stays
self-contained and the Content-Security-Policy can stay strict.

## supabase.min.js

Needed only if you wire up real auth (see `../__SUPABASE_CONFIG__.js`).

To vendor it:

1. Open PowerShell in `C:\Users\nihao\wuanberri`
2. Run:
   ```
   Invoke-WebRequest -Uri "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js" -OutFile "assets/vendor/supabase.min.js"
   ```
3. Verify the file is roughly 50-100 KB:
   ```
   Get-Item assets/vendor/supabase.min.js | Select-Object Length
   ```

The file is *not* committed to git by default because every developer
who enables Supabase will get a slightly different version, and the
runtime API is what matters. Once vendored, the app loads it on demand
when `Auth.mode === 'supabase'`.

If this file is missing and `__SUPABASE_URL__` is set, the auth
sign-in attempt will surface a clear error in the form: "Could not
load assets/vendor/supabase.min.js. See README to vendor it."
