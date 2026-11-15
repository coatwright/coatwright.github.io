// Run with: node --test app/tests/webhook.test.js
// Tests the Stripe webhook function (supabase/functions/stripe-webhook/index.ts) with a fake database and Resend.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = fs.readFileSync(path.join(__dirname, '../../supabase/functions/stripe-webhook/index.ts'), 'utf8');
const load = () => import('data:text/javascript,' + encodeURIComponent(SRC));
const SECRET = 'whsec_test';
const env = { STRIPE_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: 're_test', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' };

function signed(event, secret, t) {
  const body = JSON.stringify(event);
  t = t || Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret || SECRET).update(t + '.' + body).digest('hex');
  return new Request('https://fn.test', { method: 'POST', body, headers: { 'stripe-signature': 't=' + t + ',v1=' + sig } });
}

function fakeBackend(assignResult) {
  const calls = [];
  const fetchFn = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, body });
    if (url.endsWith('/rpc/assign_founder')) return new Response(JSON.stringify(assignResult || []), { status: 200 });
    return new Response('', { status: 200 });
  };
  return { calls, fetchFn };
}

test('rejects requests that are not signed by Stripe', async () => {
  const W = await load();
  const b = fakeBackend();
  const evt = { type: 'customer.subscription.updated', data: { object: {} } };
  assert.strictEqual((await W.handle(signed(evt, 'whsec_wrong'), env, b.fetchFn)).status, 400);
  assert.strictEqual((await W.handle(signed(evt, SECRET, Math.floor(Date.now() / 1000) - 3600), env, b.fetchFn)).status, 400, 'old replays rejected');
  assert.strictEqual(b.calls.length, 0);
});

test('checkout links the payment to the Coatwright account and welcomes founder #1', async () => {
  const W = await load();
  const b = fakeBackend([{ founder_number: 1, email: 'ann@x.com', is_new: true }]);
  const res = await W.handle(signed({
    type: 'checkout.session.completed', created: 1,
    data: { object: { mode: 'subscription', customer: 'cus_1', client_reference_id: '11111111-1111-1111-1111-111111111111',
      customer_details: { email: 'ann@x.com' }, discounts: [{ promotion_code: 'promo_F', coupon: null }], total_details: { amount_discount: 1200 } } }
  }), env, b.fetchFn);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(b.calls[0].body, { p_customer: 'cus_1', p_user: '11111111-1111-1111-1111-111111111111', p_email: 'ann@x.com', p_founder: true });
  assert.ok(b.calls[1].url.endsWith('/rpc/assign_founder'));
  const mail = b.calls.find((c) => c.url === 'https://api.resend.com/emails');
  assert.ok(mail, 'congratulations email sent');
  assert.deepStrictEqual(mail.body.to, ['ann@x.com']);
  assert.match(mail.body.subject, /Founding Member #1 of 100/);
});

test('no email when the founder number already existed', async () => {
  const W = await load();
  const b = fakeBackend([{ founder_number: 7, email: 'ann@x.com', is_new: false }]);
  await W.handle(signed({ type: 'customer.subscription.updated', created: 5, data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { recurring: { interval: 'month' } }, current_period_end: 1800000000 }] } } } }), env, b.fetchFn);
  assert.ok(!b.calls.some((c) => c.url.includes('resend')));
});

test('subscription changes are recorded (new and old Stripe formats)', async () => {
  const W = await load();
  const f = W.subscriptionFields({ id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: true,
    items: { data: [{ price: { recurring: { interval: 'year' } }, current_period_end: 1800000000 }] } }, 99);
  assert.deepStrictEqual(f, { p_customer: 'cus_1', p_subscription: 'sub_1', p_status: 'active', p_interval: 'year',
    p_period_end: new Date(1800000000 * 1000).toISOString(), p_cancel: true, p_event_at: 99 });
  const old = W.subscriptionFields({ id: 's', customer: { id: 'cus_2' }, status: 'canceled', current_period_end: 1700000000,
    items: { data: [{ plan: { interval: 'month' } }] } }, 1);
  assert.strictEqual(old.p_customer, 'cus_2');
  assert.strictEqual(old.p_interval, 'month');
  assert.strictEqual(old.p_cancel, false);
});

test('founder detection: a listed promo code, or any discount when no list is set', async () => {
  const W = await load();
  const withPromo = { discounts: [{ promotion_code: 'promo_F' }] };
  assert.ok(W.isFounderCheckout(withPromo, {}));
  assert.ok(W.isFounderCheckout(withPromo, { FOUNDER_PROMO_CODES: 'promo_X, promo_F' }));
  assert.ok(!W.isFounderCheckout(withPromo, { FOUNDER_PROMO_CODES: 'promo_X' }));
  assert.ok(!W.isFounderCheckout({ discounts: [], total_details: { amount_discount: 0 } }, {}));
});

test('ignores events it does not need, and non-subscription checkouts', async () => {
  const W = await load();
  const b = fakeBackend();
  assert.strictEqual((await W.handle(signed({ type: 'invoice.paid', data: { object: {} } }), env, b.fetchFn)).status, 200);
  assert.strictEqual((await W.handle(signed({ type: 'checkout.session.completed', data: { object: { mode: 'payment' } } }), env, b.fetchFn)).status, 200);
  assert.strictEqual(b.calls.length, 0);
});

test('a bad client_reference_id is not trusted', async () => {
  const W = await load();
  const b = fakeBackend();
  await W.handle(signed({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', customer: 'cus_9', client_reference_id: "x'; drop table" } } }), env, b.fetchFn);
  assert.strictEqual(b.calls[0].body.p_user, null);
});
