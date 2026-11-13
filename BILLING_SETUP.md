# Coatwright — Payment Setup (Lemon Squeezy)

This connects real payments to Coatwright. It takes about 30–45 minutes, mostly verification.
Lemon Squeezy is free to join; it takes a small fee from each sale (roughly 5% + 50¢, check their pricing page)
and handles sales tax for you as the "seller of record".

**When you're done, send Claude three links** (step 6). Claude then switches billing on in the app.
Until then, Coatwright stays free for everyone, so nothing breaks while you set this up.

Screens change from time to time; if something looks different, pick the closest option or send a screenshot.

---

## 1. Create your account

| Screen asks | Your answer |
|---|---|
| Sign up at **lemonsqueezy.com** | Email `coatwrightapp@gmail.com`, a strong new password (save it) |
| Your name | Your real name (it's for payouts, not shown to customers) |
| Store name | `Coatwright` |
| Store URL / subdomain | `coatwright` (or the closest available) |
| Currency | USD |

Turn on **two-factor authentication** in account settings.

## 2. Get approved to receive money

In **Settings → Payouts** (or the onboarding checklist):
- Add how you get paid: **bank account** (or PayPal).
- Complete **identity verification** (photo ID). Lemon Squeezy reviews new stores before they can take live payments; this can take a few days.
- Describe the business: *"Coatwright is a subscription app for painting contractors to create quotes and invoices and track their jobs."* Website: `https://coatwright.github.io/`

> If your store isn't approved, tell Claude: Paddle or Stripe are alternatives, and the app can be adapted.

## 3. Create the product

**Products → New product**

| Field | Enter |
|---|---|
| Name | `Coatwright Pro` |
| Description | `Unlimited quotes and invoices, interior/exterior/cabinets/floors/commercial pricing, job tracking, schedule, customers and profit stats for painters.` |
| Image | Upload `marketing/social/profile-picture.png` |
| Pricing type | **Subscription** |

**Add two variants** (also called pricing options):

| Variant name | Price | Billing |
|---|---|---|
| `Monthly` | **$24.00** | every 1 month |
| `Yearly` | **$199.00** | every 1 year |

- **Free trial setting in Lemon Squeezy: leave it OFF.** The 14-day trial happens inside the app with no card, so customers only see checkout when they're ready to pay.
- **Tax:** let Lemon Squeezy calculate it (default).

## 4. Turn on license keys (important)

In the product (or each variant) find **License keys** and turn them **on**:

| Setting | Choose |
|---|---|
| Generate license keys | **On** |
| Activation limit | **3** (phone, tablet and computer) |
| License length | **Tied to the subscription** / "Expires when subscription ends" (don't set a fixed number of days) |

Lemon Squeezy emails the license key to the customer after purchase. Customers paste it into Coatwright → Plans → **Activate**.

**After-purchase button** (in the product's confirmation settings, if offered):
- Button text: `Activate in Coatwright`
- Link: `https://coatwright.github.io/app/#/upgrade`

**Publish** the product.

## 5. Founding member price ($14/mo for life, first 100)

**Discounts → New discount**

| Field | Enter |
|---|---|
| Name | `Founding member` |
| Code | `FOUNDER` |
| Amount | **$10.00 off** (fixed amount), so $24 becomes $14 |
| Duration | **Forever** (applies to every renewal) |
| Limit to products/variants | **Coatwright Pro → Monthly** only |
| Limit number of redemptions | **100** |

When 100 people have used it, it stops working automatically.

## 6. Copy your checkout links and send them to Claude

Products → **Coatwright Pro** → **Share** (or the "Checkout link" for each variant). Copy:

1. **Monthly** checkout link
2. **Yearly** checkout link
3. **Founding member** link: the Monthly link with this added to the end:
   `?checkout[discount_code]=FOUNDER`
   (if the Monthly link already contains a `?`, add `&checkout[discount_code]=FOUNDER` instead)

Also helpful (optional): your **Store ID** (Settings → Stores) and the **Product ID** (in the product's page address). With these, the
app only accepts keys from your store.

## 7. Test before going live

1. Turn on **Test mode** in Lemon Squeezy (toggle near the top).
2. Open the Monthly test link and pay with the test card `4242 4242 4242 4242`, any future date, any 3-digit code.
3. Check `coatwrightapp@gmail.com` for the license key.
4. Send Claude the **test** links first: Claude switches billing on with them so you can try the whole flow on your phone.
5. When it works, switch Lemon Squeezy to **Live mode**, copy the **live** links, and send those.

---

## What customers will experience

1. Open the app → 14-day free trial starts, no card.
2. The app shows days left; when they're ready they tap **Upgrade** → choose Founding / Yearly / Monthly → Lemon Squeezy checkout.
3. They get an email with their license key → paste it into **Plans → Activate** → Pro unlocked.
4. They manage or cancel anytime at the Lemon Squeezy "My orders" page (linked in the app).
5. If they don't subscribe, they keep viewing, backing up and exporting their data; only new quotes and invoices are locked.

## Checklist

- [ ] Lemon Squeezy account with `coatwrightapp@gmail.com`, 2FA on
- [ ] Payouts and identity verification done, store approved
- [ ] Product "Coatwright Pro" with Monthly $24 and Yearly $199, license keys on (limit 3, tied to subscription)
- [ ] FOUNDER discount: $10 off forever, Monthly only, 100 uses
- [ ] Test purchase works; license key email received
- [ ] Send Claude the 3 links (test first, then live)
