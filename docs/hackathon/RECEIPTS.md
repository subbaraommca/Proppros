# Receipts: what we shipped this weekend

**Project:** Proppros (an existing product). **Live site:** https://proppros.vercel.app
**Window:** Sat 2026-10-17 → Sun 2026-10-18 (MST)

## Before (captured 2026-10-17, 22:45 MST)

| Evidence | File |
|----------|------|
| Home, pricing and help pages on desktop and phone | `receipts/before/*-desktop.png`, `*-phone.png` |
| What crawlers and AI tools received: an empty `<div id="root">`, one generic title for every page | `receipts/before/home-raw-html.txt` |
| Lighthouse, mobile: Performance 92 · Accessibility 96 · Best practices 96 · SEO 91 | `receipts/before/lh-mobile.json` |
| Lighthouse, desktop: Performance 99 · Accessibility 97 · Best practices 96 · SEO 91 | `receipts/before/lh-desktop.json` |
| No sitemap, no robots.txt, no llms.txt, no Open Graph image, no structured data | — |
| Pricing page showed "Start with Pro / Business" buttons although paid billing is not active | `receipts/before/pricing-desktop.png` |

## Change log

| Time (MST) | Role | What shipped | Evidence |
|------------|------|--------------|----------|
| 10-17 23:05 | Product Manager | 9-role AI organization set up as Claude Code agents with shared skills | `.claude/agents/`, `.claude/skills/` |
| 10-17 23:20 | Product Manager | Project brief v1 + decision log | `docs/growth/PROJECT-BRIEF.md`, `DECISIONS.md` |
| 10-17 23:40 | Positioning & Research | Competitor pricing, landlord pains and positioning options with dated sources | `docs/growth/RESEARCH.md` |
| 10-17 23:50 | Product Designer | Five visual directions with a written design guide each; owner chose Direction 1 + timeline | `docs/growth/design-directions/` |
| 10-17 23:45 | Frontend Engineer | Build-time prerendering: every public page now ships full HTML, its own title and description, canonical URL, Open Graph tags and JSON-LD. The browser hydrates it (no flash). | `frontend/src/entry-server.tsx`, `frontend/scripts/prerender.mjs` |
| 10-17 23:45 | Frontend Engineer | sitemap.xml, robots.txt and llms.txt generated at build | `/sitemap.xml`, `/robots.txt`, `/llms.txt` |
| 10-18 00:05 | Frontend Engineer | New marketing site: home, features index, 6 feature pages, pricing (paid plans now "Coming soon"), FAQ with FAQPage schema | `frontend/src/pages/MarketingPages.tsx`, `frontend/src/marketing/` |
| 10-18 00:10 | Content Creator · Design | Open Graph share image | `frontend/public/og.png` |
| 10-18 00:15 | Backend Engineer | Fictional showcase dataset and seed script (no real data), 24 product screenshots | `backend/scripts/seed_showcase.py`, `frontend/public/screens/` |
| 10-18 00:25 | Performance Marketer | Ad research, specs, one-channel test plan and two creative briefs | `docs/growth/ADS-RESEARCH.md` |
| 10-18 00:30 | Backend + Frontend Engineers | **New product feature: "Market this listing" vacancy kit.** Share link and share buttons; ready-to-post ad text for listing sites, social media and messages (fair-housing safe, with a warning for risky words); a printable flyer PDF with photo and QR code; a 1080×1350 share image. 5 new tests (121 backend tests pass). | `backend/app/services/listing_marketing.py`, `frontend/src/components/VacancyKit.tsx` |
| 10-18 00:40 | Frontend Engineer | Kit fixes found in review: the share image now uses the configured site link (not the browser address), and long links are cut cleanly | `VacancyKit.tsx` |
| 10-18 00:45 | Frontend Engineer | Vacancies feature page shows the kit, a real share image and a real flyer | `/features/vacancies` |
| 10-18 00:35 | Content Creator · Design | Static ad A (4:5, 1440×1800 and 1080×1350) with caption and alt text | `marketing/social/static-a/` |
| 10-18 00:55 | Content Creator · Video | 22-second 9:16 promo video "One calm month", rendered with Remotion from editable source | `marketing/video/renders/one-calm-month-1080x1920.mp4`, `marketing/video/src/` |
| 10-18 00:50 | Frontend Engineer | Font preloading for the hero; no horizontal scroll at 390px on every new page; 10/10 frontend tests pass | `frontend/scripts/prerender.mjs` |

| 10-18 01:20 | Product Manager | Deployed to production after owner approval (commit `6fbce05`); CI passed | https://proppros.vercel.app |

## After (live, captured 2026-10-18 01:25 MST)

| Evidence | Before | After | File |
|----------|--------|-------|------|
| Raw HTML for crawlers and AI tools | Empty `<div id="root">`, 745 bytes | Full page content, 28 KB, with Organization, SoftwareApplication and FAQPage (9 questions) JSON-LD | `receipts/after/home-raw-html.html` |
| Public pages with their own title and description | 0 (one generic title) | 20 (home, features, 6 feature pages, pricing, help + 10 articles) | `/sitemap.xml` |
| sitemap.xml · robots.txt · llms.txt · Open Graph image | None | All present | `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/og.png` |
| Lighthouse mobile (Perf · A11y · Best · SEO) | 92 · 96 · 96 · 91 | 89 · **100** · 96 · **100** | `receipts/after/lh-mobile.json` |
| Lighthouse desktop | 99 · 97 · 96 · 91 | 99 · **100** · 96 · **100** | `receipts/after/lh-desktop.json` |
| Screens on desktop and phone | Home, pricing, help | Home, features, vacancies, pricing, help | `receipts/after/*-desktop.png`, `*-phone.png` |
| Pricing honesty | "Start with Pro" buttons for inactive billing | Paid plans marked "Coming soon" | `receipts/after/pricing-desktop.png` |
| Vacancy marketing | Share link only | Ad text, share buttons, share image, QR flyer, fair-housing check | `/features/vacancies` |

Note: mobile performance is 3 points lower because the page now ships real content and product images; first paint is 2.2 s and blocking time 80 ms.
