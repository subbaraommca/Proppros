# Design research — Proppros marketing relaunch

- **Version:** v1 · 2026-10-17 · Product Designer
- **Brief read:** PROJECT-BRIEF v1
- **Method and limits:** I did not browse the reference sites tonight. The "Observed" notes come from my prior knowledge of these public homepages (knowledge up to mid-2026). They are **unverified for October 2026**. Re-check a page before quoting it. Nothing here is a conversion result.

## 1. The current Proppros site (VERIFIED, screenshots in `docs/hackathon/receipts/before/`)

| Observed | Inferred problem | Proposal |
|---|---|---|
| Centered hero, headline "Less admin. More portfolio." with an italic serif phrase. | The headline is clever but does not say what the product does. The single-word accent reads as a template. | Lead with the job: "Leases, rent and repairs in one place." Put "for independent landlords with 1 to 20 units" right next to it. |
| No product visual anywhere on the home page. | Visitors cannot see the product before they sign up. We have real screens, so this is our cheapest proof. | Show a product visual in the hero (a dashboard, ledger or month view built from example data). |
| Six equal feature cards with icons. | Every feature looks equally important; it reads as a list. | Add "How it works" in 3 steps, then features. Keep cards flat and ruled. |
| No pricing on the home page. Pricing page lists Pro and Business with active "Start with Pro" buttons. | Price is a top question for small landlords. Paid billing is not live (brief §1), so active paid buttons are misleading. | Add a pricing teaser on home. Label Pro and Business "Coming soon" with no checkout button. |
| Founder line "Built by a landlord, for landlords." only at the bottom. | It is our only real proof and it is hidden. | Move the founder fact (a landlord with 3 rentals) next to the hero CTA. |
| Phone: the six cards make a long scroll; no nav links. | Navigation on phone is thin. | Keep the nav to one primary action; add a short menu with Features, Pricing, FAQ. |

## 2. Reference sites

| # | Site | Why chosen | Observed (unverified 2026-10) | Inferred | Proposed for Proppros |
|---|---|---|---|---|---|
| 1 | [TurboTenant](https://www.turbotenant.com) | Category leader for small landlords | Bright, friendly marketing. Free-for-landlords message is prominent. Many feature pages and many CTAs. | Strong on "free" and breadth; busy pages compete for attention. | Say "Free for up to 3 units. No card needed." right under the CTA. Keep one primary action per screen. |
| 2 | [Baselane](https://www.baselane.com) | Money-first landlord tool | Banking and bookkeeping language. Product UI shots in the hero. Calm, finance-like palette. | Finance tone builds trust for money tasks. | Show money with tabular mono numbers. Avoid bank claims: we have no bank sync or payments. |
| 3 | [RentRedi](https://www.rentredi.com) | Mobile-led landlord app | Phone mockups and app-store messaging lead the page. | Their identity is the phone app. | We are browser-based with no app to install. Say that plainly; do not show app-store badges. |
| 4 | [Mercury](https://mercury.com) | Polished money SaaS (anti-template reference) | Restrained palette, large calm type, real product UI as the hero object. | Restraint signals safety for money. | Let the product visual carry color; keep the page itself quiet. |
| 5 | [Linear](https://linear.app) | Craft reference for dark product marketing | Dark canvas, precise type, product screens with subtle depth. | Dark can feel premium if contrast and spacing are exact. | Basis for "Strata, evolved": keep dark, add a real product visual and tighter rhythm. |

We copy none of these identities, words, illustrations or logos.

## 3. Category pattern summary (inferred)

- Competitors lead with **free** and **breadth**. Our edge is a calm, complete tool built by a landlord, at a small per-unit price.
- Proof in this category is usually reviews and customer counts. **We have none.** So proof must come from the product itself (real screens) and the founder fact.
- Many competitors push payments and screening. We must **not** claim online rent payment, SMS, bank sync or automatic screening (brief §3).

## 4. Page composition used for all five directions

Nav (logo, Features, Pricing, FAQ, Sign in, **Start free**) → Hero (offer, Start free + See pricing, "Free for up to 3 units. No card needed.", founder fact, product visual with "Example data" label) → How it works (3 steps) → Features (6) → Pricing teaser (Free / Pro coming soon / Business coming soon) → FAQ snippet → Closing CTA → Footer (Privacy, Terms).

Previews render the hero plus 2–3 sections. FAQ, closing CTA and footer copy are in each `design.md`.
