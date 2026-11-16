/*
 * Coatwright subscriptions: free trial, plans and Stripe subscription status.
 * Payments run on Stripe (Managed Payments). After checkout, Stripe tells our database (supabase/functions/stripe-webhook)
 * and the app reads the account's subscription. The decision logic is pure so it can be tested in Node.
 */
(function (global) {
  'use strict';

  // ---- Settings the owner changes when payments go live ------------------------------
  var BILLING = {
    // Off until Stripe is set up. While off, the app is fully usable and nobody is charged.
    enabled: true,
    // 'YYYY-MM-DD' when billing was switched on. Everyone's trial counts from this day at the earliest.
    startDate: '2026-11-15',
    trialDays: 14,
    // How long a paid subscription keeps working offline before it must be re-checked online.
    graceDays: 7,
    prices: { founder: 12, monthly: 24, annual: 199 },
    founderSpots: 100,
    // Stripe Payment Links (Dashboard → Payment Links). Founders use the monthly link with the FOUNDER code.
    checkout: { monthly: 'https://buy.stripe.com/5kQfZic4D4xqapLfTl63K00', annual: 'https://buy.stripe.com/3cIcN69WvbZSgO922v63K01' },
    founderCode: 'FOUNDER',
    // Stripe customer portal login link (Settings → Billing → Customer portal), where people manage or cancel.
    portal: 'https://billing.stripe.com/p/login/5kQfZic4D4xqapLfTl63K00'
  };

  var DAY = 864e5;

  function dateTs(iso) {
    if (!iso) return 0;
    var t = new Date(iso + 'T00:00:00').getTime();
    return isFinite(t) ? t : 0;
  }

  /**
   * When the free trial ends: trialDays calendar days after the later of the user's start and the
   * billing start date, at the same local clock time (so daylight-saving changes don't shift it).
   */
  function trialEnds(settings, cfg) {
    cfg = cfg || BILLING;
    var start = Math.max(Number(settings && settings.trialStart) || 0, dateTs(cfg.startDate));
    var d = new Date(start);
    d.setDate(d.getDate() + (Number(cfg.trialDays) || 14));
    return d.getTime();
  }

  /** Whole local calendar days between two moments (independent of DST and time zone). */
  function dayIndex(ts) {
    var d = new Date(ts);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  }

  /**
   * What the user can do right now.
   *   free    – billing switched off: everything works
   *   active  – paid subscription confirmed recently
   *   recheck – paid, but not confirmed online for longer than the grace period
   *   trial   – free trial running
   *   expired – trial over and no subscription: view and export only
   */
  var LIVE = { active: 1, trialing: 1, past_due: 1 };

  /** Pick the subscription that matters from the account's rows (newest live one, else newest). */
  function subFromRows(rows, now) {
    rows = (rows || []).filter(Boolean);
    if (!rows.length) return null;
    var live = rows.filter(function (r) { return LIVE[r.status]; });
    var r = (live.length ? live : rows).slice().sort(function (a, b) {
      return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
    })[0];
    return {
      status: r.status || '',
      plan: r.plan || '',
      periodEnd: Date.parse(r.current_period_end) || 0,
      cancelAtEnd: !!r.cancel_at_period_end,
      founderNumber: r.founder_number || null,
      checkedAt: now || Date.now()
    };
  }

  function accessState(settings, now, cfg) {
    cfg = cfg || BILLING;
    now = now || Date.now();
    if (!cfg.enabled) return { mode: 'free', canCreate: true };
    var sub = settings && settings.sub;
    var grace = (Number(cfg.graceDays) || 7) * DAY;
    var comp = settings && settings.comp;
    if (comp && now - (Number(comp.checkedAt) || 0) <= 4 * grace) {
      return { mode: 'active', canCreate: true, plan: 'comp', comp: comp.note || 'Complimentary', renews: 0, cancelAtEnd: false, founderNumber: null, pastDue: false };
    }
    if (sub && LIVE[sub.status] && (!sub.periodEnd || now <= sub.periodEnd + grace)) {
      var info = { plan: sub.plan || 'monthly', renews: sub.periodEnd || 0, cancelAtEnd: !!sub.cancelAtEnd,
        founderNumber: sub.founderNumber || null, pastDue: sub.status === 'past_due' };
      var fresh = now - (Number(sub.checkedAt) || 0) <= grace;
      return Object.assign({ mode: fresh ? 'active' : 'recheck', canCreate: fresh }, info);
    }
    var end = trialEnds(settings, cfg);
    if (now < end) return { mode: 'trial', canCreate: true, daysLeft: Math.max(1, dayIndex(end) - dayIndex(now)), ends: end };
    return { mode: 'expired', canCreate: false, ended: end, lapsed: !!(sub && sub.status) };
  }

  function addParams(url, params) {
    var q = Object.keys(params).filter(function (k) { return params[k]; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return q ? url + (url.indexOf('?') === -1 ? '?' : '&') + q : url;
  }

  /** Checkout link for a plan, tied to the signed-in account so the app unlocks by itself. '' when not set up. */
  function checkoutUrl(cfg, plan, account) {
    cfg = cfg || BILLING;
    var base = plan === 'founder' ? cfg.checkout.monthly : cfg.checkout[plan];
    if (!base || !account || !account.id) return '';
    return addParams(base, {
      client_reference_id: account.id,
      prefilled_email: account.email || '',
      prefilled_promo_code: plan === 'founder' ? cfg.founderCode : ''
    });
  }

  /** Where a subscriber manages or cancels (email filled in). */
  function portalUrl(cfg, email) {
    cfg = cfg || BILLING;
    return cfg.portal ? addParams(cfg.portal, { prefilled_email: email || '' }) : '';
  }

  function planName(plan) {
    return plan === 'comp' ? 'Complimentary' : plan === 'founder' ? 'Founding member' : plan === 'annual' ? 'Yearly' : 'Monthly';
  }

  /** What the plan costs each renewal, e.g. { amount: 24, unit: '/mo' }. */
  function planPrice(cfg, plan) {
    cfg = cfg || BILLING;
    return plan === 'annual' ? { amount: cfg.prices.annual, unit: '/yr' } : { amount: plan === 'founder' ? cfg.prices.founder : cfg.prices.monthly, unit: '/mo' };
  }

  /**
   * Trial reminder to show now: 7, 3 or 1 (days left), or 0 for none.
   * `lastShown` is the last reminder the user saw, so each one appears once and a skipped one isn't repeated.
   */
  function trialReminder(state, lastShown) {
    if (!state || state.mode !== 'trial') return 0;
    var d = state.daysLeft, stage = d <= 1 ? 1 : d <= 3 ? 3 : d <= 7 ? 7 : 0;
    var last = Number(lastShown) || 0;
    return stage && (!last || stage < last) ? stage : 0;
  }

  /** Annual price per month and savings versus paying monthly, for the pricing cards. */
  function annualDeal(cfg) {
    cfg = cfg || BILLING;
    var m = cfg.prices.monthly, a = cfg.prices.annual;
    return { perMonth: Math.round(a / 12 * 100) / 100, savePct: Math.round((1 - a / (m * 12)) * 100) };
  }

  var api = { BILLING: BILLING, trialEnds: trialEnds, accessState: accessState, subFromRows: subFromRows, checkoutUrl: checkoutUrl,
    portalUrl: portalUrl, planName: planName, planPrice: planPrice, trialReminder: trialReminder, annualDeal: annualDeal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Billing = api;
})(typeof window !== 'undefined' ? window : this);
