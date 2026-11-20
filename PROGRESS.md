# Coatwright — Project Tracker

**Goal:** The go-to quoting app for up-and-coming painters. Enter the job details, get an
itemized price, send it to the customer. Free to start, paid plan later.

**Where we are now:** Live at **https://getcoatwright.com/** with sign-up, **paid plans on Stripe**, **cloud backup & sync** (live Nov 20). **Commercial blueprint takeoff (beta)** built and waiting for the owner's review (not live). **Next:** owner reviews the takeoff + demo video, then sets up the beta tester (comp access) and sends his answers, blueprint and real bid; then analytics + owner dashboard. Social: finish TikTok, YouTube, X, LinkedIn; Google Search Console.

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

- ✅ 14-day trial + subscription paywall built in the app (plans screen, view-only after trial); **switched off until payments are set up**
- ✅ Website, Terms, Privacy, social kit and explainer video updated for paid plans
- ✅ Supabase project created (East US); URL + publishable key in `app/config.js`
- ✅ Accounts built: sign-in screen (Google + email code), server trial start, sign-out, offline-safe; database rules in `supabase/setup.sql` (tested on PostgreSQL: one trial per email incl. Gmail +/. variations and deleted accounts, users can't see others or change their trial); daily keep-alive workflow; Privacy/Terms/FAQ updated. **Switched off** (`accounts: false`) until setup is done
- ✅ Owner: ACCOUNTS_SETUP.md steps 1–3 (SQL ran, URLs, email code templates)
- ✅ Claude switched `accounts: true` (service worker cache v13)
- ✅ Owner tested email sign-up on the phone: code arrived in the Gmail Primary inbox, signed in
- ✅ Owner: step 4 (Google Cloud project, consent screen in production, web client, Supabase Google provider) → Claude switched `google: true` (cache v14)
- ✅ Owner tested Continue with Google on the phone
- ✅ Owner: step 5: Resend domain verified, API key made, Supabase custom SMTP on (hello@getcoatwright.com); rate limit raised
- ✅ Currency setting: quotes, invoices, stats in the painter's currency (20 choices), chosen once from the phone's region and changeable in Settings; existing users stay on $
- ✅ Local starting prices: new painters abroad get the US starting prices converted once at a built-in approximate rate and rounded (e.g. $55/hr → £43/hr); presets too; switching currency in Settings offers a one-time conversion. Prices never follow live exchange rates
- ⬜ Metric units (m², litres), when non-US painters sign up
- ✅ Trial countdown in the app: banner and Settings show days left + end date; one-time reminder card at 7, 3 and 1 days left (shows once billing is on)
- ⬜ Trial-ending reminder email 3 days before (Supabase scheduled job + Resend), built with billing
- ✅ Subscribers: plan, renewal date and price in Settings and Plans; "Ends on …" after cancelling; payment-problem banner. Renewal reminder emails come from Stripe (BILLING_SETUP step 6)
- ✅ Stripe payments built: Payment Links tied to the account (client_reference_id), webhook Edge Function (`supabase/functions/stripe-webhook`) records subscriptions in `supabase/billing.sql` (tested on PostgreSQL), app unlocks by itself after checkout, customer portal for manage/cancel
- ✅ Complimentary access (free Pro for the owner, demos, testers): `supabase/comp.sql`, granted by email from the SQL Editor only; app shows "Complimentary" (tested on PostgreSQL + simulated phone)
- ✅ Owner ran comp.sql and granted their own sign-in account free Pro (note "Owner"); app shows "Complimentary access (Owner)". Add or remove testers: BILLING_SETUP → Free Pro (note e.g. 'Beta tester')
- ✅ Founding members: Stripe coupon 50% forever + code FOUNDER (max 100, Stripe enforces); webhook numbers founders 1–100 and sends "You're Founding Member #N of 100" via Resend; badge in Settings/Plans; "X of 100 spots left" on the app's plans screen
- ⬜ "X of 100 spots left" on the website pricing card too
- ⬜ Owner: register the business name "Coatwright" (Ontario Business Registry → Master Business Licence); needed for TikTok/Facebook/LinkedIn business verification and a business bank account. Ask an accountant: sole proprietor vs incorporating. **Owner's decision: wait until about $30K in sales** (same time as GST/HST registration). Note: the name rule applies regardless of income; risk of waiting is small (no verified badges, no business bank account)
- ✅ Owner: Stripe account (Canada), Managed Payments, payouts weekly, 2FA, verification submitted
- ✅ Owner: Stripe product ($24/mo, $199/yr, SaaS business use), FOUNDER coupon (50% forever, max 100, first order only), Monthly and Yearly Payment Links, customer portal link → saved in `app/billing.js` (billing still off)
- ✅ Owner: `BILLING_SETUP.md` steps 2–11 (product, coupon, Payment Links, portal, emails, billing.sql, webhook function + secrets) → send Claude the 3 links
- ✅ Claude switched billing on (startDate 2026-11-15: everyone's 14-day trial counts from today; cache v22)
- ⬜ End-to-end purchase test: skipped by the owner for now (cash). Free option when ready: one-time 100% code OWNERTEST + set secret FOUNDER_PROMO_CODES to the FOUNDER promo ID. Until then, check Stripe → Webhooks → Event deliveries after the first real sale

- 🔄 Accounts ✅ and cloud sync (quotes on any device): database ready, switched on, waiting for owner's approval to publish
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

## Next up (approved plan, in order; each shown to the owner before going live)

- 🔄 Cloud backup & sync (built, tests pass; owner ran the SQL 2026-11-20 and the check passed; `sync: true`; publishes after approval): jobs, customers, expenses, settings and logo saved to the painter's own account (Supabase, read/write own rows only), works offline, restore on a new device, safe first sync; Privacy/Terms/app wording updated. Owner runs one SQL script
- 🔄 Commercial blueprint takeoff (beta, built 2026-11-20, waiting for owner review): open PDF plans, scale (read from the sheet or a known dimension), measure walls/areas/counts by paint system, typed totals from Adobe/Bluebeam, bid by hours or unit prices, extra costs, alternates, proposal with inclusions/exclusions; computer, tablet, phone; demo office plan + 80 s demo video. Originally planned as a "takeoff totals" entry: type measured wall/ceiling sq ft, trim LF, doors per area → hours, paint, materials, quote. Maybe import a Bluebeam/Adobe measurement export. Beta tester (commercial painter) to send a sample blueprint, his measurements and his actual bid
- ⬜ Usage analytics (actions only) + private owner dashboard (sign-ups, trials, trial→paid, founder spots, usage); website analytics (Cloudflare or Plausible); Privacy Policy updated
- ✅ Measure blueprints inside Coatwright (PDF + scale + trace), part of the takeoff above. Later: plan files stored online (Supabase Storage) so they open on every device; Commercial plan checkout (~US$59–79/mo); AI auto-takeoff only if commercial grows

## Phase 2 — Paint store partnerships (after the first painters)

- ✅ Pitch deck for paint stores: `marketing/store-pitch/Coatwright-Paint-Store-Pitch.pptx` (problem, how it works, store and contractor benefits, illustrative sales maths, store-branded version, free 60-day pilot, pricing, next steps; speaker notes on every slide)
- ✅ Paint picks per room (colour name/code, latex or oil-based, sheen for walls, ceiling, trim & doors; new rooms copy the last room's picks) + **Paint order** card: same paint across rooms combined, exact gallons from the quote rounded to pails/gallons/quarts, store name/email and pickup date, Email store / Text / Copy
- ✅ Paint per room shown live on each room card; **Paint tally**: by room (surface, brand, type, sheen, colour, exact gallons) and what to buy for the whole job; **brand** field (suggestions); **price per gallon per paint** (defaults from Settings) costs the paint into the quote for new jobs (older jobs keep their totals); brand + colour now appear on the customer's quote
- ⬜ Later: slower labour for oil-based paint; store price lists (a partner store's real prices loaded automatically)
- ⬜ 20–50 painters using Coatwright (proof for stores)
- ⬜ First free pilot with a local independent paint store (Benjamin Moore dealers and other independents; Sherwin-Williams stores are company-owned)
- ⬜ Paid store plans ($299/store/month or $12/contractor/month as starting points), then dealer groups, then brand partnerships (brand names and colour libraries only with permission)

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
| 2026-11-20 | Commercial takeoff is free for everyone while in beta; a paid Commercial plan comes after the beta tester confirms its value | Win the first commercial users first; price later with real feedback |
| 2026-11-20 | Cloud backup is automatic for signed-in painters (one private row per account; newest change wins per job; deletes remembered; device works offline) | A lost or new phone never means lost work; simplest for painters; the app keeps working with no signal |
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
| 2026-11-15 | Payments on **Stripe Managed Payments** instead of Lemon Squeezy; no license keys | Stripe owns Lemon Squeezy and steers new sellers to Managed Payments (same merchant-of-record tax handling, ~3.5% + card fee). With accounts, a webhook unlocks the app automatically: no keys to copy |
| 2026-11-15 | Owner's Stripe account is in Canada, store prices in USD, payouts to a CAD bank | Owner lives in Canada; identity, payouts and tax forms must match |
| 2026-11-16 | Register the business name and GST/HST together at about $30K in sales | Keep early costs down; platform verification can wait |
| 2026-11-16 | Phase 2: partner with independent paint stores ("Coatwright for [Store]"), free pilot first | Each store reaches many contractors; stores gain earlier, bigger, loyal orders. Store names only, no brand names without a licence |
| 2026-11-17 | Run every task by the owner first; publish only after the owner approves the result | Owner wants to review before anything changes or goes live |

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
- **2026-11-15** — Owner started Lemon Squeezy, which offered Stripe Managed Payments; chose Stripe. Owner created the Stripe account (Canada, Managed Payments, weekly payouts, Radar Lite, 2FA) and submitted verification. Built Stripe payments: billing.sql, stripe-webhook function, app unlock after checkout, founder numbers + email, renewal info, portal; rewrote BILLING_SETUP.md, Terms and Privacy for Stripe.
- **2026-11-15** — Owner created the Stripe product, prices, FOUNDER code, both Payment Links and the customer portal; links added to the app (billing still off). Refund requests set to owner approval.
- **2026-11-15** — Owner set Stripe emails, ran billing.sql, deployed stripe-webhook (JWT verification off), added the Stripe webhook destination (5 events) and the two secrets. Webhook now prefers Supabase's newer secret key (SUPABASE_SECRET_KEYS) over the deprecated service role key.
- **2026-11-15** — Owner redeployed the webhook (JWT off). Billing switched on: trials run from Nov 15, 2026; plans screen live with Stripe Payment Links.
- **2026-11-15** — Owner skipped the test purchase for now. First trials end Nov 29, 2026, so the first possible renewal-driven sale is then (anyone can still buy earlier).
- **2026-11-15** — Added LinkedIn to the social kit (Coatwright Page, Founder & CEO profile, launch post) with new LinkedIn banner and company cover; fixed the X header (phone covered the headline).
- **2026-11-15** — Added `marketing/COMMUNITIES.md`: groups & communities playbook (Facebook groups, Reddit, LinkedIn, Instagram/TikTok), rules, daily routine, reply templates, founder posts, follow-up and tracking.
- **2026-11-15** — Added `marketing/CHROME_PROMPTS.md`: copy-paste prompts for the Claude in Chrome extension to set up Instagram, Facebook Page, TikTok, YouTube, X, LinkedIn (Page + Founder & CEO profile), 2FA and post scheduling in Meta Business Suite.
- **2026-11-16** — Owner created Instagram **@coatwrightapp** (business account, App page, bio, link, first post). Use `coatwrightapp` on every other platform. Instagram linked from the website footer.
- **2026-11-16** — Owner created the Facebook Page "Coatwright" (App page, bio, logo, link, email). Footer links it via the share link for now; switch to facebook.com/coatwrightapp once the username can be set.
- **2026-11-16** — Facebook Page username set: facebook.com/coatwrightapp (footer updated).
- **2026-11-16** — Owner creating TikTok @coatwrightapp. TikTok business verification needs registration documents, so skipped for now; registering the business name added to the plan.
- **2026-11-16** — Owner posted on TikTok, but used an old saved explainer that still showed the GitHub address. Kit download links now end in `?v=2` so phones fetch the newest files; added how to save videos.
- **2026-11-16** — Owner got a "claim your listing" email from a domain-listing site: advised it's spam/phishing aimed at new domains; ignore and report. Next session: finish TikTok, then YouTube/X/LinkedIn, and set up Google Search Console.
- **2026-11-16** — Owner wanted a free account to demo. Built complimentary access (database-granted by email, read-own RLS, Gmail variations match). Cache v23.
- **2026-11-16** — Owner's idea: partner with paint stores. Advised independent dealers first, store branding (not brand names), free pilot, simple per-store pricing. Built the store pitch deck (11 slides with speaker notes).
- **2026-11-17** — Owner noticed Venmo/Zelle (US-only) in the app. Payment methods painters log now follow their currency (Canada: Interac e-Transfer and cheque; US: Zelle, Venmo, check; elsewhere bank transfer), with a matching example for invoice payment instructions; website wording made international. Cache v24.
- **2026-11-17** — Owner's idea: pick colour, latex/oil and sheen per room, and the app knows the paint needed. Built paint picks per room and the Paint order (send to store). Cache v25.
- **2026-11-17** — Owner asked to see paint per room as rooms are added, a final itemized tally with colours, sheen, brand and prices. Built: per-room paint line, by-room tally, brand, per-paint price → quote (new jobs only, older quotes unchanged). Cache v26.
- **2026-11-17** — Owner saw "CA$" on invoices (phone set to US English). Money now shows the plain local symbol ($, £, €…) on quotes, invoices and stats, whatever the phone language; Coatwright's own plan prices still say US$. Cache v27.
- **2026-11-17** — Owner asked what "Exact measure" was for (the boxes were always editable). Removed it: Small/Medium/Large presets plus "Or type the exact size"; typing shows "📏 Measured". Cache v28.
- **2026-11-17** — New explainer video (88 s): sign-up, setup with currency, rooms, paint picks per room, paint tally & order, every job type, quote, win → invoice, stats, founding-member end card with getcoatwright.com. Same Kokoro voice; real app recordings with demo data. Source in `marketing/video-src/`; website and kit links bumped to ?v=3.
- **2026-11-17** — Owner doesn't want the new video live yet (no paint-store deals; pauses between lines). Restored the original 50 s explainer on the website; the new version is being reworked (existing video + paint features, no store-order claim, tighter pacing).
- **2026-11-17** — Working agreement added to CLAUDE.md: plans and results are approved by the owner before changes go live. New explainer draft (63 s, original video + paint scenes, no store mentions, no pauses) sent for review; not published.
- **2026-11-17** — Owner approved the new explainer: published on the website (63 s: original video + paint picks and paint tally, continuous narration, no store mentions). Poster and kit links updated (?v=5); source in marketing/video-src/.
- **2026-11-18** — Owner approved: LICENSE (All rights reserved) and a copyright line at the bottom of Settings. Plan agreed: customers first; repository private via GitHub Team when the owner has 5 minutes; trademark after the first paying customers. Owner set up hello@getcoatwright.com forwarding (Porkbun), LinkedIn Page + Founder profile, and a Google Calendar booking page.
- **2026-11-19** — Owner's first beta tester: a commercial painter who prices from blueprints (measures in Adobe). Plan: cloud backup first, then a takeoff-totals entry for blueprint estimators, then analytics + owner dashboard.
- **2026-11-20** — Owner's account has complimentary Pro (comp_access, note "Owner"); SQL verified on a local copy first (runs cleanly, safe to re-run). Does not use a founding spot.
- **2026-11-20** — Built cloud backup & sync (not live yet): `supabase/sync.sql` (table `user_data`, own-row rules, tested on a local copy), merge rules in `app/sync.js` (10 tests), app wiring behind `sync` switch in `app/config.js`, two-phone browser test (restore on new phone, edits both ways, deletes, offline, different-account guard, missing table). Privacy, Terms and website wording updated to go live with it. Owner steps and the Claude-in-Chrome prompt in `CLOUD_BACKUP_SETUP.md`. Cache v31.
- **2026-11-20** — Owner saw negative "You made" after marking test jobs Completed/Paid (status alone logs no money, but job costs count). Fix: tapping Paid offers to log the remaining balance as paid today; home shows a reminder for finished jobs with no payment logged (tap to list them); the job's payments section explains it. Cache v32.
- **2026-11-20** — Owner ran `supabase/sync.sql` with Claude in Chrome (text matched exactly, "Success. No rows returned", check: rls_on = true, policies = 3). Claude switched `sync: true`; waiting for approval to publish together with the payment fix.
- **2026-11-20** — Built the commercial blueprint takeoff (beta, not live): `app/takeoff.js` (pricing, 9 tests), `app/plan.js` (PDF viewer with pdf.js in `app/vendor/`, plan files kept on the device), screen at `#/takeoff/<job>`, proposal with alternates and scope wording, demo office plan (`app/demo/`), demo video `marketing/videos/coatwright-blueprint-takeoff-demo.mp4`. Cache v33.
