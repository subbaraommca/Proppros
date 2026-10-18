# Proppros — Project Brief

**Version:** v2 · 2026-10-18 · Owner: Proppros founder · Kept by: Product Manager
**Status:** positioning, design direction and scope approved by the owner (2026-10-18). Build in progress.

## 1. Intake (the owner's answers)

| Question | Answer | Status |
|----------|--------|--------|
| What does the business do? | Proppros is web software (with a tenant portal) for running rental properties. It covers leases, rent tracking, maintenance, vacancies, communication and reports in one place. | VERIFIED (live at https://proppros.vercel.app) |
| Who does it help, and with what problem? | Independent landlords with about 1–20 units who run their rentals themselves with spreadsheets, texts, paper leases and email. They lose time and miss renewals, late rent and repairs. | HYPOTHESIS (owner default; research to confirm) |
| What do you offer, and how do you charge? | Free plan: up to 3 units and 2 team members. Pro: $2 per unit per month (up to 10 team members). Business: $3 per unit per month (unlimited). | VERIFIED (code: `backend/app/services/plans.py`). Paid billing is **not active yet**, so paid plans are shown as "coming soon". |
| Founder story | Built by a landlord who owns 3 rental properties and uses Proppros for them. Shown without a personal name. | VERIFIED (owner) |

## 2. Current milestone

**Relaunch the public marketing site.** It needs one clear conversion path: **"Start free"**, which is the real sign-up and onboarding (verified: it works without email verification). The site must work without a login, on desktop and phone, and be readable by search engines and AI tools (prerendered HTML). Due **2026-10-18 12:00 MST**.

## 2b. Approved positioning (v2)

- **Message:** Proppros is the all-in-one place for independent landlords. It runs leases, rent, repairs and tenants, and **helps fill vacancies**: listing pages, ready-to-post ads, share images, flyers and online applications.
- **Audience wording:** "independent landlords" and "small landlords". **Do not state a unit count** in audience or hero copy (owner, 2026-10-18). The free-plan limit appears only where plans are described (pricing page, FAQ).
- **Hero:** Option A without unit numbers. **Proof section:** Option B ("run the property, not just the payments"). **New pillar:** "Fill your vacancy" (section + feature page).
- **Design:** Direction 1 "Strata, evolved", plus the month timeline from Direction 5 as "How it works" (`docs/growth/design-directions/`).
- **New product feature in scope:** a vacancy marketing kit in each listing: ad text for listing sites and social media, a share image, a printable flyer with a QR code, and the share link. It uses fair-housing-safe wording.
- **Screens:** taken from a separate, fully fictional showcase database. The local database holds real records and must never appear in public images.

## 3. Facts the site may use (VERIFIED, live in production)

- Properties and units; tenants and leases with terms, dates and documents.
- Rent ledger: monthly charges post automatically, payments are recorded, receipts are generated and the ledger shows who is behind.
- Expenses with receipt photos; reports: profit and loss, rent roll, expenses by property, CSV export; dashboard.
- Maintenance: tenants report issues with photos; work orders, vendors, quotes, vendor invoices, preventive-maintenance schedules and appliance records.
- Leasing: lease templates, **built-in e-signature**, renewals, move-in and move-out inspections with photos, security-deposit disposition letters.
- Vacancies: public listing pages with share links, online rental applications, screening reports entered from the landlord's screening provider, adverse-action notice.
- Communication: tenant messaging, announcements, formal notices (PDF), move-out notices.
- Tenant portal in the browser: lease, balance, documents, maintenance requests, messages. No app to install.
- Team access by role (manager, accountant, maintenance), limited to chosen properties. Two-factor sign-in.

**Do NOT claim (not live):** online rent payment, SMS texts, paid-plan checkout, the mobile app in the app stores, automatic screening feeds, AI features, bank sync, tax forms. Email delivery from production needs a verified sending domain, so do not promise email notifications on the site.

## 4. Proof we have

- Real product screens, taken from **demo data only**.
- The founder story (a landlord with 3 rentals).
- **No** customer testimonials, logos or usage metrics. Leave those sections out.

## 5. Owner decisions (defaults accepted 2026-10-17)

| # | Decision |
|---|----------|
| D1 | Audience: independent US landlords with 1–20 units. No city-specific angle. |
| D2 | Main CTA: "Start free", leading to the real sign-up. Secondary: "See pricing". |
| D3 | Prices shown as in the code. Pro and Business are labeled "coming soon". |
| D4 | No testimonials. Screenshots from demo data only. |
| D5 | Domain stays proppros.vercel.app. |
| D6 | Optional free resource (a move-in/move-out checklist) only if time allows. Leads go to the owner's inbox. |
| D7 | No analytics this round. |
| D8 | The Product Designer recommends a direction from five; **the owner chooses**. The owner approves before the production deploy. |
| D9 | Marketing: one static creative + one rendered video + a review bundle. Nothing is posted. |

## 6. Scope — acceptance criteria (max 5)

| AC | Criterion | Evidence |
|----|-----------|----------|
| AC1 | The home page states who Proppros is for, what it does and the one next step, with real product screens. | Desktop and phone screenshots |
| AC2 | "Start free" creates a real account and lands in onboarding. | Screen recording or screenshots + server response |
| AC3 | Home, pricing and feature pages return full HTML without JavaScript, each with its own title, description, OG image and JSON-LD. Sitemap, robots and llms.txt are present. | `curl` output + Lighthouse SEO |
| AC4 | No horizontal scroll at 390px; Lighthouse accessibility ≥ 95 on phone. | Lighthouse JSON + screenshots |
| AC5 | Before/after evidence and a dated change log exist. | `docs/hackathon/receipts/` |

## 7. Open questions

- Q1: Does the Resend account allow sending to the owner's inbox (`onboarding@resend.dev` sender)? This only matters for D6.
- Q2: Research must confirm the audience and the main pains with dated sources.

## 8. Version history

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-10-17 | Intake from existing facts and the owner's accepted defaults. |
| v2 | 2026-10-18 | Research (RESEARCH v1) folded in. Owner chose Direction 1 + timeline, the vacancy kit, and no unit numbers in the copy. |
