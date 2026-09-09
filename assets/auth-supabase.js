// Wuanberri — auth layer
// Two modes:
//   - "local"   : no Supabase configured. Uses Store.signIn/signOut as today.
//   - "supabase": a real Supabase project is wired up. Signups persist to a
//                 real database, sessions survive across devices.
//
// Either way, the rest of the app reads through Store.isAuthed() /
// Store.getUser(). The Supabase-mode mirror below keeps that interface
// working unchanged.

(function (global) {
  'use strict';

  const cfg = {
    url: global.__SUPABASE_URL__ || '',
    key: global.__SUPABASE_ANON_KEY__ || '',
  };

  const configured = !!(cfg.url && cfg.key);
  const mode = configured ? 'supabase' : 'local';

  // ---------- LOCAL MODE ----------
  // The Store already has everything we need. We just re-expose a
  // promise-returning API so the call sites in auth.html are uniform.
  const local = {
    mode: 'local',
    signUp: async ({ email, password, name }) => {
      if (!email || !password) throw new Error('Email and password are required.');
      if (password.length < 4) throw new Error('Password must be at least 4 characters.');
      if (!name) throw new Error('Please enter a name.');
      const users = Store.get('users', {});
      if (users[email]) throw new Error('An account with that email already exists. Try logging in.');
      users[email] = { name, password, joined: new Date().toISOString() };
      Store.set('users', users);
      Store.signIn({ name, email, joined: users[email].joined });
      return { name, email, joined: users[email].joined };
    },
    signIn: async ({ email, password }) => {
      if (!email || !password) throw new Error('Email and password are required.');
      const users = Store.get('users', {});
      if (!users[email] || users[email].password !== password) {
        throw new Error('No matching account. Try signing up first.');
      }
      Store.signIn({ name: users[email].name, email, joined: users[email].joined });
      return { name: users[email].name, email, joined: users[email].joined };
    },
    signOut: async () => { Store.signOut(); },
    user: () => Store.getUser() || null,
    onChange: (cb) => {
      // local mode has no remote session; cb fires once with current state.
      try { cb({ event: 'INITIAL', user: Store.getUser() || null }); } catch (e) {}
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  };

  // ---------- SUPABASE MODE ----------
  // Lazy-load the Supabase client. If the script tag is missing or fails
  // to load (offline, blocked CSP, wrong path), we fall back to local mode
  // with a console warning so the app keeps working.
  let supa = null;
  let supabaseClient = null;

  const loadSupabase = async () => {
    if (supabaseClient) return supabaseClient;
    if (typeof global.supabase === 'undefined' || !global.supabase.createClient) {
      // Try to load the vendored bundle. If the file doesn't exist yet,
      // surface a helpful error.
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'assets/vendor/supabase.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load assets/vendor/supabase.min.js. See README to vendor it.'));
        document.head.appendChild(s);
      });
    }
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error('Supabase JS library not found.');
    }
    supabaseClient = global.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return supabaseClient;
  };

  const normalizeUser = (u) => {
    if (!u) return null;
    const meta = u.user_metadata || {};
    return {
      id: u.id,
      name: meta.name || (u.email ? u.email.split('@')[0] : 'You'),
      email: u.email,
      joined: u.created_at,
    };
  };

  const mirrorToStore = (u) => {
    if (u) Store.signIn(u);
    else Store.signOut();
  };

  const remote = {
    mode: 'supabase',
    signUp: async ({ email, password, name }) => {
      if (!email || !password) throw new Error('Email and password are required.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (!name) throw new Error('Please enter a name.');
      const client = await loadSupabase();
      const { data, error } = await client.auth.signUp({
        email, password,
        options: { data: { name } },
      });
      if (error) throw new Error(error.message);
      const user = normalizeUser(data.user);
      if (user) mirrorToStore(user);
      return user;
    },
    signIn: async ({ email, password }) => {
      if (!email || !password) throw new Error('Email and password are required.');
      const client = await loadSupabase();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = normalizeUser(data.user);
      if (user) mirrorToStore(user);
      return user;
    },
    signOut: async () => {
      const client = await loadSupabase();
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
      Store.signOut();
    },
    user: () => Store.getUser() || null,
    onChange: (cb) => {
      // Real subscription — wired up lazily on first call.
      let subscription = { data: { subscription: { unsubscribe: () => {} } } };
      loadSupabase().then((client) => {
        subscription = client.auth.onAuthStateChange((_event, session) => {
          const u = normalizeUser(session && session.user);
          mirrorToStore(u);
          try { cb({ event: _event, user: u }); } catch (e) {}
        });
        // also emit current state immediately
        client.auth.getUser().then(({ data }) => {
          const u = normalizeUser(data && data.user);
          mirrorToStore(u);
          try { cb({ event: 'INITIAL', user: u }); } catch (e) {}
        });
      }).catch((e) => {
        console.warn('Supabase auth init failed, falling back to local:', e);
        try { cb({ event: 'INITIAL', user: Store.getUser() || null }); } catch (err) {}
      });
      return subscription;
    },
  };

  const active = configured ? remote : local;

  global.Auth = {
    mode: active.mode,
    configured,
    signUp: active.signUp,
    signIn: active.signIn,
    signOut: active.signOut,
    user: active.user,
    onChange: active.onChange,
  };

  // Boot the auth state listener so Store.user is kept in sync from
  // page-load (e.g. when a returning visitor is still signed in).
  try { Auth.onChange(() => {}); } catch (e) {}
})(window);
