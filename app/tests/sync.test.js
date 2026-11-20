// Run with: node --test app/tests/sync.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../sync.js');

const job = (id, t, extra) => Object.assign({ id, number: 'Q-' + id, createdAt: 1, updatedAt: t }, extra || {});

test('first sync uploads this device and changes nothing locally', () => {
  const local = { settings: { businessName: 'Ann', account: { id: 'u' } }, settingsAt: 5, jobs: [job('a', 10)], expenses: [{ id: 'e1', amount: 5 }] };
  const m = C.merge(local, null);
  assert.strictEqual(m.changedRemote, true);
  assert.strictEqual(m.changedLocal, false);
  assert.deepStrictEqual(m.doc.jobs.map(j => j.id), ['a']);
  assert.strictEqual(m.doc.settings.businessName, 'Ann');
  assert.strictEqual(m.doc.settings.account, undefined, 'sign-in details never leave the device');
});

test('a new phone restores everything from the account', () => {
  const remote = { settings: { businessName: 'Ann', laborRate: 60, onboarded: true }, settingsAt: 50, jobs: [job('a', 10), job('b', 20)], expenses: [{ id: 'e1' }], deleted: {} };
  const local = { settings: { account: { id: 'u' } }, settingsAt: 0, jobs: [], expenses: [] };
  const m = C.merge(local, remote);
  assert.strictEqual(m.changedLocal, true);
  assert.strictEqual(m.changedRemote, false);
  assert.strictEqual(m.settings.laborRate, 60);
  assert.deepStrictEqual(m.jobs.map(j => j.id).sort(), ['a', 'b']);
});

test('the most recently edited copy of a job wins, from either side', () => {
  const local = { jobs: [job('a', 30, { notes: 'phone edit' }), job('b', 5)] };
  const remote = { jobs: [job('a', 20, { notes: 'old' }), job('b', 40, { notes: 'computer edit' })], deleted: {} };
  const m = C.merge(local, remote);
  assert.strictEqual(m.jobs.find(j => j.id === 'a').notes, 'phone edit');
  assert.strictEqual(m.jobs.find(j => j.id === 'b').notes, 'computer edit');
});

test('deleted jobs stay deleted, unless edited again later', () => {
  const remote = { jobs: [job('a', 10), job('b', 10)], deleted: {} };
  const local = { jobs: [job('b', 10)], deleted: { jobs: { a: 15 } } };
  const m = C.merge(local, remote);
  assert.deepStrictEqual(m.jobs.map(j => j.id), ['b'], 'deleted on this phone, removed everywhere');
  assert.strictEqual(m.doc.deleted.jobs.a, 15);
  const m2 = C.merge({ jobs: [job('a', 99)] }, { jobs: [], deleted: { jobs: { a: 15 } } });
  assert.deepStrictEqual(m2.jobs.map(j => j.id), ['a'], 'edited after the delete → kept');
});

test('expenses from both devices are kept; deleted ones removed', () => {
  const m = C.merge({ expenses: [{ id: 'e1' }, { id: 'e2' }], deleted: { expenses: { e3: 9 } } },
    { expenses: [{ id: 'e2' }, { id: 'e3' }, { id: 'e4' }], deleted: {} });
  assert.deepStrictEqual(m.expenses.map(e => e.id).sort(), ['e1', 'e2', 'e4']);
});

test('settings: newer wins, device-only fields are never synced', () => {
  const local = { settings: { laborRate: 55, sub: { status: 'active' }, comp: { note: 'Owner' } }, settingsAt: 10 };
  const remote = { settings: { laborRate: 70 }, settingsAt: 20, jobs: [], deleted: {} };
  const m = C.merge(local, remote);
  assert.strictEqual(m.settings.laborRate, 70);
  assert.strictEqual(m.settings.sub, undefined);
  assert.strictEqual(m.doc.settings.comp, undefined);
  const older = C.merge({ settings: { laborRate: 80 }, settingsAt: 30 }, remote);
  assert.strictEqual(older.settings.laborRate, 80);
  assert.strictEqual(older.changedRemote, true);
});

test('nothing changed → nothing to save on either side', () => {
  const data = { settings: { a: 1 }, settingsAt: 3, jobs: [job('a', 1)], expenses: [], deleted: { jobs: {}, expenses: {} } };
  const m = C.merge(JSON.parse(JSON.stringify(data)), JSON.parse(JSON.stringify(data)));
  assert.strictEqual(m.changedLocal, false);
  assert.strictEqual(m.changedRemote, false);
});

test('old tombstones are forgotten after ~6 months', () => {
  const now = 1e12;
  const p = C.pruneTombstones({ jobs: { old: now - 200 * 864e5, recent: now - 864e5 }, expenses: {} }, now);
  assert.deepStrictEqual(Object.keys(p.jobs), ['recent']);
});

test('the sync stamp counts as a change, and exact ties resolve the same way on both devices', () => {
  const a = job('a', 10, { notes: 'x', syncAt: 50 }), b = job('a', 10, { notes: 'y' });
  assert.strictEqual(C.merge({ jobs: [b] }, { jobs: [a], deleted: {} }).jobs[0].notes, 'x');
  const t1 = job('a', 10, { notes: 'p' }), t2 = job('a', 10, { notes: 'q' });
  const one = C.merge({ jobs: [t1] }, { jobs: [t2], deleted: {} }).jobs[0].notes;
  const two = C.merge({ jobs: [t2] }, { jobs: [t1], deleted: {} }).jobs[0].notes;
  assert.strictEqual(one, two);
  assert.strictEqual(C.itemHash(job('a', 1, { syncAt: 5 })), C.itemHash(job('a', 1, { syncAt: 9 })));
});

test('a device syncing for the first time takes the account\'s settings even if neither side was ever edited', () => {
  const m = C.merge({ settings: { businessName: '' }, settingsAt: -1 }, { settings: { businessName: 'Ann' }, settingsAt: 0, jobs: [], deleted: {} });
  assert.strictEqual(m.settings.businessName, 'Ann');
  assert.strictEqual(m.changedRemote, false);
});
