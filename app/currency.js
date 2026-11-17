/*
 * Coatwright currency: which money the painter quotes in, and how to show amounts.
 * The currency is picked once (from the phone's region setting) and saved; it never changes by itself,
 * so travelling abroad doesn't change a painter's quotes. They can change it in Settings.
 */
(function (global) {
  'use strict';

  /** Currencies offered in Settings (code, name). */
  var LIST = [
    ['USD', 'US dollar'], ['CAD', 'Canadian dollar'], ['GBP', 'British pound'], ['EUR', 'Euro'],
    ['AUD', 'Australian dollar'], ['NZD', 'New Zealand dollar'], ['ZAR', 'South African rand'],
    ['MXN', 'Mexican peso'], ['INR', 'Indian rupee'], ['AED', 'UAE dirham'], ['SGD', 'Singapore dollar'],
    ['CHF', 'Swiss franc'], ['SEK', 'Swedish krona'], ['NOK', 'Norwegian krone'], ['DKK', 'Danish krone'],
    ['PLN', 'Polish złoty'], ['BRL', 'Brazilian real'], ['PHP', 'Philippine peso'], ['JPY', 'Japanese yen'],
    ['ILS', 'Israeli shekel']
  ];

  var EURO = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
  var BY_REGION = {
    US: 'USD', PR: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', ZA: 'ZAR', MX: 'MXN', IN: 'INR', AE: 'AED',
    SG: 'SGD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', BR: 'BRL', PH: 'PHP', JP: 'JPY', IL: 'ILS'
  };
  EURO.forEach(function (r) { BY_REGION[r] = 'EUR'; });

  /**
   * Approximate value of 1 US dollar in each currency. Only used once, to turn the US starting prices into
   * sensible local ones (or when a painter asks to convert after switching). Prices never follow live rates.
   */
  var PER_USD = {
    USD: 1, CAD: 1.38, GBP: 0.78, EUR: 0.9, AUD: 1.52, NZD: 1.68, ZAR: 18, MXN: 18.5, INR: 85, AED: 3.67,
    SGD: 1.33, CHF: 0.85, SEK: 10, NOK: 10.4, DKK: 6.7, PLN: 3.8, BRL: 5.5, PHP: 57, JPY: 150, ILS: 3.6
  };

  /** Settings that hold money (everything else is %, hours, rates or text). */
  var MONEY_KEYS = ['laborRate', 'minimumJob', 'wallPaintPrice', 'ceilingPaintPrice', 'trimPaintPrice', 'primerPrice',
    'extPaintPrice', 'stainPrice', 'floorPaintPrice', 'epoxySqft', 'flakeSqft', 'cabinetPaintPrice'];

  /** Round to a clean price: two significant figures (42.9 → 43, 351 → 350, 0.78 → 0.78, 4675 → 4700). */
  function nice(v) {
    v = Number(v) || 0;
    if (v <= 0) return 0;
    var mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(Math.round(v / mag) * mag * 100) / 100;
  }

  function factor(from, to) {
    var a = PER_USD[from], b = PER_USD[to];
    return a && b ? b / a : 1;
  }

  /** Convert an amount once (rounded to a clean price). */
  function convert(n, from, to) { return from === to ? Number(n) || 0 : nice((Number(n) || 0) * factor(from, to)); }

  /**
   * Convert a painter's money settings from one currency to another, once. `costFactor` scales the few built-in
   * material costs (patch supplies, lab test) so they follow too. Returns a new settings object.
   */
  function convertSettings(settings, from, to) {
    var out = Object.assign({}, settings);
    if (from === to || !PER_USD[from] || !PER_USD[to]) { out.currency = to; return out; }
    MONEY_KEYS.forEach(function (k) {
      if (out[k] !== '' && out[k] != null && !isNaN(Number(out[k]))) out[k] = convert(out[k], from, to);
    });
    out.costFactor = Math.round((Number(settings.costFactor) || 1) * factor(from, to) * 10000) / 10000;
    out.currency = to;
    return out;
  }

  function known(code) { return LIST.some(function (c) { return c[0] === code; }); }

  /** Pick a currency from the phone's language settings, e.g. ['en-GB'] → 'GBP'. Falls back to USD. */
  function detect(languages) {
    var langs = (languages || []).filter(Boolean);
    for (var i = 0; i < langs.length; i++) {
      var m = String(langs[i]).match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
      if (m && BY_REGION[m[1].toUpperCase()]) return BY_REGION[m[1].toUpperCase()];
    }
    return 'USD';
  }

  var cache = {};
  function formatter(code, decimals, locale) {
    var k = code + decimals + (locale || '');
    if (!cache[k]) {
      // narrowSymbol: "$" not "CA$"/"US$". Painters quote in their own currency, so their customers know which dollar it is.
      var opts = { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' };
      if (code !== 'JPY') { opts.minimumFractionDigits = decimals; opts.maximumFractionDigits = decimals; }
      else { opts.minimumFractionDigits = 0; opts.maximumFractionDigits = 0; }
      try { cache[k] = new Intl.NumberFormat(locale || undefined, opts); }
      catch (e) {
        delete opts.currencyDisplay; // very old browsers
        try { cache[k] = new Intl.NumberFormat(locale || undefined, opts); } catch (e2) { cache[k] = new Intl.NumberFormat('en-US', opts); }
      }
    }
    return cache[k];
  }

  /** Format an amount, e.g. format(-140, 'GBP', 0) → '−£140'. */
  function format(n, code, decimals, locale) {
    var v = Number(n) || 0;
    var d = decimals == null ? 2 : decimals;
    var out = formatter(known(code) ? code : 'USD', d, locale).format(Math.abs(d ? Math.round(v * 100) / 100 : Math.round(v)));
    return (Math.round(Math.abs(v) * (d ? 100 : 1)) && v < 0 ? '−' : '') + out;
  }

  /** The currency sign alone, e.g. '£' or 'CA$'. */
  function symbol(code, locale) {
    var parts = formatter(known(code) ? code : 'USD', 0, locale).formatToParts(1);
    var p = parts.find(function (x) { return x.type === 'currency'; });
    return p ? p.value : '$';
  }

  var api = { LIST: LIST, PER_USD: PER_USD, MONEY_KEYS: MONEY_KEYS, detect: detect, format: format, symbol: symbol, known: known,
    nice: nice, convert: convert, convertSettings: convertSettings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Currency = api;
})(typeof window !== 'undefined' ? window : this);
