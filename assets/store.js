// Wuanberri — state store
// Thin localStorage wrapper. One key, JSON blob, namespaced getters/setters.
// Falls back to an in-memory object if localStorage is unavailable (private mode, etc.).

(function (global) {
  'use strict';

  const KEY = 'wuanberri:v1';

  const memory = {};
  let hasLS = false;
  try {
    localStorage.setItem('__wu_test', '1');
    localStorage.removeItem('__wu_test');
    hasLS = true;
  } catch (e) { hasLS = false; }

  const read = () => {
    if (hasLS) {
      try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
      catch (e) { return {}; }
    }
    return memory._data || {};
  };
  const write = (data) => {
    if (hasLS) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); return; }
      catch (e) { memory._data = data; return; }
    }
    memory._data = data;
  };

  const get = (path, fallback) => {
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

  const clear = () => { if (hasLS) localStorage.removeItem(KEY); memory._data = {}; };

  // ---------- Domain helpers ----------

  const today = () => new Date().toISOString().slice(0, 10);

  // Auth
  const isAuthed = () => !!get('user');
  const getUser = () => get('user');
  const signIn = (user) => set('user', user);  // {name, email, joined}
  const signOut = () => del('user');

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

  // Pro (Stripe subscription state)
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
