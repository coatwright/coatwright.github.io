// Run with: node --test app/tests/units.test.js
const test = require('node:test');
const assert = require('node:assert');
const U = require('../units.js');
const P = require('../pricing.js');

test('conversions round-trip: what you type in metric is what you see again', () => {
  for (const [kind, v] of [['len', 3.5], ['area', 50.2], ['vol', 3.78], ['coverArea', 8.6], ['perVol', 11.9], ['rateArea', 16.3]]) {
    const stored = U.fromDisp(kind, v, true);
    assert.strictEqual(U.toDisp(kind, stored, true), v, kind);
  }
  assert.strictEqual(U.toDisp('len', 10, false), 10, 'imperial unchanged');
  assert.strictEqual(U.fromDisp('len', '', true), '', 'blank stays blank');
  assert.ok(Math.abs(U.fromDisp('len', 1, true) - 3.28084) < 1e-4);
});

test('metric text: areas, lengths, room sizes, ceilings and paint cans', () => {
  assert.strictEqual(U.text('540 sq ft · 2 coats', true), '50.2 m² · 2 coats');
  assert.strictEqual(U.text('1,200 sq ft (est.)', true), '111 m² (est.)');
  assert.strictEqual(U.text('48 linear ft · 2 coats', true), '14.6 m · 2 coats');
  assert.strictEqual(U.text('12×14 ft, 9 ft ceilings', true), '3.7×4.3 m, 2.7 m ceilings');
  assert.strictEqual(U.text('1 × 5-gal pail + 2 gal + 1 qt', true), '1 × 18.9 L pail + 2 × 3.78 L + 1 × 0.95 L (≈ 27.4 L)');
  assert.strictEqual(U.text('540 sq ft', false), '540 sq ft', 'imperial untouched');
});

test('lengths: typing and showing feet or metres', () => {
  assert.strictEqual(U.lengthText(12.5, false), '12′ 6″');
  assert.strictEqual(U.lengthText(10, true), '3.05 m');
  assert.ok(Math.abs(U.parseLength('3.6', true) - 3.6 / 0.3048) < 1e-9);
  assert.ok(Math.abs(U.parseLength('360 cm', true) - 3.6 / 0.3048) < 1e-9);
  assert.strictEqual(U.parseLength("12'6", false), 12.5);
});

test('a job costs exactly the same in metric; only the words change', () => {
  const S = Object.assign({}, P.DEFAULT_SETTINGS, { minimumJob: 0 });
  const job = { mode: 'rooms', rooms: [P.newRoom(P.ROOM_TYPES[0])], extras: [], outside: [], paintByOrder: true, paintPrices: {} };
  job.rooms[0].surfaces = { walls: true, ceiling: true, trim: true };
  const imp = P.calcJob(job, S), met = P.calcJob(job, Object.assign({}, S, { units: 'metric' }));
  assert.strictEqual(met.total, imp.total);
  assert.strictEqual(met.internal.hours, imp.internal.hours);
  assert.ok(/sq ft/.test(imp.rooms[0].lines[0].detail));
  assert.ok(/m²/.test(met.rooms[0].lines[0].detail) && !/sq ft/.test(met.rooms[0].lines[0].detail));
  assert.ok(/ m,/.test(met.rooms[0].summary) || / m /.test(met.rooms[0].summary), met.rooms[0].summary);
});

test('default units: metric only for new painters in metric countries', () => {
  assert.strictEqual(U.defaultUnits('CAD', true), 'metric');
  assert.strictEqual(U.defaultUnits('GBP', true), 'metric');
  assert.strictEqual(U.defaultUnits('USD', true), 'imperial');
  assert.strictEqual(U.defaultUnits('CAD', false), 'imperial', 'existing painters keep what they have');
});
