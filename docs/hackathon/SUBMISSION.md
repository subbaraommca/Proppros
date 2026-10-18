# Submission and pitch notes

Submit at https://www.shipai.club/programs/zero-to-launch/hackathon/submit **before 12:00 PM MST, Sunday Oct 18**. Copy and paste each field below.

## Project name
Proppros

## Live marketing site URL
https://proppros.vercel.app

## What your business does
Proppros is property management software for landlords and property management companies. It puts leases with e-signature, rent tracking, repairs, vacancy marketing and a tenant portal in one place, so owners and their teams spend less time on paperwork and fill vacancies faster.

## What the site is for
The site explains Proppros to landlords and property managers and shows real product screens (example data). Visitors can explore six feature pages, read the pricing and FAQ, and start free with a real sign-up.

## What you shipped
Everything below was built new this weekend (first commit Sat Oct 17, 12:06 PM; 30 commits since).

1. **The product: Proppros.** Property management software for landlords and property management companies.
   - Properties, units, tenants and leases. Lease templates with built-in e-signature, renewals, move-in and move-out inspections, deposit letters.
   - Rent ledger: monthly charges post on their own, recorded payments with receipts, late fees, balances due.
   - Maintenance: requests with photos, work orders, vendors, quotes, invoices, preventive schedules, appliance records.
   - Vacancies: public listing pages, online applications, screening reports, adverse-action notices.
   - **"Market this listing":** ready-to-post ad text with a fair-housing check, share buttons, a share image and a printable QR flyer for every vacancy.
   - Communication: tenant messages, announcements, formal notices.
   - Tenant portal in the browser. Reports: profit and loss, rent roll, CSV export.
   - Teams: roles by property, several portfolios per login, two-step sign-in, plans and billing groundwork.
   - A mobile app (iPhone and Android, Expo) with a welcome screen, sign-up, maintenance, messages and payments.
2. **The marketing site.** Home page, features index, 6 feature pages, pricing and FAQ, with one main action: "Start free" (real sign-up). Every public page is prerendered with its own title, description, link-preview image and structured data, plus sitemap.xml, robots.txt and llms.txt. Lighthouse on mobile: SEO 100, accessibility 100.
3. **An AI organization in Claude Code.** 9 role agents: Product Manager, Research, Designer, Frontend, Backend, Social Media Manager, Performance Marketer, Design creator, Video creator.
   - They kept one versioned brief and a decision log.
   - They produced competitor research with dated sources, 5 design directions (the owner picked one), the site build, the vacancy kit, ad research, a static ad, a 22-second promo video (Remotion) and a social posting plan.
   - Nothing was posted or paid for without approval.
4. **Quality.** 122 automated backend tests and 10 frontend tests run on every push. Deployed on Vercel. A fictional showcase dataset is used, so no real tenant data appears in any public image.

## Receipts
```
LIVE PAGES (open without login)
- Home: https://proppros.vercel.app
- Features: https://proppros.vercel.app/features
- Vacancy marketing feature: https://proppros.vercel.app/features/vacancies
- Pricing: https://proppros.vercel.app/pricing
- For search engines and AI tools: https://proppros.vercel.app/sitemap.xml and https://proppros.vercel.app/llms.txt

FIRST VERSION vs FINAL (both built this weekend; Lighthouse on the live site, mobile)
- SEO 91 -> 100, Accessibility 96 -> 100
- Pages with their own title and description: 0 -> 20 (all prerendered HTML)
- What crawlers saw: an empty page -> full content with structured data (FAQ, software app)
- First version: https://github.com/subbaraommca/Proppros/blob/main/docs/hackathon/receipts/before/home-desktop.png
- Final: https://github.com/subbaraommca/Proppros/blob/main/docs/hackathon/receipts/after/home-desktop.png
- Dated change log: https://github.com/subbaraommca/Proppros/blob/main/docs/hackathon/RECEIPTS.md
- Full commit history: https://github.com/subbaraommca/Proppros/commits/main

"MARKET THIS LISTING" OUTPUTS
- Share image: https://proppros.vercel.app/screens/kit-share-image.webp
- Flyer: https://proppros.vercel.app/screens/kit-flyer.webp

AI TEAM (9 Claude Code agents) AND THEIR WORK
- Agents: https://github.com/subbaraommca/Proppros/tree/main/.claude/agents
- Brief, decisions, research, 5 design directions, ad plan: https://github.com/subbaraommca/Proppros/tree/main/docs/growth
- Promo video (22 s): https://github.com/subbaraommca/Proppros/blob/main/marketing/video/renders/one-calm-month-1080x1920.mp4
- Static ad: https://github.com/subbaraommca/Proppros/tree/main/marketing/social/static-a

PITCH DECK
[paste the shared deck link here]
```

## Repository URL
https://github.com/subbaraommca/Proppros

---

## Pitch notes (about 3 minutes)

1. **Who it is for (20 s):** "Landlords and property management companies who run rentals with spreadsheets, texts and paper. I am a landlord myself. I own three rentals."
2. **What it does (30 s):** "Proppros puts leases with e-signature, rent tracking, repairs and a tenant portal in one place, with team access for management companies. And it helps you fill vacancies."
3. **Show the working experience (90 s):**
   - The home page: the offer, the timeline, the features.
   - `/features/vacancies`, then sign in and open a published listing to show **Market this listing**: copy the ad text, download the flyer and scan the QR code.
   - The pricing page: free to start, honest about what is coming.
4. **How it was built (30 s):** "All of it was built this weekend, from the first commit on Saturday at noon. A nine-role AI team in Claude Code kept one shared brief and a decision log. It did the research, five design directions, the build and the marketing: here is the brief, and here is the video it made."
5. **Receipts (10 s):** "The first version had an empty page for Google. Now there are 20 prerendered pages, and SEO is 100."
