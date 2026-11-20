// Run with: node --test app/tests/takeoff.test.js
const test = require('node:test');
const assert = require('node:assert');
const T = require('../takeoff.js');
const P = require('../pricing.js');

const S = Object.assign({}, P.DEFAULT_SETTINGS, { laborRate: 50, wallPaintPrice: 40, ceilingPaintPrice: 30, trimPaintPrice: 50, suppliesPct: 10, minimumJob: 0, taxRate: 0, depositPct: 0 });
const ft = T.SCALES.find(s => s.label === '1/8" = 1\'-0"').ftPerPt; // 1 point = 1/9 ft

function job(build) {
  const t = T.newTakeoff(S);
  t.plans = [{ id: 'p1', name: 'A-101.pdf', scales: { 1: { ftPerPt: ft, label: '1/8"' } } }];
  build(t);
  return { id: 'j', mode: 'takeoff', jobType: 'commercial', takeoff: t, extras: [], discount: 0, customer: {}, payments: [] };
}

test('drawing scales: 1/8" = 1\'-0" means one inch on paper (72 points) is 8 feet', () => {
  assert.ok(Math.abs(72 * ft - 8) < 1e-9);
  const metric = T.SCALES.find(s => s.label === '1:100').ftPerPt;
  assert.ok(Math.abs(72 * metric - 100 / 12) < 1e-9, '1:100 → 1 inch = 100 inches');
});

test('geometry: lengths, closed perimeters and polygon areas', () => {
  const sq = [[0, 0], [90, 0], [90, 45], [0, 45]];
  assert.strictEqual(T.pathLength(sq, false), 225);
  assert.strictEqual(T.pathLength(sq, true), 270);
  assert.strictEqual(T.polygonArea(sq), 4050);
});

test('a room outline measures walls (perimeter × height), ceiling (area) and counts doors', () => {
  const j = job(t => {
    const [walls, ceil, doors] = t.systems;
    const room = [[0, 0], [270, 0], [270, 180], [0, 180]]; // 30 ft × 20 ft at 1/8"
    t.marks.push({ id: 'm1', systemId: walls.id, zoneId: t.zones[0].id, kind: 'line', closed: true, planId: 'p1', page: 1, pts: room, h: 10 });
    t.marks.push({ id: 'm2', systemId: ceil.id, zoneId: t.zones[0].id, kind: 'area', planId: 'p1', page: 1, pts: room });
    t.marks.push({ id: 'm3', systemId: doors.id, zoneId: t.zones[0].id, kind: 'count', planId: 'p1', page: 1, pts: [[1, 1], [2, 2], [3, 3]] });
  });
  const c = T.calc(j, S);
  const [w, ce, d] = c.systems;
  assert.ok(Math.abs(w.qty - 1000) < 0.01, '100 ft of wall × 10 ft = 1,000 sq ft, got ' + w.qty);
  assert.ok(Math.abs(w.lf - 100) < 0.01);
  assert.ok(Math.abs(ce.qty - 600) < 0.01, '30 × 20 ceiling');
  assert.strictEqual(d.qty, 3);
  // walls: 1000 sq ft × 2 coats / 250 = 8 hrs → $400 labour; 2000/350 = 5.71 gal → 1 pail + 1 gal
  assert.strictEqual(w.hours, 8);
  assert.strictEqual(w.labor, 400);
  assert.ok(w.paint > 0 && w.supplies === Math.round(w.paint * 10) / 100);
  assert.strictEqual(w.price, Math.round(w.cost * 1.1 * 1.15 * 100) / 100, 'overhead 10% then profit 15%');
});

test('typed totals work without any plan (Adobe/Bluebeam numbers)', () => {
  const j = job(t => {
    t.plans = [];
    t.marks.push({ id: 'a', systemId: t.systems[0].id, kind: 'typed', qty: 4800 });          // sq ft
    t.marks.push({ id: 'b', systemId: t.systems[0].id, kind: 'typed', qty: 120, h: 10 });    // 120 lin ft × 10 ft
    t.marks.push({ id: 'c', systemId: t.systems[0].id, kind: 'typed', qty: 200, deduct: true });
  });
  assert.strictEqual(T.calc(j, S).systems[0].qty, 4800 + 1200 - 200);
});

test('a measurement on a page without a scale is flagged, not guessed', () => {
  const j = job(t => { t.marks.push({ id: 'x', systemId: t.systems[0].id, kind: 'line', planId: 'p1', page: 2, pts: [[0, 0], [100, 0]] }); });
  const w = T.calc(j, S).systems[0];
  assert.strictEqual(w.qty, 0);
  assert.strictEqual(w.noScale, 1);
});

test('unit-price bidding: qty × $/unit, falling back to the hours price when blank', () => {
  const j = job(t => {
    t.method = 'unit';
    t.systems[0].unitPrice = 1.25;
    t.marks.push({ id: 'a', systemId: t.systems[0].id, kind: 'typed', qty: 1000 });
    t.marks.push({ id: 'b', systemId: t.systems[1].id, kind: 'typed', qty: 500 });
  });
  const c = T.calc(j, S);
  assert.strictEqual(c.systems[0].price, 1250);
  assert.strictEqual(c.systems[1].price, c.systems[1].hoursPrice);
  assert.ok(c.systems[0].perUnit > 0, 'shows the hours-based $/sq ft as a check');
});

test('the quote matches calc, splits by area exactly, and adds lift rental with markup', () => {
  const j = job(t => {
    t.zones.push({ id: 'z2', name: 'Level 2' });
    t.marks.push({ id: 'a', systemId: t.systems[0].id, zoneId: t.zones[0].id, kind: 'typed', qty: 3000 });
    t.marks.push({ id: 'b', systemId: t.systems[0].id, zoneId: 'z2', kind: 'typed', qty: 1000 });
    t.adds.push({ id: 'l', label: 'Scissor lift rental', cost: 400 });
    t.alternates.push({ id: 'alt', label: 'Paint stairwell', price: 1800 });
  });
  const c = T.calc(j, S);
  const q = P.calcJob(j, S);
  assert.strictEqual(q.roomsTotal, c.totals.systemsPrice);
  assert.strictEqual(q.extras[0].price, Math.round(400 * 1.1 * 1.15 * 100) / 100);
  assert.strictEqual(q.total, Math.round((c.totals.systemsPrice + q.extras[0].price) * 100) / 100, 'alternates are not in the total');
  j.takeoff.breakdown = 'zone';
  const qz = P.calcJob(j, S);
  assert.deepStrictEqual(qz.rooms.map(r => r.name), ['Level 1', 'Level 2']);
  assert.ok(Math.abs(qz.rooms[0].price - c.systems[0].price * 0.75) < 0.02);
  assert.ok(Math.abs(qz.roomsTotal - q.roomsTotal) < 0.001);
  assert.ok(qz.internal.hours > 0 && qz.internal.profit > 0);
});

test('residential jobs are untouched by takeoff', () => {
  const r = { mode: 'rooms', rooms: [P.newRoom(P.ROOM_TYPES[0])], extras: [], outside: [] };
  r.rooms[0].surfaces = { walls: true };
  assert.ok(P.calcJob(r, S).total > 0);
  assert.strictEqual(P.calcJob(r, S).takeoff, undefined);
});
