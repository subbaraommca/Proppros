# Submission draft and pitch notes

Submit at https://www.shipai.club/programs/zero-to-launch/hackathon/submit **before 12:00 PM MST, Sunday Oct 18**. The form fields are below; copy and paste them.

## Project name
Proppros

## Live marketing site URL
https://proppros.vercel.app

## What the site is for
Proppros is property management software for independent landlords. The site explains the product and shows real product screens (example data). Visitors can explore six feature pages, read the pricing and FAQ, and start free with a real sign-up. Landlords who use Proppros also get a new tool that helps them fill vacancies.

## What you shipped
Proppros is an existing product. This weekend we shipped:
1. **A new marketing site:** a home page with a clear offer, a "one calm month" timeline, a features index, 6 feature pages, honest pricing (paid plans "Coming soon"), and an FAQ.
2. **Search and AI readiness:** every public page is now prerendered HTML, with its own title, description, Open Graph image and JSON-LD, plus sitemap.xml, robots.txt and llms.txt. Before this, crawlers saw an empty page.
3. **A new product feature, "Market this listing":** for each vacancy, ready-to-post ad text for listing sites, social media and messages, with a fair-housing check; share buttons; a share image; and a printable flyer with a QR code.
4. **An AI organization in Claude Code:** 9 role agents (Product Manager, Research, Designer, Frontend, Backend, Social Media Manager, Performance Marketer, Design and Video creators). They kept one shared brief, recorded every decision and produced the research, five design directions, the build, an ad plan, a static ad and a rendered promo video.
5. **A launch campaign draft:** a static ad in two sizes, a 22-second video made with Remotion, social bios, a 2-week posting calendar and a review bundle. Nothing is posted without approval.

## Receipts
- Before and after log with dated changes: https://github.com/subbaraommca/Proppros/blob/main/docs/hackathon/RECEIPTS.md
- Lighthouse SEO 91 → 100 and accessibility 96 → 100 (mobile). Raw HTML went from an empty root to full content.
- Live pages: https://proppros.vercel.app · /features · /features/vacancies · /pricing · /llms.txt · /sitemap.xml
- AI team work: https://github.com/subbaraommca/Proppros/tree/main/docs/growth (brief, decisions, research, design directions, ad research, review bundle)
- Video: https://github.com/subbaraommca/Proppros/blob/main/marketing/video/renders/one-calm-month-1080x1920.mp4
- Static ad: https://github.com/subbaraommca/Proppros/tree/main/marketing/social/static-a

## Repository URL
https://github.com/subbaraommca/Proppros

---

## Pitch notes (about 3 minutes)

1. **Who it is for (20 s):** "Independent landlords who run their rentals with spreadsheets, texts and paper. I am one of them. I own three rentals."
2. **What it does (30 s):** "Proppros puts leases with e-signature, rent tracking, repairs and a tenant portal in one place. And now it helps you fill vacancies."
3. **Show the working experience (90 s):**
   - The home page: the offer, the timeline, the features.
   - `/features/vacancies`: then sign in to the showcase account and open a listing to show **Market this listing**. Copy the ad text, download the flyer and show the QR code.
   - The pricing page: free to start, honest about what is coming.
4. **How it was built (30 s):** "A nine-role AI team in Claude Code. One shared brief, a decision log, research with dated sources, five design directions, and the build. Here is the brief and here is the video it made."
5. **Receipts (10 s):** "Before, Google saw an empty page. Now: 20 prerendered pages and SEO 100."

**Demo login (made-up data):** showcase data runs locally only. For the live demo, use your own account on production, or run the showcase locally (`backend/scripts/seed_showcase.py`).
