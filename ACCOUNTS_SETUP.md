# Coatwright — Account Setup (Supabase + Google)

Turns on "sign up before the trial": **Continue with Google** or **email + 6-digit code**, one 14-day
trial per email, stored online. About 30–40 minutes in total. Until Claude switches it on in
`app/config.js`, the app works exactly as before.

Your project: `https://tbgcxcocnqbnmjnvncic.supabase.co` (already in the app).
**Never share** the Supabase *secret / service_role* key, the database password, or the Google *client secret* in chat.

Screens change from time to time; if something looks different, pick the closest option or send a screenshot.

---

## Step 1 — Create the database tables and rules (5 min)

1. Open the script on your computer: **https://getcoatwright.com/supabase/setup.sql** → select all → copy.
2. Supabase → your **coatwright** project → **SQL Editor** (left menu) → **New query**.
3. Paste → **Run**. You should see **"Success. No rows returned"**.

This creates the trial records and the rule that each person can only see their own account. Running it twice is safe.

## Step 2 — Tell Supabase where the app lives (2 min)

**Authentication → URL Configuration**

| Field | Enter |
|---|---|
| Site URL | `https://getcoatwright.com/app/` |
| Redirect URLs → Add URL | `https://getcoatwright.com/app/` |
| Redirect URLs → Add URL | `https://getcoatwright.com/app/**` |

Save.

## Step 3 — Make the email send a 6-digit code (5 min)

**Authentication → Sign In / Providers → Email**: make sure **Email** is enabled. If you see **Email OTP length**, set **6**. Save.

**Authentication → Emails** (Email Templates). Edit **both** the **Magic Link** and **Confirm signup** templates:

- **Subject:** `Your Coatwright sign-in code`
- **Message body** (switch to the source/HTML view if there is one, and replace everything):

```html
<h2>Your Coatwright code</h2>
<p>Enter this code in the app to sign in:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>The code expires in 1 hour. If you didn't ask for it, you can ignore this email.</p>
<p>— Coatwright · getcoatwright.com</p>
```

Save each one. (`{{ .Token }}` is where Supabase puts the code. Type it exactly.)

✅ **After steps 1–3, tell Claude.** Email sign-in can be switched on and tested.

## Step 4 — Continue with Google (15–20 min)

### 4a. Google Cloud (create the "app" Google shows on its sign-in screen)

1. Go to **console.cloud.google.com** and sign in with **coatwrightapp@gmail.com**.
2. Top bar → project picker → **New project** → name `Coatwright` → **Create**, then select it.
3. Menu → **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform → Branding**):

| Field | Enter |
|---|---|
| App name | `Coatwright` |
| User support email | `coatwrightapp@gmail.com` |
| App logo | optional (`marketing/social/profile-picture.png`) |
| App home page | `https://getcoatwright.com/` |
| Privacy policy | `https://getcoatwright.com/privacy.html` |
| Terms of service | `https://getcoatwright.com/terms.html` |
| Authorized domains | `getcoatwright.com` and `supabase.co` |
| Developer contact | `coatwrightapp@gmail.com` |
| Audience / User type | **External** |
| Scopes | leave the defaults (email, profile, openid) |

4. **Publish the app** (Audience → **Publish app** / "In production"). In "Testing" mode only listed test users can sign in.
   Because Coatwright only asks for name and email, Google normally doesn't require a review.
5. **Credentials → Create credentials → OAuth client ID** (or **Clients → Create client**):

| Field | Enter |
|---|---|
| Application type | **Web application** |
| Name | `Coatwright web` |
| Authorized JavaScript origins | `https://getcoatwright.com` |
| Authorized redirect URIs | `https://tbgcxcocnqbnmjnvncic.supabase.co/auth/v1/callback` |

**Create** → keep the window with the **Client ID** and **Client secret** open.

### 4b. Supabase

**Authentication → Sign In / Providers → Google** → **Enable** → paste the **Client ID** and **Client secret** → **Save**.
(The callback URL shown there should match the redirect URI above.)

✅ **Tell Claude** (don't send the secret). "Continue with Google" can be switched on.

## Step 5 — Reliable email sending before launch (15 min, free)

Supabase's built-in email is meant for testing and only sends a few emails per hour. Before you share the app widely,
connect a free email service so codes always arrive, from **hello@getcoatwright.com**:

1. Sign up at **resend.com** (free plan) with coatwrightapp@gmail.com.
2. **Domains → Add domain** → `getcoatwright.com`. Resend shows a few DNS records (TXT/MX/CNAME).
3. Add each one in **Porkbun → getcoatwright.com → DNS** exactly as shown (leave your existing records alone). Click **Verify** in Resend.
4. Resend → **API Keys → Create API key** (sending access). Copy it (keep it private).
5. Supabase → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:

| Field | Enter |
|---|---|
| Sender email | `hello@getcoatwright.com` |
| Sender name | `Coatwright` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |

Save. Then **Authentication → Rate Limits**: raise "emails sent per hour" (for example to 100).

> Bonus: in Porkbun → **Email Forwarding**, forward `hello@getcoatwright.com` to coatwrightapp@gmail.com so replies reach you.

---

## What painters will see

1. Open the app → **Start your 14-day free trial** → **Continue with Google** (one tap) or type an email → enter the 6-digit code.
2. Then the usual setup (business name, logo, prices).
3. Signing up again with the same email (or a Gmail `+` / `.` variation) just signs into the same account: **no new trial**.
4. Jobs and quotes stay on the phone; only the account (email, name, trial start) is stored online.

## Checklist

- [ ] Step 1: setup.sql ran ("Success")
- [ ] Step 2: Site URL + redirect URLs saved
- [ ] Step 3: Email enabled, both templates show `{{ .Token }}`
- [ ] Told Claude → email sign-in switched on and tested on your phone
- [ ] Step 4: Google project, consent screen published, OAuth client, Supabase Google provider enabled
- [ ] Told Claude → Google switched on and tested
- [ ] Step 5: Resend domain verified, Supabase custom SMTP on, rate limit raised
