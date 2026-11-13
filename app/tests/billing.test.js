// Run with: node --test app/tests/billing.test.js
const test = require('node:test');
const assert = require('node:assert');
const B = require('../billing.js');

const DAY = 864e5;
const on = Object.assign({}, B.BILLING, { enabled: true, startDate: '', trialDays: 14, graceDays: 7 });

test('billing switched off: everything works, no trial', () => {
  const s = B.accessState({ trialStart: 0 }, Date.now(), Object.assign({}, on, { enabled: false }));
  assert.deepStrictEqual(s, { mode: 'free', canCreate: true });
});

test('trial counts down, then the app becomes view-only', () => {
  const start = new Date('2026-12-01T10:00:00').getTime();
  const day3 = B.accessState({ trialStart: start }, start + 3 * DAY, on);
  assert.strictEqual(day3.mode, 'trial');
  assert.strictEqual(day3.daysLeft, 11);
  assert.strictEqual(day3.canCreate, true);
  const last = B.accessState({ trialStart: start }, start + 14 * DAY - 1000, on);
  assert.strictEqual(last.daysLeft, 1);
  const over = B.accessState({ trialStart: start }, start + 14 * DAY + 1, on);
  assert.strictEqual(over.mode, 'expired');
  assert.strictEqual(over.canCreate, false);
});

test('early users get a full trial from the day billing starts', () => {
  const longAgo = new Date('2026-01-01T10:00:00').getTime();
  const cfg = Object.assign({}, on, { startDate: '2026-12-01' });
  const s = B.accessState({ trialStart: longAgo }, new Date('2026-12-05T12:00:00').getTime(), cfg);
  assert.strictEqual(s.mode, 'trial');
  assert.strictEqual(s.daysLeft, 10);
});

test('active subscription works, and must be re-checked online after the grace period', () => {
  const now = Date.now();
  const lic = { status: 'active', plan: 'Yearly', checkedAt: now - 2 * DAY };
  assert.deepStrictEqual(B.accessState({ trialStart: 0, license: lic }, now, on), { mode: 'active', canCreate: true, plan: 'Yearly' });
  const stale = Object.assign({}, lic, { checkedAt: now - 8 * DAY });
  assert.strictEqual(B.accessState({ license: stale }, now, on).mode, 'recheck');
  const expiredKey = { status: 'expired', checkedAt: now };
  const s = B.accessState({ trialStart: now - 30 * DAY, license: expiredKey }, now, on);
  assert.strictEqual(s.mode, 'expired');
  assert.strictEqual(s.licenseProblem, 'expired');
});

test('reads Lemon Squeezy activate/validate responses', () => {
  const ok = B.licenseFromResponse({ activated: true, license_key: { status: 'active' }, instance: { id: 'inst_1' },
    meta: { variant_name: 'Monthly', customer_email: 'a@b.com', store_id: 5, product_id: 9 } }, 'KEY', 1000, on);
  assert.strictEqual(ok.status, 'active');
  assert.strictEqual(ok.instanceId, 'inst_1');
  assert.strictEqual(ok.plan, 'Monthly');
  assert.strictEqual(ok.error, '');
  const bad = B.licenseFromResponse({ activated: false, error: 'license_key not found.' }, 'NOPE', 1000, on);
  assert.notStrictEqual(bad.status, 'active');
  assert.strictEqual(bad.error, 'license_key not found.');
  const expired = B.licenseFromResponse({ valid: true, license_key: { status: 'expired' } }, 'K', 1, on);
  assert.strictEqual(expired.status, 'expired');
  const other = B.licenseFromResponse({ valid: true, license_key: { status: 'active' }, meta: { store_id: 1 } }, 'K', 1, Object.assign({}, on, { storeId: 5 }));
  assert.strictEqual(other.status, 'wrong-product');
});

test('annual plan math: $199/yr vs $24/mo', () => {
  assert.deepStrictEqual(B.annualDeal(on), { perMonth: 16.58, savePct: 31 });
});
