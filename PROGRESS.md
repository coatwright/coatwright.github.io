# Coatwright — Project Tracker

**Goal:** The go-to quoting app for up-and-coming painters. Enter the job details, get an
itemized price, send it to the customer. Free to start, paid plan later.

**Where we are now:** Live at **https://getcoatwright.com/**. Sign-up before the trial (Google or 6-digit email code, one trial per email) is **switched on**. **Next (owner): more app fixes; Lemon Squeezy; social accounts.** Claude also owes a check of the quoting defaults against published production rates.

Legend: ✅ done · 🔄 in progress · ⬜ not started

---

## Phase 1 — Build the first version (MVP) ✅

- ✅ Choose the approach: phone-friendly web app, no AI fees, free hosting
- ✅ Pricing engine (walls, ceilings, trim, doors, coats, wall condition, ceiling height, paint gallons, supplies, markup, minimum job, tax, deposit)
- ✅ Tests for the pricing math (7 passing)
- ✅ Easy-to-use quote builder (tap-to-add rooms, size presets, live price)
- ✅ Itemized customer estimate (logo, line items, deposit, terms, signature line)
- ✅ Send options: email, text/share, save PDF, copy
- ✅ Private "Your numbers" panel (hours, cost, profit, margin)
- ✅ Settings: business info, logo, rates, paint prices, work speeds
- ✅ Quotes saved on the phone, works offline, installable on home screen
- ✅ Tested end to end on a simulated iPhone

## Phase 1b — Owner feature requests 🔄

- ✅ Choose Residential or Commercial when starting a quote
- ✅ Residential → House, Townhouse or Condo, then continue to the quote
- ✅ Commercial → 15 property types, big or small (office, retail, restaurant, medical, hotel, apartments/HOA, warehouse, school, church, gym, salon, bank, auto, government, other)
- ✅ 31 commercial area types (closets to warehouse floors); each property shows its common areas first, the rest under "More area types"
- ✅ Taller walls priced for scaffolding/lifts (16 ft+ and 20 ft+)
- ✅ Property type shown on the quote, email text and quote list; can be changed while editing
- ✅ Quick estimate from the total square footage (⚡ Quick / 📐 Room by room switch; quote says it's a ballpark)
- ✅ Property type does not change pricing rules for now (owner: "everything else is good")

## Phase 1c — Business tools (run the whole company, not just quotes) ✅

- ✅ Job status for every quote: Draft → Sent → Won → Scheduled → Completed → Paid (or Lost), with dates
- ✅ Quotes auto-marked "Sent" when emailed, texted, copied or saved as PDF
- ✅ Payments received per job (date, amount, method) with balance owed
- ✅ Real job costs: hours worked, paint & materials, crew/helper pay, other costs
- ✅ Per-job "You made" and real $/hour; compares actual vs estimated hours
- ✅ Jobs list with filters (Quotes / Won / Done / Paid / Lost), search and "owed" flags
- ✅ Business expenses (gas, tools, insurance…) that come off yearly profit
- ✅ Stats page per year: what you made, collected, margin, jobs done, avg job, $/hour, win rate, owed to you, pipeline, upcoming jobs
- ✅ Monthly money chart (with table view), residential vs commercial split, smart insights
- ✅ Exports for the accountant (jobs, payments, expenses spreadsheets)
- ✅ Backup & restore so history is never lost; data stays private on the device
- ✅ Merged to `main` (pull request #2) and live
- ⬜ Compare with bidbrush.pro feature by feature (owner to send screenshots; site is blocked from Claude's environment)
- ✅ Invoices from any won job: invoice number, due date, payments received, balance due, "how to pay"; email/text/PDF/copy
- ✅ Schedule: won jobs by start date with job length in days, late flags, and quick date-picking for unscheduled jobs
- ✅ Customers: auto-built from quotes (matched by phone/email/name), repeat-customer badge, what each paid you, job history, call/text/email/map, "new quote for this customer", name autofill
- ⬜ Ideas next: job photos, deposit links (needs online payments, Phase 4)

## Phase 2 — Get it online and in painters' hands 🔄

- ✅ Merge the code into `main` (pull request #1)
- ✅ Turn on GitHub Pages: first live at https://nbarmash.github.io/Nbarmash/coatwright/
- ✅ Free branded address: `coatwright` GitHub organization → https://coatwright.github.io/ (app at `/app/`); old address forwards here
- ⬜ Install it on your own phone and quote a real (or pretend) job
- ⬜ Check the default prices against real local numbers
- ✅ Pick a final name: **Coatwright** (first pick BidBrush was taken)
- ✅ Rename the app to Coatwright (folder is now `coatwright/`)
- ✅ Owner bought **getcoatwright.com** (Porkbun)
- ✅ getcoatwright.com connected: DNS at Porkbun (4 A + www CNAME), domain verified on the GitHub organization, DNS check successful; coatwright.github.io and the old personal address forward to it
- ⬜ Confirm **Enforce HTTPS** is ticked (repo Settings → Pages) and the padlock shows
- ⬜ Optional: free email forwarding hello@getcoatwright.com → coatwrightapp@gmail.com (Porkbun Email Forwarding)
- 🔄 Name check: web search found no company, website or app using Coatwright (only a *cancelled* "COATRIGHT" trademark). Owner still to buy the domain, grab @coatwright handles and confirm at tmsearch.uspto.gov
- ⬜ Give it free to 5–10 local painters
- ⬜ Collect feedback: what's confusing, what's missing, what they'd pay

## Phase 3 — Make it better based on feedback 🔄

- ✅ Exterior: whole-house exterior (home size, stories, siding type, condition; siding, trim & fascia, soffits), decks, fences, entry doors, garage doors, shutters
- ✅ Floors: garage floor (1/2/3-car presets) with floor paint, epoxy or epoxy + flakes; basement and porch/patio floors; shop/warehouse floor for commercial
- ✅ "Outside & floors" section works with both Quick and Room-by-room interior pricing; own prices and work speeds in Settings
- ✅ Cabinets (kitchen & vanity: doors, drawers, boxes, spray vs brush, insides) and add-ons: wallpaper removal, popcorn ceiling removal (optional asbestos test), drywall repair
- ⬜ Fixes from painter feedback

## Phase 4 — Start making money 🔄

- ✅ 14-day trial + subscription paywall built in the app (plans screen, license keys, view-only after trial); **switched off until payments are set up**
- ✅ Website, Terms, Privacy, social kit and explainer video updated for paid plans
- ✅ Supabase project created (East US); URL + publishable key in `app/config.js`
- ✅ Accounts built: sign-in screen (Google + email code), server trial start, sign-out, offline-safe; database rules in `supabase/setup.sql` (tested on PostgreSQL: one trial per email incl. Gmail +/. variations and deleted accounts, users can't see others or change their trial); daily keep-alive workflow; Privacy/Terms/FAQ updated. **Switched off** (`accounts: false`) until setup is done
- ✅ Owner: ACCOUNTS_SETUP.md steps 1–3 (SQL ran, URLs, email code templates)
- ✅ Claude switched `accounts: true` (service worker cache v13)
- ✅ Owner tested email sign-up on the phone: code arrived in the Gmail Primary inbox, signed in
- ✅ Owner: step 4 (Google Cloud project, consent screen in production, web client, Supabase Google provider) → Claude switched `google: true` (cache v14)
- ✅ Owner tested Continue with Google on the phone
- 🔄 Owner: step 5: Resend domain verified, API key made, Supabase custom SMTP on (hello@getcoatwright.com); rate limit raised
- ⬜ Link Lemon Squeezy subscriptions to accounts (instead of license keys) once accounts exist
- ✅ Currency setting: quotes, invoices, stats in the painter's currency (20 choices), chosen once from the phone's region and changeable in Settings; existing users stay on $
- ✅ Local starting prices: new painters abroad get the US starting prices converted once at a built-in approximate rate and rounded (e.g. $55/hr → £43/hr); presets too; switching currency in Settings offers a one-time conversion. Prices never follow live exchange rates
- ⬜ Metric units (m², litres), when non-US painters sign up
- ✅ Trial countdown in the app: banner and Settings show days left + end date; one-time reminder card at 7, 3 and 1 days left (shows once billing is on)
- ⬜ Trial-ending reminder email 3 days before (Supabase scheduled job + Resend), built with billing
- ⬜ Subscribers: next renewal date and price in Settings, reminder before an annual renewal (needs the subscription link above)
- ⬜ Founding members: Lemon Squeezy discount "forever", max 100 redemptions (Lemon Squeezy enforces the cap); webhook → Supabase numbers each founder and sends the "You're Founding Member #N of 100" email via Resend; badge in Settings; "X of 100 spots left" on the pricing page. Founding price: $12 (half of $24)
- ⬜ Owner sets up Lemon Squeezy (see `BILLING_SETUP.md`) and sends the 3 checkout links
- ⬜ Claude switches billing on (`app/billing.js`: enabled, startDate, checkout links) and tests a real purchase together with the owner

- ⬜ Accounts and cloud sync (quotes on any device)
- ⬜ Customer "Accept quote" link with e-signature
- ⬜ Deposit payments through Stripe
- ⬜ Room scanning with the iPhone's LiDAR sensor (needs a native iPhone app; Pro models only) — premium feature
- ⬜ Paid plan (e.g. free for 3 quotes/month, monthly fee for unlimited + logo)
- ✅ Landing page redesigned to look professional (menu, trust strip, feature sections, comparison table, Starter/Pro pricing, FAQ, footer, share image)
- ✅ Privacy Policy (`privacy.html`) and Terms of Service (`terms.html`), accurate to how the app stores data
- ✅ First-run onboarding in the app: welcome → business info & logo → rate presets (starting out / established / premium) → first quote or sample quote, with install-to-home-screen help
- ✅ Support email **coatwrightapp@gmail.com** on the website (footer + FAQ), Privacy, Terms and the app's Settings (Help & feedback)
- ✅ First landing page at https://nbarmash.github.io/Nbarmash/ (root `index.html`, screenshots in `landing/`); the app stays at `/coatwright/`

## Phase 5 — Grow 🔄

- ✅ Social media kit: profile picture, Facebook cover, YouTube banner, X header, first-post image, bios for each platform, step-by-step setup and first 3 posts (`marketing/SOCIAL_SETUP.md`, `marketing/social/`)
- ⬜ Owner creates the accounts (Instagram, Facebook Page, TikTok, YouTube, X) using the kit; Claude can't sign up for accounts
- ⬜ Post in painter Facebook groups and subreddits
- ✅ Video plan: 25 scripts with hooks, captions, hashtags, AI prompts and a 30-day schedule (`marketing/VIDEO_PLAN.md`)
- ✅ First 2 real app demo videos recorded (`marketing/videos/`: quick quote, business stats); more on request
- ✅ Video closing card no longer shows the github address ("Start your free trial" instead)
- ✅ Phone install: proper app icons (iPhone + Android), install screen in the app, home-screen reminder, Settings card, website "Get the app" section with QR code, and help for links opened inside Instagram/Facebook/TikTok
- ✅ Works in every time zone: dates stored as local calendar days, trial counted in calendar days, dates shown in the phone's local format; tested in 13 zones (UTC−11 to UTC+14) incl. daylight-saving days
- ✅ Explainer video added to the landing page (How it works section; hero button "Watch the 1-min demo")
- ✅ Explainer video with voiceover and captions (~51 s, `marketing/videos/coatwright-explainer.mp4`): whole app in 7 scenes, for pinned posts and onboarding
- ⬜ AI-generated videos (job-site scenes, voiceover): prompts ready in the plan; owner generates them in an AI video tool
- ⬜ Posting schedule: 1–3 videos a day, track which ones bring sign-ups
- ⬜ Reach out to local paint supply stores
- ⬜ Referral offer (free month for each painter referred)

---

## Decisions made

| Date | Decision | Why |
|---|---|---|
| 2026-11-12 | Web app instead of App Store app to start | Free, no app review, works on any phone |
| 2026-11-12 | No AI inside the app for now | Pricing is math; keeps running costs at $0 |
| 2026-11-12 | App lives in its own folder (now `coatwright/`) | Keeps the GitHub profile README separate |
| 2026-11-13 | Quotes start by picking Residential (House / Townhouse / Condo) or Commercial | Owner request; tailors room presets and shows the property on the quote |
| 2026-11-13 | Room scanning postponed to the native-app stage | Works well only on Pro iPhones in a native app (App Store fees, much more work); AI photo guesses are too rough for pricing |
| 2026-11-13 | Quick estimate treats the home as typical rooms (150 sq ft homes, 300 sq ft commercial) | Reuses the same pricing rules; lands around $3–6 per floor sq ft for walls + trim, in line with typical repaints |
| 2026-11-13 | Commercial covers every business type with its own common areas | Owner: "include everything, big or small" |
| 2026-11-13 | Drop the BidBrush name | Owner found bidbrush.pro; a painter estimating app called BrushBid also exists, so trademark and search confusion risk |
| 2026-11-13 | Name: **Coatwright** | "Wright" = skilled craftsman; sounds established, made-up word so easier to trademark; no painting app or business found with it |
| 2026-11-13 | Domain not required yet | Free github.io link is fine for testing; buy coatwright.com (~$10–20/yr) before marketing |
| 2026-11-13 | Profit counted when money is collected (payment dates); job costs count when the job is done | Matches how a small business sees cash; simple for the owner and accountant |
| 2026-11-13 | Data stays on the device, with backup/restore and CSV exports | Private and free now; cloud sync comes with accounts in Phase 4 |
| 2026-11-13 | Exterior estimated from home size + stories (no measuring needed); epoxy priced as a per-sq-ft kit | Fast on site, consistent with the quick-estimate approach; epoxy is bought as kits, not gallons |
| 2026-11-13 | Landing page lives at the site root; app keeps its `/coatwright/` address | Home-screen installs keep working; a future coatwright.com can point at the landing page |
| 2026-11-13 | One dedicated Coatwright email and the same username on every platform | Keeps the brand separate from personal accounts and easy to find |
| 2026-11-13 | Pricing shows Starter $0 now, Pro "coming soon" with no price | Honest: nothing to sell yet; signals a free core plus paid extras |
| 2026-11-13 | Free `coatwright.github.io` address instead of buying a domain now | No cost, branded, separate from the owner's personal GitHub; easy to move to coatwright.com later |
| 2026-11-13 | Project files moved to the `coatwright/coatwright.github.io` repository | The organization is the business's home; the personal profile repo only forwards |
| 2026-11-13 | Explainer re-voiced with a more natural female voice (Kokoro "Heart", Apache 2.0) | Owner found the first voice too computerized; Kokoro allows commercial use with no credit needed |
| 2026-11-13 | Explainer narrated with a free offline text-to-speech voice (Piper, LibriTTS, CC BY 4.0) with credit on the end card | Commercial use allowed with attribution; other free voices had non-commercial or unclear licenses |
| 2026-11-13 | Paid plans: 14-day free trial (no card), then $24/mo or $199/yr; founding members $14/mo for life (first 100) | Owner wants subscription income; trial gets painters invested before paying; yearly brings cash up front |
| 2026-11-13 | Payments through Lemon Squeezy (seller of record, license keys) | Handles sales tax; license keys can be checked by the app without running our own server |
| 2026-11-13 | After the trial: view, back up and export always work; only new quotes/invoices need a subscription | Never hold a painter's data hostage; keeps trust |
| 2026-11-13 | Dates: moments stored as universal timestamps, calendar dates as plain YYYY-MM-DD; dates shown in the phone's own format | Correct in any time zone and across daylight saving; familiar date order for each country |
| 2026-11-13 | Domain: **getcoatwright.com** (Porkbun, ~$10–12/yr) | Removes "github" from the address; Porkbun keeps renewals cheap and includes privacy |
| 2026-11-13 | Require sign-up before the trial: Google one-tap or email code; trial tied to the email | Owner wants one trial per email; matches Jobber/Housecall Pro (sign up, no card) with less friction |
| 2026-11-13 | Accounts on Supabase (free tier) rather than Firebase | Firebase's free plan sends only 5 sign-in emails/day; Supabase free covers 50k users/month |
| 2026-11-12 | Name: **BidBrush** (replaced) | Says what it does (bids) and who it's for (painters); short and works as a social handle |
| 2026-11-15 | Founding deal goes to the first 100 **paying** subscribers, price locked for life | Spots go to real customers; sign-ups who never pay don't use one. Lemon Squeezy's redemption limit enforces the 100 |
| 2026-11-15 | Founding price is $12/mo (true half price), was $14 | "Half price for life" is a clearer, honest pitch; costs at most $200/mo across all 100 founders |
| 2026-11-15 | Painters pick their own currency; picked once from the phone's region, never changed automatically; subscription stays in USD | Worldwide use without travel changing anyone's quotes; Lemon Squeezy localizes checkout and handles VAT. Metric units later, when non-US sign-ups appear |

## Log

- **2026-11-12** — Chose approach. Built and tested Phase 1 (pricing engine, quote builder,
  customer estimate, sending, settings, offline). Pushed to branch `claude/serene-carson-hods6d`.
  Created this tracker.
- **2026-11-12** — Name brainstorm: shortlist made, waiting for the owner to pick. Added the
  social-media video plan to Phase 5 (start when the app is ready to launch).
- **2026-11-12** — Owner picked **BidBrush**. Renamed the app, files and folder (`bidbrush/`).
- **2026-11-13** — Added the Residential/Commercial job type step with property types,
  commercial room presets, and the property on quotes. 9 tests passing; tested on a simulated iPhone.
- **2026-11-13** — Opened the pull request to merge into `main`. Looked into room scanning:
  postponed to Phase 4; added a whole-home square-footage quick estimate as a cheaper idea.
- **2026-11-13** — Built the square-footage quick estimate. 11 tests passing; tested on a simulated iPhone.
- **2026-11-13** — Expanded Commercial (15 property types, 31 area types, tall-wall pricing). 14 tests passing.
  Owner found bidbrush.pro; BrushBid also exists. Name to be changed before launch.
- **2026-11-13** — Checked ~20 replacement names (Quoter, Spackle, Hueprint, Tintwork and others were taken).
  Owner picked **Coatwright**. Renamed the app and folder (`coatwright/`). Added a small "Made with Coatwright" line to quotes.
- **2026-11-13** — Name check for Coatwright came up clear. Merged pull request #1 into `main`.
- **2026-11-13** — Owner turned on GitHub Pages. Deployment succeeded; the app is live.
- **2026-11-13** — Built business tools: job status, payments, real costs, expenses, yearly stats with chart and insights,
  accountant exports, backup/restore. 21 tests passing; full job lifecycle tested on a simulated iPhone.
- **2026-11-13** — Added exterior (house, deck, fence, doors, garage doors, shutters) and floors (garage floor with paint/epoxy/flake,
  basement, porch). Fixed a paint-total bug caught by the new tests. 25 tests passing; tested on a simulated iPhone.
- **2026-11-13** — Merged pull request #2 (business tools, exterior, floors); GitHub Pages redeployed.
- **2026-11-13** — Owner chose next: invoices/schedule/customers, cabinets & add-ons, landing page, video plan.
  Built invoices, schedule and customers. 27 tests passing; tested on a simulated iPhone.
- **2026-11-13** — Added cabinets and specialty add-ons (section renamed "Exterior, floors & specialty"); fixed stepper buttons overflowing on narrow phones. 29 tests passing.
- **2026-11-13** — Built the landing page with real app screenshots (sample data). Fixed stepper labels being cut off.
- **2026-11-13** — Wrote the launch video plan and recorded 2 demo videos from the real app. Fixed negative money showing as "$-140".
- **2026-11-13** — Merged pull request #3 (invoices, schedule, customers, cabinets & add-ons, landing page, video plan). All live.
- **2026-11-13** — Owner asked for social handles. Built the social media kit (images, bios, setup steps, first posts); owner to create the accounts.
- **2026-11-13** — Owner wants a more professional site. bidbrush.pro is blocked from Claude's environment (owner declined a network change). Redesigned the landing page and added Privacy Policy and Terms.
- **2026-11-13** — Added first-run onboarding (business info, rate presets, sample quote, install help). 29 tests passing; full walkthroughs pass.
- **2026-11-13** — Merged pull request #4 (landing redesign, Privacy & Terms, onboarding, social kit). All live.
- **2026-11-13** — Owner set up a free business Gmail and the `coatwright` GitHub organization. Moved the website, app, tracker and marketing to coatwright.github.io.
- **2026-11-13** — Owner created coatwrightapp@gmail.com. Added it as the support email on the site, legal pages and app.
- **2026-11-13** — Rewrote the social media kit as screen-by-screen signup answers per platform, with direct image/video download links and 2FA steps.
- **2026-11-13** — Made the explainer video: real app recordings, captions, phone frame and computer voiceover (voice chosen by measured pitch and pace; 2 alternative voices offered).
- **2026-11-13** — Added the explainer video to the landing page.
- **2026-11-13** — Owner chose paid plans ($24/mo or $199/yr after a 14-day trial, founding $14/mo, Lemon Squeezy) and a more human female voice. Built the paywall (off until payments exist), updated site/legal/marketing, re-voiced the explainer.
- **2026-11-13** — Removed the web address from the video; built the phone install experience (icons, install screens, QR code); Chrome reports the app as installable.
- **2026-11-13** — Time zone review: fixed the trial countdown (off by a day around daylight-saving changes, and in London in winter); local date formats; new 13-zone test.
- **2026-11-13** — Owner bought getcoatwright.com. Prepared the switch: CNAME file, every link, QR code and docs now use the new domain (not merged until DNS is set).
- **2026-11-13** — getcoatwright.com live: owner added DNS records and verified the domain. Header logo is now built into the pages (it showed as broken right after the switch).
- **2026-11-13** — Owner wants a real sign-up so the trial is one per email. Researched competitors (Jobber, Housecall Pro: sign up, no card) and free account services; plan agreed in principle: Google one-tap + email code on Supabase. Paused here.
- **2026-11-14** — Owner created the Supabase project. Built accounts (sign-in screen, database rules tested locally, keep-alive, setup guide); switched off until the owner finishes setup.
- **2026-11-15** — Owner finished Supabase steps 1–3 and Resend (domain verified, SMTP connected, code email templates). Email sign-up switched on.
- **2026-11-15** — Owner tested sign-up on their phone: code email reached the Primary inbox and sign-in worked.
- **2026-11-15** — Owner raised the email rate limit. Owner asked for a visible countdown to the end of the trial and to the next renewal; added to the plan.
- **2026-11-15** — Owner set up Google sign-in (Google Cloud + Supabase). Switched on "Continue with Google". Setup guide fixed: Google refuses `supabase.co` as an authorized domain and a logo triggers review.
- **2026-11-15** — Owner tested Continue with Google on their phone: works.
- **2026-11-15** — Owner's fixes: trial days left (built: banner + Settings show end date, reminder cards at 7/3/1 days) and the founding deal for the first 100 payers with a congratulations email (planned with Lemon Squeezy).
- **2026-11-15** — Founding price changed to $12/mo (half price) on the website, Terms, app and setup guide.
- **2026-11-15** — Added a currency setting for worldwide painters (detected once, never auto-changes when travelling). Subscription prices stay in USD; Lemon Squeezy shows local currency at checkout.
- **2026-11-15** — Owner asked whether quotes follow exchange rates. Built one-time conversion of starting prices (and on currency switch); prices never move with live rates so sent quotes stay fixed.
- **2026-11-15** — Told painters about currency: setup shows "Your currency" with a picker and a plain note (picked from the phone's region, starting prices converted, never follow exchange rates); website pricing note (USD, local currency at checkout) and FAQ "Does Coatwright work outside the US?".
