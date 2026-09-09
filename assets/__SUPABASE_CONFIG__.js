// === Supabase configuration ===
//
// Wuanberri ships with a local-only "demo" auth that writes accounts to
// your browser's localStorage. That's fine for trying the app, but it
// means each device has its own account list and there's no cross-device
// sync.
//
// To switch to real auth backed by a real database, set the two values
// below. The app will detect them on next page load and start using
// Supabase for signup, login, and "stay signed in" across devices.
//
// How to get these values
// -----------------------
// 1. Go to https://supabase.com and create a free account (no card).
// 2. Click "New project", give it any name (e.g. "wuanberri-prod"),
//    pick the closest region, and set a database password.
// 3. Wait ~2 minutes for the project to provision.
// 4. In the left sidebar, click "Settings" (the gear icon) → "API".
// 5. Copy the "Project URL" into __SUPABASE_URL__ below.
// 6. Copy the "anon public" key (it's labeled "public") into
//    __SUPABASE_ANON_KEY__ below. This key is *meant* to be public —
//    it's the same one your browser sends with every request.
// 7. Save this file, refresh the site, and signup will now create real
//    accounts in your Supabase database.
//
// Security
// --------
// The anon key is safe to commit to a public repo. The real security
// boundary is Row Level Security (RLS) on the `profiles` table:
//   1. In Supabase, click "Table Editor" → "New table".
//   2. Name it "profiles", enable RLS.
//   3. Add columns: id (uuid, primary key, default auth.uid()),
//      email (text), name (text), created_at (timestamptz, default now()).
//   4. In "Authentication" → "Policies" → "profiles", add a policy:
//        - Policy name: "Users can read own profile"
//        - Allowed operation: SELECT
//        - Target roles: authenticated
//        - USING expression: auth.uid() = id
//   5. Add a second policy:
//        - Policy name: "Users can update own profile"
//        - Allowed operation: UPDATE
//        - Target roles: authenticated
//        - USING expression: auth.uid() = id
//        - WITH CHECK expression: auth.uid() = id
//   6. Optional: add an INSERT policy that lets the trigger below
//      create a profile on signup:
//        - Policy name: "Enable insert for authenticated users only"
//        - Allowed operation: INSERT
//        - Target roles: authenticated
//        - WITH CHECK expression: auth.uid() = id
//   7. In "Database" → "Triggers" (or run in SQL editor), add:
//        create or replace function public.handle_new_user()
//        returns trigger as $$
//        begin
//          insert into public.profiles (id, email, name)
//          values (new.id, new.email, new.raw_user_meta_data->>'name');
//          return new;
//        end;
//        $$ language plpgsql security definer;
//
//        create trigger on_auth_user_created
//          after insert on auth.users
//          for each row execute procedure public.handle_new_user();
//
// That's it. New signups will create a row in `profiles` automatically.
// Your existing localStorage accounts will keep working until you
// sign up again with the same email — Supabase will then take over.

window.__SUPABASE_URL__ = '';        // e.g. 'https://abcdefghij.supabase.co'
window.__SUPABASE_ANON_KEY__ = '';   // e.g. 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
