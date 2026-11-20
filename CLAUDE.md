# Notes for Claude

This is the home of **Coatwright**, published at https://getcoatwright.com/ (custom domain, set by the `CNAME` file) by GitHub Pages
from `main` (anything merged into `main` goes live).

- Website: root `index.html`, `privacy.html`, `terms.html`, images and styles in `landing/`
- App: `app/` (plain HTML/CSS/JS, no build step). Keep the app at `/app/` so home-screen installs keep working.
- Marketing: `marketing/`
- Accounts: `app/config.js` (Supabase URL/public key, `accounts` and `google` switches), `app/account.js`, database rules in `supabase/setup.sql`, owner steps in `ACCOUNTS_SETUP.md`.
- Payments (Stripe Managed Payments): `app/billing.js` holds the billing switch (`enabled`, `startDate`), Stripe Payment Links and the customer portal link;
  database in `supabase/billing.sql`, webhook in `supabase/functions/stripe-webhook/index.ts`; owner steps in `BILLING_SETUP.md`.
  Complimentary (free Pro) access by email: `supabase/comp.sql` (table `comp_access`, granted only from the SQL Editor).
  When switching billing on, set `startDate` to that day so existing users get a full 14-day trial, and bump the cache name in `app/sw.js`.
- Cloud backup & sync: `app/config.js` `sync` switch, merge rules in `app/sync.js`, network calls in `app/account.js` (`user_data` table),
  database in `supabase/sync.sql`; owner steps in `CLOUD_BACKUP_SETUP.md`. Every job change must go through `saveJobs()` (it stamps `syncAt`),
  and deletions must call `forget(kind, id)` so they don't come back from another device.

**Working agreement (owner's rule):** before doing any task that changes the app, website, marketing files or settings,
explain the plan and get the owner's approval. After building, show the result (screenshots, video, file or preview) and
publish to `main` (live site) only when the owner says so. Answering questions and giving advice needs no approval.

**Project tracking:** `PROGRESS.md` is the step-by-step tracker. Read it at the start of every
session. Whenever work is finished or a decision is made, update it in the same commit:
- tick off steps (✅ done, 🔄 in progress, ⬜ not started)
- update the "Where we are now" line
- add any decision to "Decisions made"
- add a dated entry to the "Log"

Tests: `node --test app/tests/pricing.test.js app/tests/stats.test.js app/tests/billing.test.js app/tests/timezone.test.js app/tests/account.test.js app/tests/currency.test.js app/tests/webhook.test.js app/tests/sync.test.js`

The project started in the owner's `Nbarmash/Nbarmash` repository; that address now forwards here.
