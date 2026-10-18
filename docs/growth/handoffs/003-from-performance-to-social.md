# Handoff 003 — from Performance Marketer to Social Media Manager — 2026-10-18

- **Brief version read:** PROJECT-BRIEF v2 (2026-10-18)
- **Artifacts + version:** `docs/growth/ADS-RESEARCH.md` v1 (2026-10-18)
- **Done (with evidence paths):**
  - References table of competitor ad angles and offers, with dates and links: `ADS-RESEARCH.md` §2. Mostly landing pages plus one announced TurboTenant TV and social campaign (2026-03-03). No in-feed ads were observed (see access limits, §1).
  - Patterns: free leads every offer, "like a pro" is taken, competitors center on payments and listing syndication, all use user counts we do not have (§3).
  - Specs table from Meta Ads Guide and Google Ads Help: 4:5 feed at 1440 x 1800; Reels 9:16 at 1440 x 2560 with 14% top, 35% bottom and 6% side safe zones (§4).
  - Housing rules: Meta's own pages do not say whether landlord software is a housing ad. We plan targeting that already fits the Housing category rules (§5).
  - One campaign on Meta (Facebook + Instagram, Feed + Reels), optimized for "account created" (arrival at `/welcome`). Test: Video B vs. Static A on cost per completed sign-up; expected: Video B lower (§6).
  - Creative brief A (static 4:5, "fill your vacancy") for Content Creator - Design (§8).
  - Creative brief B (video 9:16, two concepts; "One calm month" recommended, 22 s) for Content Creator - Video (§9).
- **Needed from you:**
  1. Pass brief A to Content Creator - Design and brief B (Concept 1) to Content Creator - Video.
  2. Ask the Product Manager for showcase-database screens. `frontend/public/screens/` is empty today. Briefs name the screens to capture: vacancies, rent ledger, signed lease, dashboard balance, work order, profit and loss, flyer and share image.
  3. Raise one owner decision through the Product Manager (below). Nothing is launched or spent.
- **Open questions / unverified:**
  - **Owner decision (tracking):** brief D7 says "no analytics this round". A campaign optimized for sign-ups needs a Meta Pixel or Conversions API event for "account created". Recommendation: allow that one event before any paid test. Decision needed: yes or no.
  - **Owner decision (budget, HYPOTHESIS):** $20 per day for 14 days ($280 total). No spend without explicit approval.
  - Q-A: Does Meta treat landlord-software ads as housing ads? Not stated in Meta pages we could read. Owner may confirm with Meta support or counsel. Our targeting works either way.
  - Q-B: Does Google sign-in also land on `/welcome`? The Frontend Engineer should confirm, so the conversion event counts both paths.
  - Not accessed: Meta Ad Library and Google Ads Transparency Center (JavaScript pages failed), the TurboTenant press release (HTTP 403), and Meta Business Help article 298000447747885. A logged-in human check of the Ad Library is a $0, 5-minute next step.
- **Reply:** write `handoffs/004-from-social-to-performance.md` with "acknowledged" and the next step.
