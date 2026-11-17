// Run with: node --test app/tests/currency.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../currency.js');

test('picks the currency from the phone region, once', () => {
  assert.strictEqual(C.detect(['en-US']), 'USD');
  assert.strictEqual(C.detect(['en-GB', 'en']), 'GBP');
  assert.strictEqual(C.detect(['en-CA']), 'CAD');
  assert.strictEqual(C.detect(['fr-CA']), 'CAD');
  assert.strictEqual(C.detect(['en-AU']), 'AUD');
  assert.strictEqual(C.detect(['de-DE']), 'EUR');
  assert.strictEqual(C.detect(['en-IE']), 'EUR');
  assert.strictEqual(C.detect(['zh-Hant-TW', 'en-NZ']), 'NZD', 'skips regions it does not know');
  assert.strictEqual(C.detect(['en']), 'USD', 'no region: dollars');
  assert.strictEqual(C.detect([]), 'USD');
});

test('formats amounts with the right sign and decimals', () => {
  assert.strictEqual(C.format(1234.5, 'USD', 2, 'en-US'), '$1,234.50');
  assert.strictEqual(C.format(1234.5, 'USD', 0, 'en-US'), '$1,235');
  assert.strictEqual(C.format(-140, 'GBP', 0, 'en-GB'), '−£140');
  assert.strictEqual(C.format(-0.001, 'USD', 2, 'en-US'), '$0.00', 'no minus on zero');
  assert.strictEqual(C.format(99.5, 'EUR', 2, 'de-DE'), '99,50 €');
  assert.ok(/^[¥￥]5,000$/.test(C.format(5000, 'JPY', 2, 'ja-JP')));
  assert.strictEqual(C.format(10, 'XXX', 2, 'en-US'), '$10.00', 'unknown code falls back to dollars');
});

test('currency sign for input fields', () => {
  assert.strictEqual(C.symbol('USD', 'en-US'), '$');
  assert.strictEqual(C.symbol('GBP', 'en-GB'), '£');
  assert.strictEqual(C.symbol('CAD', 'en-CA'), '$');
  assert.strictEqual(C.symbol('CAD', 'en-US'), '$', 'no CA$ on Canadian painters\' quotes, whatever the phone language');
  assert.strictEqual(C.format(1234.5, 'CAD', 2, 'en-US'), '$1,234.50');
});

test('starting prices are converted once and rounded to clean numbers', () => {
  assert.strictEqual(C.nice(42.9), 43);
  assert.strictEqual(C.nice(351), 350);
  assert.strictEqual(C.nice(0.78), 0.78);
  assert.strictEqual(C.nice(4675), 4700);
  assert.strictEqual(C.convert(55, 'USD', 'GBP'), 43);
  assert.strictEqual(C.convert(55, 'USD', 'USD'), 55);
  const s = C.convertSettings({ laborRate: 55, minimumJob: 450, wallPaintPrice: 45, markup: 25, coverage: 350, epoxySqft: 1 }, 'USD', 'GBP');
  assert.strictEqual(s.currency, 'GBP');
  assert.strictEqual(s.laborRate, 43);
  assert.strictEqual(s.minimumJob, 350);
  assert.strictEqual(s.wallPaintPrice, 35);
  assert.strictEqual(s.epoxySqft, 0.78);
  assert.strictEqual(s.markup, 25, 'percentages are not money');
  assert.strictEqual(s.coverage, 350, 'production rates are not money');
  assert.strictEqual(s.costFactor, 0.78);
  const back = C.convertSettings(s, 'GBP', 'USD');
  assert.ok(Math.abs(back.laborRate - 55) <= 1, 'converting back lands close to the original');
  assert.strictEqual(back.costFactor, 1);
  const same = C.convertSettings({ laborRate: 55 }, 'USD', 'USD');
  assert.strictEqual(same.laborRate, 55);
  assert.strictEqual(same.costFactor, undefined, 'dollars need no factor');
});
