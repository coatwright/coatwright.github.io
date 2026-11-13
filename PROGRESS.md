# Coatwright — Project Tracker

**Goal:** The go-to quoting app for up-and-coming painters. Enter the job details, get an
itemized price, send it to the customer. Free to start, paid plan later.

**Where we are now:** Live at https://coatwright.github.io/ (app at /app/) with onboarding, quoting, business tools, invoices, schedule, customers, Privacy & Terms, and support email coatwrightapp@gmail.com. **Next (owner): create social accounts with the kit, test with 5–10 painters.**

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
- ⬜ Buy coatwright.com later (optional, ~$10–15/yr); not needed while the free address works
- 🔄 Name check: web search found no company, website or app using Coatwright (only a *cancelled* "COATRIGHT" trademark). Owner still to buy the domain, grab @coatwright handles and confirm at tmsearch.uspto.gov
- ⬜ Give it free to 5–10 local painters
- ⬜ Collect feedback: what's confusing, what's missing, what they'd pay

## Phase 3 — Make it better based on feedback 🔄

- ✅ Exterior: whole-house exterior (home size, stories, siding type, condition; siding, trim & fascia, soffits), decks, fences, entry doors, garage doors, shutters
- ✅ Floors: garage floor (1/2/3-car presets) with floor paint, epoxy or epoxy + flakes; basement and porch/patio floors; shop/warehouse floor for commercial
- ✅ "Outside & floors" section works with both Quick and Room-by-room interior pricing; own prices and work speeds in Settings
- ✅ Cabinets (kitchen & vanity: doors, drawers, boxes, spray vs brush, insides) and add-ons: wallpaper removal, popcorn ceiling removal (optional asbestos test), drywall repair
- ⬜ Fixes from painter feedback

## Phase 4 — Start making money ⬜

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
| 2026-11-13 | Explainer narrated with a free offline text-to-speech voice (Piper, LibriTTS, CC BY 4.0) with credit on the end card | Commercial use allowed with attribution; other free voices had non-commercial or unclear licenses |
| 2026-11-12 | Name: **BidBrush** (replaced) | Says what it does (bids) and who it's for (painters); short and works as a social handle |

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
