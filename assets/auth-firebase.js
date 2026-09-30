// Wuanberri — Google sign-in via Firebase Authentication
//
// Extends the existing Auth layer (assets/auth-supabase.js) instead of
// replacing it. The rest of the app keeps reading sign-in state through
// Store.isAuthed() / Store.getUser() unchanged: every Firebase auth-state
// change mirrors into Store.user, so the header CTA, the page gate, and
// all existing call sites work as before.
//
// Contract added to window.Auth:
//   Auth.signInWithGoogle() -> Promise<user>   (popup flow)
//
// Requirements on the Firebase side (console.firebase.google.com):
//   1. Authentication → Sign-in method → Google → Enabled
//   2. Authentication → Settings → Authorized domains → includes
//      wuanberri.com (localhost is authorized by default for local preview)

(function (global) {
  'use strict';

  var cfg = global.__FIREBASE_CONFIG__ || {};
  var enabled = !!(cfg.apiKey && cfg.projectId && cfg.appId && cfg.authDomain);
  if (!enabled) return; // No config — Google login stays hidden everywhere.

  // Pinned SDK version; gstatic serves every released version permanently.
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  var authInstance = null;
  var authMod = null;
  var booted = false;

  var normalize = function (u) {
    if (!u) return null;
    return {
      id: u.uid,
      name: u.displayName || (u.email ? u.email.split('@')[0] : 'You'),
      email: u.email || '',
      joined: (u.metadata && u.metadata.creationTime) || new Date().toISOString(),
      photo: u.photoURL || '',
      provider: 'google',
    };
  };

  var mirror = function (u) {
    if (u) global.Store.signIn(u);
    else global.Store.signOut();
  };

  var friendlyError = function (code, message) {
    if (code === 'auth/unauthorized-domain') {
      return "This site isn't on Firebase's authorized-domains list yet. " +
        'Add wuanberri.com under Firebase Authentication → Settings → Authorized domains.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Google sign-in is not enabled in Firebase yet. ' +
        'Authentication → Sign-in method → Google → Enable.';
    }
    if (code === 'auth/popup-blocked') {
      return 'The sign-in popup was blocked. Allow popups for this site and try again.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network error reaching Google. Check your connection and try again.';
    }
    return message || 'Google sign-in failed. Please try again.';
  };

  var isSilent = function (e) {
    var code = e && e.code;
    return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
  };

  var boot = function () {
    if (booted) return;
    booted = true;
    // Dynamic import works from a classic script in every modern browser
    // and keeps the site free of a bundler step.
    import(SDK + 'firebase-app.js').then(function (appMod) {
      return import(SDK + 'firebase-auth.js').then(function (mod) {
        authMod = mod;
        var app = appMod.initializeApp(cfg);
        authInstance = authMod.getAuth(app);
        // Keep Store in sync on every page load — returning visitors
        // stay signed in because Firebase persists the session in
        // IndexedDB and we mirror it into localStorage.
        authMod.onAuthStateChanged(authInstance, function (u) {
          mirror(normalize(u));
        });
      });
    }).catch(function (e) {
      console.warn('Wuanberri: Firebase auth failed to load:', e);
    });
  };

  // A sign-out anywhere in the app goes through Store.signOut (the header
  // CTA calls it directly). Make sure the Firebase session ends too, or
  // the next page load would quietly sign the user back in.
  var origSignOut = global.Store && global.Store.signOut;
  if (origSignOut) {
    global.Store.signOut = function () {
      if (authInstance && authMod) {
        try { authMod.signOut(authInstance).catch(function () {}); } catch (e) {}
      }
      return origSignOut();
    };
  }

  if (global.Auth) {
    global.Auth.signInWithGoogle = function () {
      if (!authInstance || !authMod) {
        return Promise.reject(new Error('Google sign-in is still loading — try again in a second.'));
      }
      var provider = new authMod.GoogleAuthProvider();
      return authMod.signInWithPopup(authInstance, provider).then(function (cred) {
        var u = normalize(cred.user);
        mirror(u);
        return u;
      }).catch(function (e) {
        var err = new Error(isSilent(e) ? '' : friendlyError(e && e.code, e && e.message));
        err.code = e && e.code;
        err.silent = isSilent(e);
        throw err;
      });
    };
    global.Auth.mode = global.Auth.configured ? global.Auth.mode : 'firebase';
    global.Auth.googleEnabled = true;
  }

  boot();
})(window);