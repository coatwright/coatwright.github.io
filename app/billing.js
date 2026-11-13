/*
 * Coatwright subscriptions: free trial, plans and license-key checks (Lemon Squeezy).
 * The decision logic is pure so it can be tested in Node.
 */
(function (global) {
  'use strict';

  // ---- Settings the owner changes when payments go live ------------------------------
  var BILLING = {
    // Off until the Lemon Squeezy store and checkout links exist. While off, the app is fully usable.
    enabled: false,
    // 'YYYY-MM-DD' when billing was switched on. Everyone's trial counts from this day at the earliest.
    startDate: '',
    trialDays: 14,
    // How long a paid subscription keeps working offline before it must be re-checked online.
    graceDays: 7,
    prices: { founder: 14, monthly: 24, annual: 199 },
    founderSpots: 100,
    // Lemon Squeezy checkout links (Store → Products → Share).
    checkout: { founder: '', monthly: '', annual: '' },
    // Optional: only accept license keys from this store/product (numbers from Lemon Squeezy).
    storeId: null,
    productId: null,
    // Where customers manage or cancel their subscription.
    portal: 'https://app.lemonsqueezy.com/my-orders',
    api: 'https://api.lemonsqueezy.com/v1/licenses/'
  };

  var DAY = 864e5;

  function dateTs(iso) {
    if (!iso) return 0;
    var t = new Date(iso + 'T00:00:00').getTime();
    return isFinite(t) ? t : 0;
  }

  /** When the free trial ends: trialDays after the later of the user's start and the billing start date. */
  function trialEnds(settings, cfg) {
    cfg = cfg || BILLING;
    var start = Math.max(Number(settings && settings.trialStart) || 0, dateTs(cfg.startDate));
    return start + (Number(cfg.trialDays) || 14) * DAY;
  }

  /**
   * What the user can do right now.
   *   free    – billing switched off: everything works
   *   active  – paid subscription confirmed recently
   *   recheck – paid, but not confirmed online for longer than the grace period
   *   trial   – free trial running
   *   expired – trial over and no subscription: view and export only
   */
  function accessState(settings, now, cfg) {
    cfg = cfg || BILLING;
    now = now || Date.now();
    if (!cfg.enabled) return { mode: 'free', canCreate: true };
    var lic = settings && settings.license;
    if (lic && lic.status === 'active') {
      var fresh = now - (Number(lic.checkedAt) || 0) <= (Number(cfg.graceDays) || 7) * DAY;
      return fresh ? { mode: 'active', canCreate: true, plan: lic.plan || 'Pro' }
        : { mode: 'recheck', canCreate: false, plan: lic.plan || 'Pro' };
    }
    var end = trialEnds(settings, cfg);
    if (now < end) return { mode: 'trial', canCreate: true, daysLeft: Math.max(1, Math.ceil((end - now) / DAY)), ends: end };
    return { mode: 'expired', canCreate: false, ended: end, licenseProblem: lic && lic.status ? lic.status : null };
  }

  /** Turn a Lemon Squeezy activate/validate response into what the app stores. */
  function licenseFromResponse(json, key, now, cfg) {
    cfg = cfg || BILLING;
    json = json || {};
    var lk = json.license_key || {};
    var meta = json.meta || {};
    var wrongProduct = (cfg.storeId && meta.store_id && Number(meta.store_id) !== Number(cfg.storeId)) ||
      (cfg.productId && meta.product_id && Number(meta.product_id) !== Number(cfg.productId));
    var ok = (json.valid === true || json.activated === true) && lk.status === 'active' && !wrongProduct;
    return {
      key: key,
      instanceId: (json.instance && json.instance.id) || null,
      status: wrongProduct ? 'wrong-product' : ok ? 'active' : (lk.status || 'invalid'),
      plan: meta.variant_name || '',
      email: meta.customer_email || '',
      checkedAt: now || Date.now(),
      error: ok ? '' : (json.error || (wrongProduct ? 'This key is for a different product.' : 'This license key is not active.'))
    };
  }

  /** Annual price per month and savings versus paying monthly, for the pricing cards. */
  function annualDeal(cfg) {
    cfg = cfg || BILLING;
    var m = cfg.prices.monthly, a = cfg.prices.annual;
    return { perMonth: Math.round(a / 12 * 100) / 100, savePct: Math.round((1 - a / (m * 12)) * 100) };
  }

  var api = { BILLING: BILLING, trialEnds: trialEnds, accessState: accessState, licenseFromResponse: licenseFromResponse, annualDeal: annualDeal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Billing = api;
})(typeof window !== 'undefined' ? window : this);
