// Run with: node --test app/tests/pricing.test.js
const test = require('node:test');
const assert = require('node:assert');
const P = require('../pricing.js');

const settings = Object.assign({}, P.DEFAULT_SETTINGS, {
  laborRate: 50, markup: 20, minimumJob: 0, taxRate: 0, suppliesPct: 10,
  wallRate: 200, ceilingRate: 100, trimRate: 50, coverage: 400, setupHours: 0
});

test('wall area subtracts doors and windows', () => {
  const room = { length: 12, width: 12, height: 8, doors: 1, windows: 2, coats: 2,
    condition: 'good', surfaces: { walls: true } };
  const r = P.calcRoom(room, settings);
  // 2*(12+12)*8 = 384 - 20 - 30 = 334
  assert.strictEqual(r.wallArea, 334);
  // 334 * 2 coats / 200 = 3.34 hrs * $50
  assert.strictEqual(r.hours, 3.34);
  assert.strictEqual(r.laborCost, 167);
});

test('poor condition adds priming and slower labor', () => {
  const base = { length: 10, width: 10, height: 8, doors: 0, windows: 0, coats: 2, surfaces: { walls: true } };
  const good = P.calcRoom(Object.assign({}, base, { condition: 'good' }), settings);
  const poor = P.calcRoom(Object.assign({}, base, { condition: 'poor' }), settings);
  assert.ok(poor.hours > good.hours * 1.35);
  assert.ok(poor.lines.some(l => l.key === 'primer'));
  assert.ok(poor.gallons.primer > 0);
});

test('high ceilings cost more', () => {
  const base = { length: 12, width: 12, doors: 0, windows: 0, coats: 2, surfaces: { walls: true } };
  const low = P.calcRoom(Object.assign({}, base, { height: 8 }), settings);
  const high = P.calcRoom(Object.assign({}, base, { height: 10 }), settings);
  assert.ok(high.hours / high.wallArea > low.hours / low.wallArea);
});

test('job totals: markup, whole gallons, extras, discount, tax, deposit', () => {
  const job = {
    rooms: [{ length: 12, width: 12, height: 8, doors: 1, windows: 2, coats: 2,
      condition: 'good', surfaces: { walls: true } }],
    extras: [{ label: 'Drywall repair', price: 100 }],
    discount: 50
  };
  const q = P.calcJob(job, Object.assign({}, settings, { taxRate: 10, depositPct: 50 }));
  // labor 167 * 1.2 = 200.40
  assert.strictEqual(q.roomsTotal, 200.4);
  // 334*2/400 = 1.67 gal -> 2 gallons * $45 = 90, supplies 9 -> (99)*1.2 = 118.80
  assert.strictEqual(q.materials[0].qty, 2);
  assert.strictEqual(q.materialsTotal, 118.8);
  assert.strictEqual(q.subtotal, 419.2);
  assert.strictEqual(q.discount, 50);
  assert.strictEqual(q.tax, 36.92);
  assert.strictEqual(q.total, 406.12);
  assert.strictEqual(q.deposit, 203.06);
  assert.strictEqual(q.internal.cost, 266);
});

test('minimum job charge kicks in for tiny jobs', () => {
  const job = { rooms: [{ length: 5, width: 5, height: 8, doors: 0, windows: 0, coats: 1,
    condition: 'good', surfaces: { walls: true } }] };
  const q = P.calcJob(job, Object.assign({}, settings, { minimumJob: 500 }));
  assert.ok(q.minimumAdj > 0);
  assert.strictEqual(q.total, 500);
});

test('empty job is $0 and never NaN', () => {
  const q = P.calcJob({ rooms: [] }, settings);
  assert.strictEqual(q.total, 0);
  const q2 = P.calcJob({ rooms: [{ length: 'abc', width: '', surfaces: { walls: true } }] }, settings);
  assert.ok(Number.isFinite(q2.total));
});

test('residential offers house, townhouse and condo', () => {
  const ids = P.JOB_TYPES.residential.properties.map(p => p.id);
  assert.deepStrictEqual(ids, ['house', 'townhouse', 'condo']);
  assert.ok(P.JOB_TYPES.commercial.properties.length > 0);
});

test('room presets and labels follow the job type', () => {
  assert.strictEqual(P.roomTypesFor('residential'), P.ROOM_TYPES);
  assert.strictEqual(P.roomTypesFor(undefined), P.ROOM_TYPES);
  const office = P.roomTypesFor('commercial', 'office');
  assert.strictEqual(office[0].name, 'Office');
  assert.strictEqual(P.newRoom(office[0]).height, 9);
  assert.strictEqual(P.propertyLabel({ jobType: 'residential', propertyType: 'condo' }), 'Residential · Condo');
  assert.strictEqual(P.propertyLabel({}), '');
});

test('quick estimate turns square footage into a realistic wall area', () => {
  const q = Object.assign(P.newQuick(), { sqft: 2000 });
  const c = P.calcQuick(q, settings, 'residential');
  // Rule of thumb: interior wall area is roughly 2.5–3.5x the floor area
  assert.ok(c.wallArea > 2000 * 2.2 && c.wallArea < 2000 * 3.5, 'wall area ' + c.wallArea);
  assert.ok(c.lines.some(l => l.key === 'walls'));
  // Bigger home costs more, roughly in proportion
  const big = P.calcQuick(Object.assign(P.newQuick(), { sqft: 4000 }), settings, 'residential');
  assert.ok(big.laborCost > c.laborCost * 1.8 && big.laborCost < c.laborCost * 2.2);
});

test('quick mode prices the whole home and ignores room-by-room entries', () => {
  const job = { mode: 'quick', jobType: 'residential', quick: Object.assign(P.newQuick(), { sqft: 1500 }),
    rooms: [P.newRoom(P.ROOM_TYPES[1])] };
  const q = P.calcJob(job, settings);
  assert.strictEqual(q.quick, true);
  assert.strictEqual(q.rooms.length, 1);
  assert.strictEqual(q.rooms[0].name, 'Whole home');
  assert.ok(q.total > 0 && q.materials.length > 0);
  // Empty square footage = $0, no NaN
  const empty = P.calcJob({ mode: 'quick', quick: P.newQuick() }, settings);
  assert.strictEqual(empty.total, 0);
});

test('commercial covers every kind of business, each with its common areas first', () => {
  const props = P.JOB_TYPES.commercial.properties;
  assert.ok(props.length >= 12);
  const allIds = P.COMMERCIAL_AREAS.map(a => a.id);
  props.forEach(p => {
    const list = P.roomTypesFor('commercial', p.id);
    // every area is offered exactly once, the property's own areas first
    assert.strictEqual(list.length, P.COMMERCIAL_AREAS.length, p.id);
    assert.deepStrictEqual(list.map(a => a.id).sort(), allIds.slice().sort(), p.id);
    p.areas.forEach((id, i) => assert.strictEqual(list[i].id, id, p.id + ' order'));
    assert.ok(!list[0].more && list[list.length - 1].more !== undefined);
  });
});

test('very tall walls (warehouses, sanctuaries) cost more per sq ft', () => {
  const base = { length: 40, width: 40, doors: 0, windows: 0, coats: 2, surfaces: { walls: true } };
  const r12 = P.calcRoom(Object.assign({}, base, { height: 12 }), settings);
  const r20 = P.calcRoom(Object.assign({}, base, { height: 20 }), settings);
  assert.ok(r20.hours / r20.wallArea > r12.hours / r12.wallArea * 1.3);
});

test('quick estimate uses bigger areas for open buildings like warehouses', () => {
  const q = Object.assign(P.newQuick(20), { sqft: 20000 });
  const wh = P.calcQuick(q, settings, 'commercial', 'warehouse');
  const off = P.calcQuick(q, settings, 'commercial', 'office');
  assert.ok(wh.wallArea < off.wallArea, 'open warehouse has far fewer walls than offices');
});

test('new rooms from presets have sensible defaults', () => {
  const r = P.newRoom(P.ROOM_TYPES[0]);
  assert.strictEqual(r.name, 'Bedroom');
  assert.strictEqual(r.length, 12);
  assert.ok(P.calcJob({ rooms: [r] }, settings).total > 0);
});

test('every exterior & floor type prices to a sensible amount', () => {
  P.OUTSIDE_TYPES.forEach(t => {
    const item = P.newOutside(t, { jobType: 'residential' });
    const c = P.calcOutside(item, settings);
    assert.ok(c.hours > 0 && c.laborCost > 0, t.name);
    assert.ok(Number.isFinite(P.calcJob({ outside: [item] }, settings).total), t.name);
  });
});

test('exterior: more stories and rougher siding cost more', () => {
  const t = P.OUTSIDE_TYPES.find(x => x.type === 'house');
  const base = P.newOutside(t, { jobType: 'residential' });
  const one = P.calcOutside(Object.assign({}, base, { stories: 1 }), settings);
  const two = P.calcOutside(Object.assign({}, base, { stories: 2 }), settings);
  assert.ok(two.hours > one.hours);
  const stucco = P.calcOutside(Object.assign({}, base, { siding: 'masonry' }), settings);
  assert.ok(stucco.hours > P.calcOutside(base, settings).hours);
  assert.ok(stucco.gallons.ext > P.calcOutside(base, settings).gallons.ext, 'stucco soaks up more paint');
});

test('garage floor: epoxy kits show as materials; flakes cost more than epoxy; paint uses gallons', () => {
  const t = P.OUTSIDE_TYPES.find(x => x.name === 'Garage Floor');
  const epoxy = P.newOutside(t, { jobType: 'residential' });
  assert.strictEqual(epoxy.length * epoxy.width, 440);
  const qe = P.calcJob({ outside: [epoxy] }, settings);
  assert.ok(qe.materials.some(m => m.key === 'epoxy' && m.cost === 440));
  const qf = P.calcJob({ outside: [Object.assign({}, epoxy, { system: 'flake' })] }, settings);
  assert.ok(qf.total > qe.total);
  const qp = P.calcJob({ outside: [Object.assign({}, epoxy, { system: 'paint' })] }, settings);
  assert.ok(qp.materials.some(m => m.key === 'floor' && m.qty >= 3));
});

test('outside items add on top of interior, in both quick and room-by-room mode', () => {
  const t = P.OUTSIDE_TYPES.find(x => x.type === 'house');
  const quick = Object.assign(P.newQuick(), { sqft: 2000 });
  const inside = P.calcJob({ mode: 'quick', quick }, settings).total;
  const both = P.calcJob({ mode: 'quick', quick, outside: [P.newOutside(t, { quick })] }, settings);
  assert.ok(both.total > inside);
  assert.strictEqual(both.outside.length, 1);
  assert.strictEqual(both.outside[0].name, 'Whole House Exterior');
  // house size defaults to the quick-estimate square footage
  assert.strictEqual(P.newOutside(t, { quick }).sqft, 2000);
});

test('cabinets: spraying is faster than brushing, insides add work, enamel is a material', () => {
  const t = P.OUTSIDE_TYPES.find(x => x.name === 'Kitchen Cabinets');
  const c = P.newOutside(t, { jobType: 'residential' });
  const spray = P.calcOutside(c, settings);
  const brush = P.calcOutside(Object.assign({}, c, { method: 'brush' }), settings);
  const inside = P.calcOutside(Object.assign({}, c, { insides: true }), settings);
  assert.ok(brush.hours > spray.hours);
  assert.ok(inside.hours > spray.hours);
  assert.ok(P.calcJob({ outside: [c] }, settings).materials.some(m => m.key === 'cabinet'));
});

test('specialty: popcorn asbestos test is optional; drywall and wallpaper add materials', () => {
  const pop = P.newOutside(P.OUTSIDE_TYPES.find(x => x.type === 'popcorn'), { jobType: 'residential' });
  const withTest = P.calcJob({ outside: [pop] }, settings);
  const noTest = P.calcJob({ outside: [Object.assign({}, pop, { test: 0 })] }, settings);
  assert.ok(withTest.materials.some(m => m.key === 'asbestos'));
  assert.ok(!noTest.materials.some(m => m.key === 'asbestos'));
  const dw = P.newOutside(P.OUTSIDE_TYPES.find(x => x.type === 'drywall'), {});
  assert.ok(P.calcJob({ outside: [dw] }, settings).materials.some(m => m.key === 'drywall' && m.cost === 31));
  const wp = P.newOutside(P.OUTSIDE_TYPES.find(x => x.type === 'wallpaper'), {});
  const rough = P.calcOutside(Object.assign({}, wp, { condition: 'poor' }), settings);
  assert.ok(rough.hours > P.calcOutside(wp, settings).hours, 'multiple layers take longer');
  assert.deepStrictEqual(P.OUTSIDE_GROUPS.map(g => g[0]), ['exterior', 'floor', 'specialty']);
  P.OUTSIDE_TYPES.forEach(x => assert.ok(P.OUTSIDE_GROUPS.some(g => g[0] === x.group), x.name + ' has a group'));
});
