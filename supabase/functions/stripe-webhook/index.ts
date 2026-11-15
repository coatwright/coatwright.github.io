// Coatwright: Stripe webhook (Supabase Edge Function "stripe-webhook").
// Stripe calls this when someone subscribes, renews, changes or cancels. It records the subscription in the
// database (supabase/billing.sql) so the app unlocks by itself, numbers founding members 1–100 and emails them.
//
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_WEBHOOK_SECRET (whsec_…), RESEND_API_KEY (re_…).
// Optional: FOUNDER_PROMO_CODES = comma-separated promotion code or coupon IDs that mean "founding member".
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// "Verify JWT" must be OFF for this function (Stripe signs its requests instead).
//
// Plain JavaScript (valid TypeScript) in one file, so it can be pasted into the Supabase dashboard editor.

const TOLERANCE_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Check Stripe's signature header ("t=…,v1=…"). Returns true when the body really came from Stripe. */
export async function verifySignature(body, header, secret, nowSeconds) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach((kv) => {
    const i = kv.indexOf('=');
    if (i > 0) {
      const k = kv.slice(0, i).trim();
      (parts[k] = parts[k] || []).push(kv.slice(i + 1).trim());
    }
  });
  const t = Number((parts.t || [])[0]);
  if (!t || Math.abs((nowSeconds || Date.now() / 1000) - t) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + body)));
  return (parts.v1 || []).some((sig) => safeEqual(sig, expected));
}

function idOf(x) { return x && typeof x === 'object' ? x.id : x || null; }

/** Did this checkout use the founding-member discount? */
export function isFounderCheckout(session, env) {
  const ids = String(env.FOUNDER_PROMO_CODES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const discounts = Array.isArray(session.discounts) ? session.discounts : [];
  if (ids.length) {
    return discounts.some((d) => ids.includes(idOf(d.promotion_code)) || ids.includes(idOf(d.coupon)));
  }
  // Without a list, any discount counts: Coatwright's only discount is the founding-member one.
  const off = session.total_details && Number(session.total_details.amount_discount);
  return discounts.length > 0 || off > 0;
}

/** The parts of a Stripe subscription the app needs. */
export function subscriptionFields(sub, eventCreated) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  const price = item && (item.price || item.plan);
  const interval = price ? (price.recurring ? price.recurring.interval : price.interval) : null;
  const end = sub.current_period_end || (item && item.current_period_end) || null;
  return {
    p_customer: idOf(sub.customer),
    p_subscription: sub.id,
    p_status: sub.status,
    p_interval: interval === 'year' || interval === 'month' ? interval : null,
    p_period_end: end ? new Date(end * 1000).toISOString() : null,
    p_cancel: !!(sub.cancel_at_period_end || sub.cancel_at),
    p_event_at: Number(eventCreated) || 0
  };
}

export function founderEmail(n) {
  return {
    subject: `🎉 You're Founding Member #${n} of 100`,
    html:
      `<h2>Welcome, Founding Member #${n}!</h2>` +
      `<p>You're one of the first 100 painters to back Coatwright. Thank you!</p>` +
      `<p>Your price is <b>locked at half price ($12/month) for as long as you stay subscribed</b>. It will never go up.</p>` +
      `<p>As a founding member you can also tell us what to build next: just reply to this email.</p>` +
      `<p>Happy quoting,<br>The Coatwright team<br><a href="https://getcoatwright.com/app/">getcoatwright.com</a></p>`
  };
}

async function rpc(env, fetchFn, name, args) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  const r = await fetchFn(env.SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(name + ' failed: ' + r.status + ' ' + txt);
  return txt ? JSON.parse(txt) : null;
}

async function sendEmail(env, fetchFn, to, mail) {
  if (!env.RESEND_API_KEY || !to) return false;
  const r = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Coatwright <hello@getcoatwright.com>', to: [to], reply_to: 'coatwrightapp@gmail.com', subject: mail.subject, html: mail.html })
  });
  return r.ok;
}

async function maybeWelcomeFounder(env, fetchFn, customer) {
  const rows = await rpc(env, fetchFn, 'assign_founder', { p_customer: customer });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (row && row.is_new) await sendEmail(env, fetchFn, row.email, founderEmail(row.founder_number));
  return row;
}

/** Handle one webhook request. `env` holds secrets; `fetchFn` is fetch (swappable in tests). */
export async function handle(req, env, fetchFn) {
  fetchFn = fetchFn || fetch;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();
  const ok = await verifySignature(body, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response('Bad signature', { status: 400 });

  let event;
  try { event = JSON.parse(body); } catch (e) { return new Response('Bad JSON', { status: 400 }); }
  const obj = event.data && event.data.object;
  try {
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && obj && obj.mode === 'subscription') {
      const user = UUID.test(obj.client_reference_id || '') ? obj.client_reference_id : null;
      const email = (obj.customer_details && obj.customer_details.email) || obj.customer_email || null;
      const customer = idOf(obj.customer);
      await rpc(env, fetchFn, 'stripe_checkout', { p_customer: customer, p_user: user, p_email: email, p_founder: isFounderCheckout(obj, env) });
      await maybeWelcomeFounder(env, fetchFn, customer);
    } else if (event.type && event.type.indexOf('customer.subscription.') === 0 && obj) {
      const f = subscriptionFields(obj, event.created);
      await rpc(env, fetchFn, 'stripe_subscription', f);
      await maybeWelcomeFounder(env, fetchFn, f.p_customer);
    }
  } catch (e) {
    console.error(e);
    return new Response('Error: ' + (e && e.message), { status: 500 }); // Stripe retries later
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

if (typeof Deno !== 'undefined') {
  Deno.serve((req) => handle(req, Deno.env.toObject(), fetch));
}
