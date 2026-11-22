/*
 * Coatwright units: feet & gallons (imperial) or metres & litres (metric).
 * The pricing maths always runs in feet and gallons, so a job costs exactly the same either way;
 * this file converts numbers and text on the way to and from the screen. Pure functions (tested in Node).
 */
(function (global) {
  'use strict';

  var FT = 0.3048, SQFT = 0.09290304, GAL = 3.785411784;

  // display value = stored value × f (metric). dp = decimals shown in metric.
  var KINDS = {
    len: { imp: 'ft', met: 'm', f: FT, dp: 2 },
    area: { imp: 'sq ft', met: 'm²', f: SQFT, dp: 1 },
    vol: { imp: 'gal', met: 'L', f: GAL, dp: 2 },
    rateArea: { imp: 'sq ft/hr', met: 'm²/hr', f: SQFT, dp: 1 },
    rateLen: { imp: 'ft/hr', met: 'm/hr', f: FT, dp: 1 },
    coverArea: { imp: 'sq ft/gal', met: 'm²/L', f: SQFT / GAL, dp: 2 },
    coverLen: { imp: 'lin ft/gal', met: 'm/L', f: FT / GAL, dp: 2 },
    perVol: { imp: '/gal', met: '/L', f: 1 / GAL, dp: 2 },
    perArea: { imp: '/sq ft', met: '/m²', f: 1 / SQFT, dp: 2 },
    perLen: { imp: '/lin ft', met: '/m', f: 1 / FT, dp: 2 }
  };

  /** Currencies whose painters mostly work in metric (used to pick the default for new painters only). */
  var METRIC_CURRENCIES = ['CAD', 'GBP', 'AUD', 'NZD', 'EUR'];

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function roundTo(n, dp) { var p = Math.pow(10, dp); return Math.round(n * p) / p; }
  function isMetric(settings) { return !!(settings && settings.units === 'metric'); }

  /** Stored (imperial) → what the painter sees. Blank stays blank. */
  function toDisp(kind, v, metric) {
    if (v === '' || v == null) return '';
    var k = KINDS[kind];
    if (!metric || !k) return v;
    return roundTo(num(v) * k.f, k.dp);
  }
  /** What the painter typed → stored (imperial). */
  function fromDisp(kind, v, metric) {
    if (v === '' || v == null) return '';
    var k = KINDS[kind];
    if (!metric || !k) return num(v);
    return num(v) / k.f;
  }
  function label(kind, metric) { var k = KINDS[kind]; return k ? (metric ? k.met : k.imp) : ''; }

  function fmtNum(n, dp) {
    return roundTo(n, dp).toLocaleString('en-US', { maximumFractionDigits: dp });
  }
  /** "540 sq ft" or "50.2 m²" */
  function fmt(kind, v, metric, dpImp) {
    var k = KINDS[kind];
    if (!metric) return fmtNum(num(v), dpImp || 0) + ' ' + k.imp;
    var d = num(v) * k.f;
    return fmtNum(d, Math.abs(d) >= 100 && k.dp > 0 ? 0 : k.dp) + ' ' + k.met;
  }
  /** Feet as 12′ 6″, or metres as 3.81 m */
  function lengthText(ft, metric) {
    if (metric) return fmtNum(num(ft) * FT, 2) + ' m';
    var neg = ft < 0, a = Math.abs(ft), f = Math.floor(a), inch = Math.round((a - f) * 12);
    if (inch === 12) { f++; inch = 0; }
    return (neg ? '−' : '') + f + '′' + (inch ? ' ' + inch + '″' : '');
  }
  /** "12", "12.5", "12'6", "12 ft 6 in" → feet; in metric "3.6", "3.6 m", "360 cm" → feet */
  function parseLength(s, metric) {
    var str = String(s || '').trim().toLowerCase();
    if (metric) {
      var mm = str.replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(m|cm|mm)?$/);
      if (!mm) return 0;
      var v = parseFloat(mm[1]) / (mm[2] === 'cm' ? 100 : mm[2] === 'mm' ? 1000 : 1);
      return v / FT;
    }
    var m = str.replace(/ft|feet/g, "'").replace(/in(ches)?/g, '"').match(/^(\d+(?:\.\d+)?)\s*'?\s*(?:-?\s*(\d+(?:\.\d+)?)\s*"?)?$/);
    if (!m) return 0;
    return parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0);
  }

  /** "2 × 5-gal pails + 1 gal + 2 qt" → "2 × 18.9 L pails + 1 × 3.78 L + 2 × 0.95 L (≈ 43.5 L)" */
  function containersText(text) {
    if (!text) return text;
    var litres = 0;
    var out = String(text).replace(/(\d+) × 5-gal pails?/g, function (_, n) { litres += n * 5 * GAL; return n + ' × 18.9 L pail' + (n > 1 ? 's' : ''); })
      .replace(/(\d+) gal\b/g, function (_, n) { litres += n * GAL; return n + ' × 3.78 L'; })
      .replace(/(\d+) qt\b/g, function (_, n) { litres += n * GAL / 4; return n + ' × 0.95 L'; });
    return litres ? out + ' (≈ ' + fmtNum(litres, litres >= 100 ? 0 : 1) + ' L)' : out;
  }

  /** Convert the measurement words in a line of quote text to metric. */
  function text(str, metric) {
    if (!metric || str == null) return str;
    var n = function (s) { return parseFloat(String(s).replace(/,/g, '')); };
    var s = String(str);
    if (/× 5-gal pail| gal\b| qt\b/.test(s) && !/sq ft|linear ft|lin ft/.test(s)) s = containersText(s);
    return s
      .replace(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?) ft/g, function (_, a, b) { return fmtNum(n(a) * FT, 1) + '×' + fmtNum(n(b) * FT, 1) + ' m'; })
      .replace(/(\d[\d,]*(?:\.\d+)?) sq ft/g, function (_, a) { return fmt('area', n(a), true); })
      .replace(/(\d[\d,]*(?:\.\d+)?) (?:linear|lin) ft/g, function (_, a) { return fmtNum(n(a) * FT, 1) + ' m'; })
      .replace(/(\d[\d,]*(?:\.\d+)?) ft of railing/g, function (_, a) { return fmtNum(n(a) * FT, 1) + ' m of railing'; })
      .replace(/(\d+(?:\.\d+)?) ft ceilings/g, function (_, a) { return fmtNum(n(a) * FT, 1) + ' m ceilings'; })
      .replace(/(\d+(?:\.\d+)?)(\+)? ft\b/g, function (_, a, plus) { return fmtNum(n(a) * FT, 1) + (plus || '') + ' m'; });
  }

  /** A whole calcJob result with its text in metric (numbers unchanged). */
  function metricize(q) {
    var conv = function (x) { return text(x, true); };
    (q.rooms || []).concat(q.outside || []).forEach(function (r) {
      r.summary = conv(r.summary);
      (r.lines || []).forEach(function (l) { l.detail = conv(l.detail); });
    });
    (q.materials || []).forEach(function (m) { m.detail = conv(m.detail); });
    q.units = 'metric';
    return q;
  }

  /** Default for a painter who hasn't chosen: metric only for brand-new painters in metric countries. */
  function defaultUnits(currency, isNewPainter) {
    return isNewPainter && METRIC_CURRENCIES.indexOf(currency) !== -1 ? 'metric' : 'imperial';
  }

  var api = { FT: FT, SQFT: SQFT, GAL: GAL, KINDS: KINDS, METRIC_CURRENCIES: METRIC_CURRENCIES, isMetric: isMetric,
    toDisp: toDisp, fromDisp: fromDisp, label: label, fmt: fmt, lengthText: lengthText, parseLength: parseLength,
    containersText: containersText, text: text, metricize: metricize, defaultUnits: defaultUnits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Units = api;
})(typeof window !== 'undefined' ? window : this);
