# Proppros marketing site — five visual directions

v1 · 2026-10-17 · Product Designer · Brief: PROJECT-BRIEF v1 · Research: `../DESIGN-RESEARCH.md`

All five use the same real copy and the same page order: nav with one primary action, hero (offer, Start free, See pricing, product visual), how it works in 3 steps, features, pricing teaser, FAQ, closing CTA, footer. Each preview renders the hero plus 2–3 sections. Every product visual uses example data and says so.

| # | Direction | One-line idea | Strengths | Risks | Preview |
|---|---|---|---|---|---|
| 1 | **Strata, evolved** | Today's dark copper brand, now with a clear offer and a dashboard beside it. | Matches the app people land in after sign-up. Fonts and tokens already exist, so it is the fastest to build tonight. Premium and calm. | Dark pages can feel "techy" to some older landlords. Least surprising to judges who saw the old site. | `01-strata-evolved/desktop.png`, `phone.png` |
| 2 | **Ledger Paper** | A clean account book; the rent ledger is the hero. | Speaks directly to spreadsheet users. Very trustworthy for money. Numbers read instantly. | New brand (light, serif) breaks from the dark app. Can feel plain or old-fashioned. | `02-ledger-paper/…` |
| 3 | **Front Porch** | Warm forest and cream, paper artifacts of a lease, a repair and a tenant balance. | Most human. The founder fact gets a full band. Friendly to first-time landlords. | Softer, less "serious software". The paper cards are illustrations, not real screens. Most visual work. | `03-front-porch/…` |
| 4 | **Unit Grid** | Swiss type and one tile per unit, colored by status. | Most distinctive and memorable. Very strong on desktop. | The grid is not a real screen today, so it risks over-promising. Cold for some visitors. | `04-unit-grid/…` |
| 5 | **Calm Month** | One month as a timeline: rent posts, a lease signs, a repair arrives, a report exports. | Explains the product as a story, not a list. Works very well on phone (vertical rail). | Light navy/teal is close to many SaaS sites. The timeline is an illustration. | `05-calm-month/…` |

Checks done on all five: no horizontal scroll at 390px (scrollWidth = 390), key text/background pairs ≥ 4.5:1, reduced-motion fallback in CSS. Fixed during review: overlapping cards that hid text in Front Porch, and a wrapping status tag in Ledger Paper.

## Simulated landlord evaluation

> **Simulated design judgment, not research.** I imagined one persona: a landlord with 4 units in two buildings, using a spreadsheet and texts today, checking the site on a phone in the evening. No real users were asked.

1. **Strata, evolved:** "I can see it is for small landlords and that it is free for 3 units. The dashboard looks like real software. It looks a bit like a tech product, but it is clear."
2. **Ledger Paper:** "This looks like my spreadsheet, only tidy. I trust it with money. It does not show me repairs or tenants at first glance."
3. **Front Porch:** "This feels friendly and the founder is a landlord like me. I am not sure what the actual screens look like."
4. **Unit Grid:** "I like seeing every unit at once. Then I wonder if the app really shows it like this."
5. **Calm Month:** "This is exactly what my month looks like. I understand what it does without reading a feature list."

## Recommendation

**Direction 1, Strata, evolved, with one idea from Direction 5:** use the Calm Month timeline as the "How it works" or features section.

Reasons:
- **Continuity.** "Start free" lands people in the dark Strata app. A matching site makes the step from page to product feel like one experience.
- **Proof.** It puts a real-looking dashboard in the hero, our strongest proof without reviews or logos.
- **Delivery risk.** Tokens, fonts (self-hosted) and components already exist in `frontend/src/styles.css`. The deadline is 2026-10-18 12:00 MST.
- **Supporting idea.** The month timeline from Direction 5 explains the product best on phone and fills the gap that the six feature cards leave.

Tradeoff: Direction 1 is the least surprising. If the owner wants a bolder change and accepts a light theme, Direction 5 is my second choice.

**Decision needed from the owner:** choose a number (1–5) or approve "1 with the timeline from 5".

## Shared copy (visitor-facing, all directions)

- **Headline:** Leases, rent and repairs in one place.
- **Lead:** Property management software for independent landlords with 1 to 20 units. Track rent, sign leases online and handle repairs. Your tenants get their own portal.
- **CTAs:** Start free (primary) · See pricing (secondary)
- **Under CTA:** Free for up to 3 units. No card needed.
- **Founder:** Built by a landlord with 3 rentals. The founder uses Proppros to run those 3 rentals.
- **How it works:** 1 Add your properties. Enter each property and its units. Add current tenants and lease dates. · 2 Invite your tenants. Tenants sign leases online and use their portal in the browser. They install nothing. · 3 Run the month. Rent charges post each month. Record payments, handle repairs and see who is behind.
- **Features:** Leases with e-signature · Rent ledger · Maintenance · Vacancies · Tenant portal · Reports (text in each preview).
- **Pricing teaser:** Free, $0, up to 3 units and 2 team members · Pro, $2 per unit per month, up to 10 team members, coming soon · Business, $3 per unit per month, unlimited team members, coming soon.
- **FAQ:**
  - *Is Proppros free?* Yes. The Free plan covers up to 3 units and 2 team members. You do not need a card.
  - *Do my tenants need an app?* No. Tenants use their portal in a web browser.
  - *Can tenants pay rent online?* Not yet. You record payments in Proppros, and it creates receipts.
  - *Can I sign leases online?* Yes. Proppros has built-in e-signature for leases.
  - *Who built Proppros?* A landlord who owns 3 rental properties and runs them with Proppros.
- **Closing CTA:** Start with your first property today. [Start free]
- **Footer:** © 2026 Proppros · Pricing · Privacy · Terms · Sign in

Facts: all from PROJECT-BRIEF v1 §1 and §3 (VERIFIED). "Three steps to a calmer month" is a section title, not a claim.
