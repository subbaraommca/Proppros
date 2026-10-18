# Positioning brief — v1 — 2026-10-17

Status: draft. Not approved by the owner yet.
Based on: PROJECT-BRIEF v1. Author: Positioning & Product Research.
All web sources were accessed on 2026-10-17. Page dates are given when the page shows one.

Labels: **VERIFIED** = checked in a named source. **HYPOTHESIS** = our belief, not yet tested. **ESTIMATE** = our arithmetic or judgment from verified inputs.

---

## 1. Summary

- **Customer** (beachhead and why): Independent US landlords with 1–4 units who run their rentals themselves with spreadsheets, texts and memory. Why: this is the largest group of small landlords [S1, S2], and Proppros is free for up to 3 units. The 5–20 unit landlord is the next segment, once paid plans are active.
- **Problem:** Their records are split between Google Sheets, text threads and memory. This "breaks down when things get busy or units turn over" [S9]. Tenant balances, maintenance and renewals slip.
- **Offer:** One place for leases, the rent ledger, maintenance, vacancies, messages and reports, with a tenant portal in the browser. Free for up to 3 units. Pro at $2 per unit per month and Business at $3 per unit per month are "coming soon" (PROJECT-BRIEF v1, D3).
- **Current alternative / workaround:** Spreadsheets plus texts and email. Free tiers of TurboTenant and Avail. Flat-price RentRedi. Banking-first Baselane.
- **Difference** (HYPOTHESIS): Proppros is built around running the property, not around payments. Its free plan includes built-in e-signature and full maintenance tools (work orders, vendors, preventive schedules, appliance records). Competitor free plans center on listings, screening and online rent collection, which earn fees from tenants [S3, S4, S6].

## 2. Facts, hypotheses and estimates

### VERIFIED facts

| # | Fact | Source |
|---|------|--------|
| F1 | About 70% of US rental properties, holding 38% of rental units, are owned by individual investors (2021 Rental Housing Finance Survey). | HUD press release 22-242, 2022-11-29 [S1] |
| F2 | 70% of 1–4 unit rental properties (15.9 million) are owned by individual investors. | [S1] |
| F3 | In Avail's 2026 survey of 4,055 landlords, 72.6% oversee 1–4 units. | Avail, updated 2026-04-22 [S2] |
| F4 | In the same survey, only 16.2% use digital systems for maintenance and repairs. | [S2] |
| F5 | In the same survey, 74.4% saw ownership costs rise this year. | [S2] |
| F6 | When rent is missed, 78.3% first use text reminders or payment plans. | [S2] |
| F7 | Baselane reports 35% of landlords name cost as the biggest barrier to adopting property management technology. Survey year not stated. | Baselane, updated 2026-08-19 [S8] |
| F8 | Baselane reports 38% of landlords name property upkeep as their biggest challenge. Survey year not stated. | [S8] |
| F9 | Independently operated units had an 83.2% on-time rent payment rate in July 2026 (Chandan Economics, as cited by Baselane). | [S8] |
| F10 | Proppros plans: Free up to 3 units and 2 team members; Pro $2 per unit per month; Business $3 per unit per month. Paid billing is not active. | PROJECT-BRIEF v1, `backend/app/services/plans.py` |

Note: F7 and F8 come from a vendor page and have no stated year. Use them with care, or not on the site.

### HYPOTHESIS

- H1: Landlords with 1–4 units will choose a free tool that covers maintenance and records well, even without online rent payment.
- H2: "Built by a landlord with 3 rentals" builds trust with this audience.
- H3: Some landlords prefer software that does not charge their tenants fees.
- H4: The 3-unit free limit is a weak point against free plans with unlimited units (TurboTenant, Avail, Baselane).

### ESTIMATE

- E1: Proppros Pro for 5 units = $10 per month = $120 per year. For 10 units = $240 per year.
- E2: Avail Unlimited Plus for 5 units = $45 per month = $540 per year.
- E3: RentRedi annual plan = $12 per month x 12 = $144 per year, any number of units.

## 3. Alternatives compared

All prices in US dollars (the pages use "$" without naming a currency; all are US products). Geography: United States. Accessed 2026-10-17.

| Name | What it is | Price (currency, unit, period) | Free plan | Known for | Source |
|------|-----------|-------------------------------|-----------|-----------|--------|
| **Spreadsheets / DIY** (Google Sheets, Excel, texts, email, paper leases) | The current workaround | $0 in software. Cost is time and errors. | Yes | "Spreadsheets are free and flexible" but "cheap but fragile" [S12] | [S9, S10, S12] |
| **TurboTenant** | Self-management software for landlords | Free: $0. Essentials: $149 per year (1–10 units), $199 (11–30), $299 (31–60), $349 (61+). Pro: $199 per year (1–10 units), $399 (11–30), $699 (31–60), $999 (61+). Billed yearly. Tenant screening $45–$55, paid by the applicant. Card rent payments 3.49%. | Yes. Listings, screening, online rent collection. Leases and e-signing need Essentials. | Strong free plan; fees shifted to tenants | turbotenant.com/pricing, no page date (© 2026) [S3] |
| **Avail** (Realtor.com) | Landlord software | Unlimited: $0 per unit. Unlimited Plus: $9 per unit per month. Tenant ACH $2.50 per transfer on free plan, $0 on Plus. Card 3.5%. | Yes, unlimited units. Listings, screening, state-specific leases with e-signing, rent collection, maintenance requests. | Free plan covers the basics including leases | avail.com/pricing, no page date (© 2011–2026) [S4]. Note: avail.co could not be loaded; avail.com loaded. |
| **RentRedi** | Mobile-first landlord app | Flat price per account, unlimited units: $29.95 per month billed monthly; $20 per month billed every 6 months; $12 per month billed yearly. Screening $39.99 or $49.99. | No free plan, no free trial. 30-day money-back guarantee. | Flat price, unlimited units and teammates | rentredi.com/pricing, published 2026-10-16 [S5] |
| **Baselane** | Banking and bookkeeping platform for landlords | Core: $0 per month. Smart: $20 per month, billed annually. Unit basis not stated. Tenant ACH $2–$5 (waived for Baselane deposits). Card 3.49%. | Yes. Banking, income and expense tracking, Schedule E reports, rent collection. | Banking-first; bookkeeping and taxes | baselane.com/pricing, no page date (© 2026) [S6] |
| **Buildium** (upmarket reference) | Property management software for professional managers | Essential from $62 per month. Growth from $192 per month. Premium from $400 per month. Unit basis not stated. | No free plan seen on the page. | Full accounting for property managers | buildium.com/pricing, no page date (© 2026) [S7] |

**Innago:** the pricing page loaded but showed no plans or prices. It says "No monthly fee. No setup fee. No contract." We did not add a price for Innago.

## 4. Real landlord pains (sourced)

| # | Pain | Short quote | Source |
|---|------|-------------|--------|
| P1 | Records are split across tools and memory. | "a mix of Google Sheets, texts, and my memory" ... "breaks down when things get busy or units turn over" | BiggerPockets, "Landlords of 5–50 units", active from 2025-07-29 [S9] |
| P2 | Tracking who paid and who owes is the core need. | "Tracking the tenant payments and balances easily is actually the most crucial thing" | BiggerPockets forum thread 416843, 2017–2020 [S10] |
| P3 | Maintenance is the first thing to break. | "the piece that breaks first usually isn't rent or leases" (reply dated 2026-07-01). Avail: only 16.2% use digital maintenance systems [S2]. | [S9, S2] |
| P4 | Software feels too expensive and too complex for a few units. | "often feels excessive and expensive for a small number of units"; "For 2-5 units, it's genuinely overkill." | Reddit r/AusProperty thread, snapshot 2026-05-14 [S12]. **Caution: Australian forum, not US.** Baselane F7 (35% name cost as the top barrier) supports it for the US. |
| P5 | Accounting setup and year-end reports are painful. | "can't generate a Profit and Loss statement from their canned reports"; "The chart of accounts setup alone took me a weekend" (2026-06-08) | BiggerPockets thread 1010724, from 2022-01 [S11] |
| P6 | Long-term records are missing (when to replace big items). | "I had zero idea when I'd actually need to replace the roof" (2026-07-26) | [S9] |

We did not find a usable US thread from Reddit r/Landlord in the time available. Search returned no r/Landlord results.

## 5. Positioning recommendation

**Option A (recommended): "The free, all-in-one place for your first rentals."**
- Audience: US landlords with 1–4 units who use spreadsheets and texts.
- Message: Leases, the rent ledger, maintenance and tenant messages in one place. Free for up to 3 units. Built by a landlord.
- Pros: Matches the largest group (F2, F3) and the "Start free" call to action. Directly answers P1 and P2. Easy to understand.
- Cons: TurboTenant and Avail also offer free plans, with unlimited units and online rent collection. Proppros cannot claim online rent payment. Our free plan stops at 3 units (H4).
- Must validate: whether visitors accept "no online rent payment yet" in a free tool.

**Option B: "Run the property, not just the payments."**
- Audience: US landlords with 3–20 units who care about maintenance, vendors and records.
- Message: Work orders, vendors, preventive maintenance, appliance records, inspections and deposit letters, with the rent ledger and reports.
- Pros: A clearer difference from payments-first competitors. Backed by P3, P6 and F4. Fits a landlord who has outgrown spreadsheets.
- Cons: Narrower. Landlords with 4–20 units go past the free 3-unit limit, and paid plans are not active yet. That means they cannot buy today.
- Must validate: whether maintenance depth is a reason to switch, or only a nice extra.

**Recommendation:** Use Option A for the home page and hero. Use Option B as the main proof section and a features page. Reason: Option A fits the live free plan and the one call to action. Option B gives the difference that Option A lacks. The owner decides.

## 6. Pricing observations (all HYPOTHESIS)

- Proppros per-unit pricing is low for small portfolios. Pro for 5 units is about $120 per year (E1). Avail Plus is about $540 per year (E2). TurboTenant Pro is $199 per year for 1–10 units. RentRedi is $144 per year flat (E3).
- At 10 units, Proppros Pro ($240 per year, E1) costs more than TurboTenant Pro ($199) and RentRedi ($144). Per-unit pricing loses to flat pricing as units grow.
- Proppros free plan is smaller than three competitors. TurboTenant, Avail and Baselane offer $0 plans without a 3-unit cap stated on their pricing pages [S3, S4, S6].
- Competitors earn from tenant fees (ACH $2–$5, card 3.49%–3.5%, screening $39.99–$55) [S3, S4, S5, S6]. Proppros has no online payments, so it has no tenant payment fees today. Do not market this as a promise; it may change when payments go live.
- Option A pricing: keep Free (3 units) and per-unit Pro/Business as in the code. Simple, low entry price. Validate: do 4–10 unit landlords wait for "coming soon" plans, or leave?
- Option B pricing: consider a flat yearly price for 1–10 units to compete with TurboTenant and RentRedi. This is a proposal only and needs owner approval and validation. A proposed price does not prove willingness to pay.

## 7. Headline and message angles

Each angle maps to a sourced pain. Do not claim features that are not live.

1. **From spreadsheets and texts to one place** (P1). Example: "Your leases, rent and repairs in one place. Free for up to 3 units."
2. **Know who has paid and who is behind** (P2). Example: "See every tenant balance at a glance. Charges post every month on their own." (Rent ledger and automatic charges are live; online payment is not.)
3. **Repairs tracked from request to invoice** (P3, P6). Example: "Tenants report issues with photos. You track the work, the vendor and the invoice."

## 8. FAQ questions the site should answer

| # | Question | Why (source) |
|---|----------|--------------|
| 1 | Is it really free? What is included in the free plan? | Cost is a top barrier [S8]; competitors lead with $0 plans [S3, S4, S6]. |
| 2 | Is this overkill for 2 or 3 units? | "For 2-5 units, it's genuinely overkill." [S12] |
| 3 | Can I track tenant balances and partial payments? | "Tracking the tenant payments and balances easily is actually the most crucial thing" [S10] |
| 4 | Can tenants pay rent online? (Answer honestly: not yet.) | Every listed competitor offers online rent collection [S3–S6]. |
| 5 | Do my tenants pay any fees? | Competitors charge tenants ACH, card and screening fees [S3–S6]. |
| 6 | Can I get a profit and loss report for taxes? | "can't generate a Profit and Loss statement" [S11] |
| 7 | Can I sign leases online? | Avail includes e-signing for free; TurboTenant needs a paid plan [S3, S4]. |
| 8 | Does my tenant need to install an app? | Proppros tenant portal runs in the browser (PROJECT-BRIEF v1). RentRedi is app-first [S5]. |

## 9. First validation experiment

**Test:** Hero message test with real landlords, before or right after launch, with no ad spend.
- Show 5–10 landlords with 1–10 units two hero versions: Option A ("one place, free for 3 units") and Option B ("run the property, not just the payments").
- Recruit from the founder's own network or local landlord groups. Posting in forums needs owner approval.
- Ask: "Which one would make you click Start free? Why?" and "What would stop you?"
- Success signal: at least 6 of 10 pick one version and name the same reason.
- Also record how many raise "no online rent payment" as a blocker. If more than half do, Option A needs a clear answer in the FAQ.
- Time: 2–3 days. Cost: $0.

## 10. Gaps and confidence

- Confidence in audience size: high (government source F1, F2).
- Confidence in pains: medium. Forum quotes are real but few, and some are old (2017–2022) or non-US (P4).
- No r/Landlord thread found. No US survey found that measures spreadsheet use directly.
- Avail Unlimited Plus billing: the page says "$9 per unit, per month". Annual options were not shown.
- Innago prices: not shown on its pricing page.
- Baselane and Buildium: the unit basis of the price is not stated.
- Buildium prices are "starting at" floors.

## 11. Sources (all accessed 2026-10-17)

- [S1] HUD, "HUD, Census Release 2021 Rental Housing Finance Survey Findings", HUD No. 22-242, 2022-11-29. https://archives.hud.gov/news/2022/pr22-242.cfm
- [S2] Avail, "2026 Independent Landlord Survey", updated 2026-04-22. https://avail.com/education/articles/2026-independent-landlord-survey
- [S3] TurboTenant pricing, no page date (© 2026). https://www.turbotenant.com/pricing/
- [S4] Avail pricing, no page date (© 2011–2026). https://www.avail.com/pricing
- [S5] RentRedi pricing, published 2026-10-16. https://rentredi.com/pricing/
- [S6] Baselane pricing, no page date (© 2026). https://www.baselane.com/pricing
- [S7] Buildium pricing, no page date (© 2026). https://www.buildium.com/pricing/
- [S8] Baselane, "Self-managing landlord statistics", updated 2026-08-19 (vendor page). https://www.baselane.com/resources/self-managing-landlord-statistics
- [S9] BiggerPockets, "Landlords of 5–50 units - how do you actually keep track of everything?", replies 2025-07-29 to 2026-07-26. https://www.biggerpockets.com/posts/7249803
- [S10] BiggerPockets, "Property management software for small individual landlord", replies 2017-02-28 to 2020-05-07. https://biggerpockets.com/forums/52/topics/416843-property-management-software-for-small-individual-landlord
- [S11] BiggerPockets, "For self managing landlords, what accounting software do you use?", from about 2022-01, replies to 2026-07-09. https://www.biggerpockets.com/forums/52/topics/1010724-for-self-managing-landlords-what-accounting-software-do-you-use?page=1
- [S12] Reddit r/AusProperty, "Honestly, spreadsheets are starting to feel like a ticking time bomb for my small portfolio", snapshot 2026-05-14 (Australian forum). https://reddit.com/r/AusProperty/comments/1tcmez2/ — read via snapshot https://reddit.sentinel-team.org/posts/1tcmez2/snapshots/2026-05-14T04%3A24%3A01.13373Z
- Innago pricing (no prices shown), no page date. https://innago.com/pricing/

---
v1, 2026-10-17, based on PROJECT-BRIEF v1.
