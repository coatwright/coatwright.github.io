/*
 * Coatwright accounts on Supabase Auth (email code or Google), using plain fetch (no library).
 * Pure helpers are exported for tests; network calls take the config explicitly.
 */
(function (global) {
  'use strict';

  /** Same rule as the database: lower-case, drop "+tag", ignore dots in Gmail addresses. */
  function normalizeEmail(e) {
    var s = String(e || '').trim().toLowerCase();
    var at = s.lastIndexOf('@');
    if (at < 1) return s;
    var local = s.slice(0, at).split('+')[0], domain = s.slice(at + 1);
    if (domain === 'gmail.com' || domain === 'googlemail.com') return local.replace(/\./g, '') + '@gmail.com';
    return local + '@' + domain;
  }

  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
  }

  /** Read tokens Supabase puts in the address after Google sign-in: #access_token=…&refresh_token=… */
  function parseAuthFragment(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (h.indexOf('access_token=') === -1 && h.indexOf('error') === -1) return null;
    var out = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
    });
    if (out.error || out.error_description) return { error: out.error_description || out.error };
    if (!out.access_token) return null;
    return sessionFrom(out, Date.now());
  }

  /** Normalize a Supabase token response into what the app stores. */
  function sessionFrom(t, now) {
    var expiresIn = Number(t.expires_in) || 3600;
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token || '',
      expiresAt: t.expires_at ? Number(t.expires_at) * 1000 : (now || Date.now()) + expiresIn * 1000,
      user: t.user ? { id: t.user.id, email: t.user.email, name: (t.user.user_metadata || {}).full_name || (t.user.user_metadata || {}).name || '' } : null
    };
  }

  /** True when the access token is missing or will expire within 2 minutes. */
  function needsRefresh(session, now) {
    return !session || !session.accessToken || (Number(session.expiresAt) || 0) - (now || Date.now()) < 120000;
  }

  // ---- Network -----------------------------------------------------------------------------------
  function call(cfg, path, opts) {
    opts = opts || {};
    var headers = { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    return fetch(cfg.supabaseUrl + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.text().then(function (txt) {
          var json = null;
          try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = null; }
          if (!r.ok) {
            var msg = (json && (json.msg || json.error_description || json.message || json.error)) || ('Error ' + r.status);
            var err = new Error(msg); err.status = r.status; throw err;
          }
          return json;
        });
      });
  }

  /** Email a 6-digit code (creates the account the first time). */
  function sendCode(cfg, email, redirectTo) {
    return call(cfg, '/auth/v1/otp' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''),
      { method: 'POST', body: { email: String(email).trim(), create_user: true } });
  }

  /** Check the code; returns a session. */
  function verifyCode(cfg, email, code) {
    return call(cfg, '/auth/v1/verify', { method: 'POST', body: { type: 'email', email: String(email).trim(), token: String(code).replace(/\D/g, '') } })
      .then(function (t) { return sessionFrom(t, Date.now()); });
  }

  function refresh(cfg, session) {
    return call(cfg, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refreshToken } })
      .then(function (t) { return sessionFrom(t, Date.now()); });
  }

  function getUser(cfg, session) {
    return call(cfg, '/auth/v1/user', { token: session.accessToken }).then(function (u) {
      return { id: u.id, email: u.email, name: (u.user_metadata || {}).full_name || (u.user_metadata || {}).name || '' };
    });
  }

  /** The account's profile row (trial start). The database only lets users read their own. */
  function getProfile(cfg, session) {
    return call(cfg, '/rest/v1/profiles?select=email,full_name,trial_started_at&limit=1', { token: session.accessToken })
      .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
  }

  /** The account's subscriptions (filled by Stripe through our webhook). Users can only read their own. */
  function getSubscriptions(cfg, session) {
    return call(cfg, '/rest/v1/subscriptions?select=status,plan,current_period_end,cancel_at_period_end,founder_number,updated_at&order=updated_at.desc&limit=5',
      { token: session.accessToken });
  }

  /** Complimentary access row for this account (owner, demos, testers). Empty when none. */
  function getComp(cfg, session) {
    return call(cfg, '/rest/v1/comp_access?select=note&limit=1', { token: session.accessToken })
      .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
  }

  /** How many founding-member spots are left (public). */
  function founderSpotsLeft(cfg) {
    return call(cfg, '/rest/v1/rpc/founder_spots_left', { method: 'POST', body: {} }).then(function (n) { return Number(n); });
  }

  function signOut(cfg, session) {
    if (!session || !session.accessToken) return Promise.resolve();
    return call(cfg, '/auth/v1/logout', { method: 'POST', token: session.accessToken }).catch(function () {});
  }

  function googleUrl(cfg, redirectTo) {
    return cfg.supabaseUrl + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectTo);
  }

  var api = {
    normalizeEmail: normalizeEmail, validEmail: validEmail, parseAuthFragment: parseAuthFragment, sessionFrom: sessionFrom,
    needsRefresh: needsRefresh, sendCode: sendCode, verifyCode: verifyCode, refresh: refresh, getUser: getUser,
    getProfile: getProfile, getSubscriptions: getSubscriptions, getComp: getComp, founderSpotsLeft: founderSpotsLeft, signOut: signOut, googleUrl: googleUrl
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Account = api;
})(typeof window !== 'undefined' ? window : this);
