# Coatwright

Quoting and business software for painters. Price any paint job in minutes, send a professional itemized quote,
and know what you really made.

- **Website:** https://coatwright.github.io/
- **App:** https://coatwright.github.io/app/

## What's where

| Path | What it is |
|---|---|
| `index.html`, `privacy.html`, `terms.html`, `landing/` | Public website (landing page, legal pages, images) |
| `app/` | The Coatwright app (plain HTML/CSS/JS, no build step) |
| `app/pricing.js`, `app/stats.js` | Pricing engine and business math (pure functions, tested) |
| `app/tests/` | Unit tests |
| `marketing/` | Video plan, demo videos, social media kit |
| `PROGRESS.md` | Step-by-step project tracker |

## How it works (for painters)

1. **Set up once** (⚙️): business name, logo, labor rate, markup and paint prices.
2. **New Quote**: pick Residential (House / Townhouse / Condo) or Commercial, enter the customer.
   Add **Exterior, floors & specialty**: whole-house exterior, deck, fence, doors, shutters, garage floor (paint, epoxy or flakes),
   kitchen cabinets and vanities, wallpaper removal, popcorn ceiling removal, drywall repair.
   Use **⚡ Quick** for a ballpark from the total square footage, or **📐 Room by room**: tap room types (Bedroom, Kitchen…).
   Pick Small / Medium / Large or type exact measurements, tap what's being painted
   (walls, ceiling, trim, doors), and choose coats and wall condition. The price updates as you go.
3. **Track the job**: mark it Sent → Won → Scheduled → Completed → Paid, log payments and the real costs.
   🧾 Turn a won job into an **invoice**, see upcoming work on the 📅 **schedule**, and every customer's history in 👥 **Customers**.
   📊 **Stats** shows what you made this year, money owed, win rate, monthly chart and insights.
   Export spreadsheets for your accountant and back up your data in ⚙️ Settings.
4. **Review & Send**: email, text, save as PDF or copy the itemized quote.
   A private "Your numbers" panel shows hours, crew days, cost, profit and margin.

Quotes are saved on the device and the app works offline after the first visit.
Add it to the home screen ("Add to Home Screen" on iPhone, "Install app" on Android).

## How the price is calculated

- Wall area = room perimeter × height − 20 sq ft per door − 15 sq ft per window
- Labor hours = area × coats ÷ production rate, adjusted for wall condition
  (Fair +15%, Rough +35% plus patch & prime) and ceilings 10 ft+ (+15%) / 12 ft+ (+30%)
- Paint = area × coats ÷ coverage, rounded up to whole gallons; supplies = % of paint cost
- Line prices = (labor or material cost) × (1 + markup)
- Then extras, discount, minimum job charge, sales tax and deposit

All of this lives in `pricing.js`. Every rate is adjustable in Settings.

## Run it locally

```bash
python3 -m http.server 8000   # website at http://localhost:8000, app at http://localhost:8000/app/
node --test app/tests/pricing.test.js app/tests/stats.test.js
```

## Publishing

This repository is the `coatwright` organization's GitHub Pages site: anything merged into `main`
is published to https://coatwright.github.io/ automatically within a minute or two.
