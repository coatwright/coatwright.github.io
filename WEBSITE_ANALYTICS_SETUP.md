# Website analytics (Cloudflare Web Analytics): owner setup, about 10 minutes

**What it does:** counts visits to getcoatwright.com, where visitors come from (Google, Instagram, TikTok, LinkedIn…),
which pages they view, and their country and device. Free, no cookies, no cookie banner. It doesn't collect names or emails.

**What changes:** nothing about your domain. The website stays on GitHub Pages and the domain stays at Porkbun.
Cloudflare only gives a small piece of code (a "beacon") that Claude adds to the website pages.

**For access later:** sign in at https://dash.cloudflare.com → **Analytics & Logs → Web Analytics** → getcoatwright.com.

---

## Step 1: create the Cloudflare account yourself (2 minutes, before using the extension)

1. Go to https://dash.cloudflare.com/sign-up
2. Use your Coatwright business Gmail. Choose a password and save it in your password manager.
3. Open the verification email from Cloudflare and click the link.
4. If Cloudflare asks you to "add a domain" or pick a plan, skip it or close it. You don't need that.

## Step 2: paste this prompt into Claude in Chrome (while signed in to Cloudflare)

````
Please help me turn on Cloudflare Web Analytics for my website getcoatwright.com, using the JavaScript snippet option only. Never type, view or change any password, and never enter payment details.

Important, do NOT do any of these: do not "Add a domain/site" to Cloudflare DNS, do not change nameservers, do not import DNS records, do not start any paid plan or trial, and do not turn on other products (Zaraz, CDN, Workers, etc.). My domain must stay at Porkbun and the site stays on GitHub Pages.

1. Open https://dash.cloudflare.com and make sure I'm signed in. If I'm asked to sign in or verify my email, stop and tell me.
2. In the left menu, open "Analytics & Logs", then "Web Analytics" (it may also be called "Web analytics" or appear under "Analytics"). If you can't find it, open https://dash.cloudflare.com/?to=/:account/web-analytics
3. Click "Add a site" (or "Add site").
4. For the hostname, enter exactly: getcoatwright.com
5. If it asks how to set it up, choose the manual option: "Manage site with JS snippet" / "Add the JS snippet" (NOT automatic setup, NOT "add to Cloudflare DNS"). Click Done / Continue.
6. Cloudflare will show a code snippet that looks like:
   <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "…"}'></script>
7. Copy that whole snippet and show it to me exactly as written. (The token in it is public, not a password.)
8. Leave all other settings as they are. Tell me if anything looked different from these steps.
````

## Step 3: send the snippet to Claude

Paste the snippet (or just the token) in the chat. It's safe to share. Claude adds it to the website pages and the Privacy Policy and shows you before publishing.
Visits usually start showing in Cloudflare within a few minutes of the change going live.
