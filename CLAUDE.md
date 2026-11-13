# Notes for Claude

This is the home of **Coatwright**, published at https://coatwright.github.io/ by GitHub Pages
from `main` (anything merged into `main` goes live).

- Website: root `index.html`, `privacy.html`, `terms.html`, images and styles in `landing/`
- App: `app/` (plain HTML/CSS/JS, no build step). Keep the app at `/app/` so home-screen installs keep working.
- Marketing: `marketing/`
- Payments: `app/billing.js` holds the billing switch (`enabled`, `startDate`) and Lemon Squeezy checkout links; owner steps in `BILLING_SETUP.md`.
  When switching billing on, set `startDate` to that day so existing users get a full 14-day trial, and bump the cache name in `app/sw.js`.

**Project tracking:** `PROGRESS.md` is the step-by-step tracker. Read it at the start of every
session. Whenever work is finished or a decision is made, update it in the same commit:
- tick off steps (✅ done, 🔄 in progress, ⬜ not started)
- update the "Where we are now" line
- add any decision to "Decisions made"
- add a dated entry to the "Log"

Tests: `node --test app/tests/pricing.test.js app/tests/stats.test.js app/tests/billing.test.js`

The project started in the owner's `Nbarmash/Nbarmash` repository; that address now forwards here.
