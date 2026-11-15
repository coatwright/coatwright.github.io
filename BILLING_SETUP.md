# Coatwright — Payment Setup (Stripe)

Connects real payments: painters tap **Upgrade → pay → Coatwright Pro unlocks by itself**. Founding members get their number
(#1–#100) and a congratulations email. About 45 minutes. Until Claude switches billing on, the app stays free for everyone.

**Never share in chat:** keys starting with `sk_` or `rk_`, the webhook signing secret (`whsec_…`), your Resend key (`re_…`).
Payment Links (`buy.stripe.com/…`) and the customer portal link are public and fine to send.

Screens change from time to time; if something looks different, pick the closest option or send a screenshot.

---

## 1. Account ✅
Done: Stripe account (Canada), **Managed Payments** ("Let us handle it"), payouts weekly, two-step authentication.

## 2. Create the product and prices

**Product catalog → + Add product**

| Field | Enter |
|---|---|
| Name | `Coatwright Pro` |
| Description | `Unlimited quotes and invoices, interior/exterior/cabinets/floors/commercial pricing, job tracking, schedule, customers and profit stats for painters.` |
| Image | optional: `marketing/social/profile-picture.png` |
| Tax code (if asked) | **Software as a service (SaaS) – business use** |
| Price | **Recurring**, **$24.00 USD**, billing period **Monthly** |

Save. Then open the product → **+ Add another price**: **Recurring**, **$199.00 USD**, **Yearly**. Save.

No free trial in Stripe: the 14-day trial happens in the app, with no card.

## 3. Founding-member discount (half price for life, first 100)

**Product catalog → Coupons → + Create coupon**

| Field | Enter |
|---|---|
| Name | `Founding member` |
| Type | **Percentage discount**, **50%** |
| Apply to specific products | **Coatwright Pro** |
| Duration | **Forever** |

Then, on the coupon → **+ Add promotion code**:

| Field | Enter |
|---|---|
| Code | `FOUNDER` |
| Limit the number of times this code can be redeemed | **100** |

At 100 uses, Stripe stops accepting the code automatically.

## 4. Two Payment Links

**Payment Links → + New**

**Link A: Monthly**
- Product: **Coatwright Pro – $24.00 / month**
- Options: turn **on** "Allow promotion codes"
- **After payment** tab: **Don't show confirmation page → Redirect customers to your website** →
  `https://getcoatwright.com/app/#/upgrade/thanks`
- Create → **copy the link** (`https://buy.stripe.com/…`)

**Link B: Yearly**
- Product: **Coatwright Pro – $199.00 / year**
- "Allow promotion codes": **off**
- After payment: same redirect `https://getcoatwright.com/app/#/upgrade/thanks`
- Create → **copy the link**

(The founding member button in the app uses Link A with the FOUNDER code filled in.)

## 5. Customer portal (manage or cancel)

**Settings → Billing → Customer portal**
- Allow: **update payment method**, **view invoice history**, **cancel subscriptions** (cancel at end of billing period)
- **Switch plans: off** for now (keeps founder pricing simple)
- Business information: support email `coatwrightapp@gmail.com`, links to `https://getcoatwright.com/terms.html` and `/privacy.html`
- Save, then under **Customer portal link** click **Activate** → **copy the link** (`https://billing.stripe.com/p/login/…`)

## 6. Emails Stripe sends for you

**Settings → Billing → Subscriptions and emails** (names vary): turn **on**
- emails about **upcoming renewals** (reminds yearly subscribers before they're charged)
- emails when a **card is expiring** and when a **payment fails**
- receipts for successful payments

## 7. Supabase: the subscription table

1. Open **https://getcoatwright.com/supabase/billing.sql** → select all → copy.
2. Supabase → **SQL Editor → New query** → paste → **Run** → "Success. No rows returned".

## 8. Supabase: the webhook function

1. Open **https://github.com/coatwright/coatwright.github.io/blob/main/supabase/functions/stripe-webhook/index.ts** →
   click the **Copy raw file** button (two squares icon, top right of the code).
2. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
3. Name: `stripe-webhook`. Delete the sample code, paste, **Deploy function**.
4. Open the function → **Details** (or Settings) → turn **off** "Enforce JWT verification" (Verify JWT) → **Save**.
   (Stripe proves who it is with a signature instead.)

## 9. Stripe: send events to the function

**Developers → Webhooks** (or **Workbench → Webhooks**) **→ + Add destination / Add endpoint**
- Events (search and tick): `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- Destination type: **Webhook endpoint**
- Endpoint URL: `https://tbgcxcocnqbnmjnvncic.supabase.co/functions/v1/stripe-webhook`
- Create → on the endpoint page, **Signing secret → Reveal** → copy (`whsec_…`). Keep it private.

## 10. Supabase: secrets for the function

**Edge Functions → Secrets** (or Project Settings → Edge Functions) → add:

| Name | Value |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | the `whsec_…` from step 9 |
| `RESEND_API_KEY` | a Resend key: Resend → **API Keys → Create** (name `Webhook`, Sending access) → copy `re_…` |

Save.

## 11. Send Claude the three public links

1. Monthly Payment Link (`buy.stripe.com/…`)
2. Yearly Payment Link
3. Customer portal link (`billing.stripe.com/p/login/…`)

Claude switches billing on (everyone gets a fresh 14-day trial from that day).

## 12. Test it together

Claude will ask you to buy the **Monthly** plan yourself with a real card from the app, check that it unlocks, then you
**refund and cancel it** in Stripe (Payments → the payment → Refund; Subscriptions → Cancel). Stripe's fee on that test is a dollar or two.

---

## What customers experience

1. Sign up → 14-day free trial, no card. The app shows days left and reminds them at 7, 3 and 1 days.
2. **Upgrade** → Founding member ($12/mo, while spots last) / Yearly ($199) / Monthly ($24) → Stripe checkout in their currency, tax included.
3. Back in the app, Coatwright Pro unlocks within seconds. Founders see "Founding Member #N of 100" and get a welcome email.
4. Settings and Plans show the plan and the renewal date. **Manage or cancel** opens Stripe's portal (card, receipts, cancel).
5. If they don't subscribe, they keep viewing, backing up and exporting; only new quotes and invoices are locked.

## Checklist

- [x] Stripe account, Managed Payments, payouts, 2FA
- [ ] Product Coatwright Pro: $24/month and $199/year
- [ ] Coupon 50% forever + promotion code FOUNDER (max 100)
- [ ] Payment Links: Monthly (promo codes on) and Yearly, both redirecting to `/app/#/upgrade/thanks`
- [ ] Customer portal on, link activated
- [ ] Renewal / failed payment emails on
- [ ] `billing.sql` ran in Supabase
- [ ] `stripe-webhook` function deployed, JWT verification off
- [ ] Stripe webhook endpoint with the 5 events
- [ ] Secrets `STRIPE_WEBHOOK_SECRET` and `RESEND_API_KEY` saved
- [ ] Sent Claude the 3 links → billing on → test purchase + refund
