// Wuanberri — state store
// Thin localStorage wrapper with one JSON blob PER ACCOUNT, so signing in with a
// different Google account on the same browser gives a clean, separate profile
// (placement, streak, reviews, settings) instead of sharing one blob.
//   wuanberri:session   -> the signed-in user ({id, name, email, ...})
//   wuanberri:u:<uid>   -> that user's data
//   wuanberri:v1        -> guest bucket (signed-out) + pre-accounts legacy data
// Falls back to an in-memory object if localStorage is unavailable (private mode, etc.).

(function (global) {
  'use strict';

  const GUEST_KEY = 'wuanberri:v1';
  const SESSION_KEY = 'wuanberri:session';
  const USER_PREFIX = 'wuanberri:u:';

  const memory = {};
  let hasLS = false;
  try {
    localStorage.setItem('__wu_test', '1');
    localStorage.removeItem('__wu_test');
    hasLS = true;
  } catch (e) { hasLS = false; }

  const rawRead = (key) => {
    if (hasLS) {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); }
      catch (e) { return null; }
    }
    return memory[key] || null;
  };
  const rawWrite = (key, data) => {
    if (hasLS) {
      try { localStorage.setItem(key, JSON.stringify(data)); return; }
      catch (e) { /* fall through to memory */ }
    }
    memory[key] = data;
  };
  const rawRemove = (key) => {
    if (hasLS) { try { localStorage.removeItem(key); } catch (e) {} }
    delete memory[key];
  };

  // The signed-in user lives in its own session record.
  const readSession = () => {
    const u = rawRead(SESSION_KEY);
    return (u && typeof u === 'object' && u.id) ? u : null;
  };

  // One-time move of the old shared blob (user + data in one key) into the
  // per-account layout. Only the account that owned the old blob inherits it.
  (function migrate() {
    const legacy = rawRead(GUEST_KEY);
    if (!legacy || !legacy.user) return;
    const { user, ...rest } = legacy;
    if (user && user.id) {
      if (!readSession()) rawWrite(SESSION_KEY, user);
      if (!rawRead(USER_PREFIX + user.id)) rawWrite(USER_PREFIX + user.id, rest);
      rawWrite(GUEST_KEY, {});
    } else {
      // Pre-Google demo accounts had no id. Drop the dead login but keep the
      // progress as guest data, so nothing a student earned is thrown away.
      rawWrite(GUEST_KEY, rest);
    }
  })();

  const activeKey = () => {
    const u = readSession();
    return u ? USER_PREFIX + u.id : GUEST_KEY;
  };
  const read = () => rawRead(activeKey()) || {};
  const write = (data) => rawWrite(activeKey(), data);

  const get = (path, fallback) => {
    if (path === 'user') { const u = readSession(); return u === null ? fallback : u; }
    const data = read();
    const parts = path.split('.');
    let cur = data;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
      else return fallback;
    }
    return cur === undefined ? fallback : cur;
  };

  const set = (path, value) => {
    if (path === 'user') { if (value && value.id) rawWrite(SESSION_KEY, value); else rawRemove(SESSION_KEY); return; }
    const data = read();
    const parts = path.split('.');
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    write(data);
  };

  const del = (path) => {
    if (path === 'user') { rawRemove(SESSION_KEY); return; }
    const data = read();
    const parts = path.split('.');
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) return;
      cur = cur[parts[i]];
    }
    delete cur[parts[parts.length - 1]];
    write(data);
  };

  // Clears the active bucket only (the current account's data, or the guest bucket).
  const clear = () => { rawRemove(activeKey()); };

  // ---------- Domain helpers ----------

  const today = () => new Date().toISOString().slice(0, 10);

  // Auth
  const isAuthed = () => !!readSession();
  const getUser = () => readSession();
  // {id, name, email, joined}. Called on every page load by auth-firebase.js,
  // so skip the write when nothing changed.
  const signIn = (user) => {
    if (!user || !user.id) return;
    const cur = readSession();
    if (cur && JSON.stringify(cur) === JSON.stringify(user)) return;
    rawWrite(SESSION_KEY, user);
  };
  // Ends the session; the account's data stays saved under its own key.
  const signOut = () => rawRemove(SESSION_KEY);

  // Placement / profile
  const savePlacement = (result) => {
    set('placement', { ...result, takenAt: new Date().toISOString() });
  };
  const getPlacement = () => get('placement');

  // Streak — bumps if last active was yesterday, resets if older.
  const bumpStreak = () => {
    const s = get('streak', { count: 0, lastActive: null, longest: 0 });
    const t = today();
    if (s.lastActive === t) return s;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.count = (s.lastActive === yesterday) ? s.count + 1 : 1;
    s.lastActive = t;
    s.longest = Math.max(s.longest, s.count);
    set('streak', s);
    return s;
  };
  const getStreak = () => get('streak', { count: 0, lastActive: null, longest: 0 });

  // Cards reviewed (simple ledger)
  const addReview = (subject, wasCorrect) => {
    const ledger = get('reviews', []);
    ledger.push({ subject, wasCorrect, at: new Date().toISOString() });
    set('reviews', ledger);
  };
  const getReviews = () => get('reviews', []);

  // LLM key
  const setApiKey = (provider, key) => set('llm.' + provider, key);
  const getApiKey = (provider) => get('llm.' + provider);
  const clearApiKey = (provider) => del('llm.' + provider);
  const hasApiKey = (provider) => !!getApiKey(provider);

  // Settings (display name, theme later)
  const setSetting = (k, v) => set('settings.' + k, v);
  const getSetting = (k, fallback) => get('settings.' + k, fallback);

  // Pro (Square subscription state)
  // Flipped client-side on success_url bounce (see dashboard.html script).
  // For cross-device Pro, mirror to a Supabase table later — same pattern as user.
  const markPro = () => set('pro', { since: new Date().toISOString() });
  const isPro = () => !!get('pro');
  const clearPro = () => del('pro');

  global.Store = {
    get, set, del, clear,
    isAuthed, getUser, signIn, signOut,
    savePlacement, getPlacement,
    bumpStreak, getStreak,
    addReview, getReviews,
    setApiKey, getApiKey, clearApiKey, hasApiKey,
    setSetting, getSetting,
    markPro, isPro, clearPro,
  };
})(window);
