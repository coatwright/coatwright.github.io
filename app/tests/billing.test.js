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
  const sub = { status: 'active', plan: 'annual', periodEnd: now + 200 * DAY, cancelAtEnd: false, founderNumber: null, checkedAt: now - 2 * DAY };
  const a = B.accessState({ trialStart: 0, sub }, now, on);
  assert.strictEqual(a.mode, 'active');
  assert.strictEqual(a.canCreate, true);
  assert.strictEqual(a.plan, 'annual');
  assert.strictEqual(a.renews, sub.periodEnd);
  assert.strictEqual(B.accessState({ sub: Object.assign({}, sub, { checkedAt: now - 8 * DAY }) }, now, on).mode, 'recheck');
  const pastDue = B.accessState({ sub: Object.assign({}, sub, { status: 'past_due' }) }, now, on);
  assert.strictEqual(pastDue.mode, 'active', 'card problems: Stripe retries, keep working meanwhile');
  assert.strictEqual(pastDue.pastDue, true);
  const canceled = B.accessState({ trialStart: now - 30 * DAY, sub: Object.assign({}, sub, { status: 'canceled' }) }, now, on);
  assert.strictEqual(canceled.mode, 'expired');
  assert.strictEqual(canceled.lapsed, true);
  const longOver = B.accessState({ trialStart: now - 90 * DAY, sub: Object.assign({}, sub, { periodEnd: now - 30 * DAY, checkedAt: now - 30 * DAY }) }, now, on);
  assert.strictEqual(longOver.mode, 'expired', 'offline for weeks past the renewal date');
});

test('reads the account subscription rows from the database', () => {
  const now = 1e12;
  assert.strictEqual(B.subFromRows([], now), null);
  const rows = [
    { status: 'canceled', plan: 'founder', current_period_end: '2026-12-15T00:00:00Z', cancel_at_period_end: false, founder_number: 7, updated_at: '2026-12-16T00:00:00Z' },
    { status: 'active', plan: 'founder', current_period_end: '2027-01-15T00:00:00Z', cancel_at_period_end: true, founder_number: null, updated_at: '2026-12-20T00:00:00Z' }
  ];
  const s = B.subFromRows(rows, now);
  assert.strictEqual(s.status, 'active', 'a live subscription wins');
  assert.strictEqual(s.cancelAtEnd, true);
  assert.strictEqual(s.periodEnd, Date.parse('2027-01-15T00:00:00Z'));
  assert.strictEqual(s.checkedAt, now);
  assert.strictEqual(B.subFromRows([rows[0]], now).founderNumber, 7);
});

test('checkout links carry the account so the app unlocks by itself', () => {
  const cfg = Object.assign({}, on, { checkout: { monthly: 'https://buy.stripe.com/m1', annual: 'https://buy.stripe.com/y1?locale=en' } });
  const acct = { id: '11111111-1111-1111-1111-111111111111', email: 'ann+paint@x.com' };
  assert.strictEqual(B.checkoutUrl(cfg, 'monthly', acct), 'https://buy.stripe.com/m1?client_reference_id=11111111-1111-1111-1111-111111111111&prefilled_email=ann%2Bpaint%40x.com');
  assert.match(B.checkoutUrl(cfg, 'founder', acct), /^https:\/\/buy\.stripe\.com\/m1\?.*&prefilled_promo_code=FOUNDER$/);
  assert.match(B.checkoutUrl(cfg, 'annual', acct), /\?locale=en&client_reference_id=/);
  assert.strictEqual(B.checkoutUrl(cfg, 'monthly', null), '', 'must be signed in');
  assert.strictEqual(B.checkoutUrl(Object.assign({}, on, { checkout: { monthly: '', annual: '' } }), 'monthly', acct), '', 'no link until Stripe is set up');
  assert.strictEqual(B.portalUrl(Object.assign({}, on, { portal: 'https://billing.stripe.com/p/login/abc' }), 'a@b.com'), 'https://billing.stripe.com/p/login/abc?prefilled_email=a%40b.com');
  assert.deepStrictEqual(B.planPrice(on, 'founder'), { amount: 12, unit: '/mo' });
  assert.deepStrictEqual(B.planPrice(on, 'annual'), { amount: 199, unit: '/yr' });
  assert.strictEqual(B.planName('founder'), 'Founding member');
});

test('annual plan math: $199/yr vs $24/mo', () => {
  assert.deepStrictEqual(B.annualDeal(on), { perMonth: 16.58, savePct: 31 });
});

test('trial reminders at 7, 3 and 1 days left, each shown once', () => {
  const t = (d) => ({ mode: 'trial', daysLeft: d });
  assert.strictEqual(B.trialReminder(t(10), 0), 0);
  assert.strictEqual(B.trialReminder(t(7), 0), 7);
  assert.strictEqual(B.trialReminder(t(6), 7), 0, 'already seen the 7-day one');
  assert.strictEqual(B.trialReminder(t(3), 7), 3);
  assert.strictEqual(B.trialReminder(t(2), 3), 0);
  assert.strictEqual(B.trialReminder(t(1), 3), 1);
  assert.strictEqual(B.trialReminder(t(1), 1), 0);
  assert.strictEqual(B.trialReminder(t(2), 0), 3, 'opened the app late: shows the current one only');
  assert.strictEqual(B.trialReminder({ mode: 'active' }, 0), 0);
  assert.strictEqual(B.trialReminder({ mode: 'free', canCreate: true }, 0), 0);
});
