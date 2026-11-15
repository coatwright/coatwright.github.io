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
      var opts = { style: 'currency', currency: code };
      if (code !== 'JPY') { opts.minimumFractionDigits = decimals; opts.maximumFractionDigits = decimals; }
      else { opts.minimumFractionDigits = 0; opts.maximumFractionDigits = 0; }
      try { cache[k] = new Intl.NumberFormat(locale || undefined, opts); }
      catch (e) { cache[k] = new Intl.NumberFormat('en-US', opts); }
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

  var api = { LIST: LIST, detect: detect, format: format, symbol: symbol, known: known };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Currency = api;
})(typeof window !== 'undefined' ? window : this);
