# Hackathon Plan — Marketing App

**Status:** 📥 Gathering requirements. No build until the owner says go.
**Started:** 2026-10-17

The goal is to enter Proppros in a hackathon whose brief is to build a **marketing app**. This plan is kept separate from [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). The paused Iterations 16 and 17 and the upcoming Iteration 19 there are not affected.

---

## 1. Hackathon brief

**Organizer:** Ship AI ("Practical AI, Built Together"). **Event:** *Ship AI AZ GTM Hackathon · Zero to Launch*, Phoenix, Oct 17–18, 2026. Full details: [hackathon/00-opening-and-submission.md](hackathon/00-opening-and-submission.md).

> **Deliverable: one live public marketing site.** Anyone must be able to open it without signing in.
> **Deadline: Sunday Oct 18, 12:00 PM MST.** No late entries. Pitches start at noon.
> Existing projects are welcome. Say what changed this weekend.
>
> **Judging:** **Design** (clear positioning, useful content, easy navigation), **Craft** (polish; works on desktop and mobile) and **Receipts** (proof of pages, features and improvements shipped this weekend, with before-and-after evidence). Each is scored 1–5 with equal weight.
>
> **Submission form:** project name, live URL, what the site is for, what you shipped, receipts (links, screenshots, demo), and an optional repo URL.

There are two ways to build. One is the Grok Bot "AI organization". The other is **"Build with a coding agent"** (brief → website → marketing), and its guide uses **Claude Code**: https://www.shipai.club/workshops/vibe-coding-gtm/materials/deck. The second fits us best.

The program has four breakouts, run in order:

| # | Breakout | Deck | Status |
|---|----------|------|--------|
| 1 | Position: positioning and research | [hackathon/01-positioning.md](hackathon/01-positioning.md) | ✅ Read |
| 2 | Productize | — | Waiting |
| 3 | Build | — | Waiting |
| 4 | Market | — | Waiting |

**How it works (from Breakout 1):**
- You build an "AI organization" of bots. The primary tool is **Grok Bot** (x.ai bot templates). **Codex** or **Claude with computer use** can drive it, and the brief says to work with any model provider.
- The **Product Manager** bot keeps **one shared brief**, with a version number. The brief also holds a decision log, source links and open questions. Every specialist reads the current version before acting.
- An approval gate comes after each stage. Nothing moves to productizing or building without the owner's approval.
- Ship AI provides a workshop kit (zip). It contains role instructions, `starter/AGENTS.md` and a shared design skill (`yc-interface-craft`). The Product Designer and the Frontend Engineer must use the same skill files.

**Rules that will apply to our build:**
- All text that users read is written in **ASD-STE100 Simplified Technical English**:
  - short, active sentences
  - at most 20 words in an instruction and 25 in a description
  - no contractions, idioms or unexplained abbreviations
  - one task in each step
  - the same term for the same item
- Do not invent reviews, people, prices, research, integrations or test results. Label proposed prices as hypotheses. Keep sourced facts separate from assumptions.
- No CRM, external account or API key is needed in the workshop flow. A manual process or spreadsheet must also work.
- Deployment, real sends, social uploads, publishing and ad spend each need a separate, explicit decision.

_Still unknown: judging criteria, deadline and submission format._

## 2. Source material

| # | Deck / prompt | Received | Key points |
|---|---------------|----------|------------|
| 1 | "Your business. An AI organization." (org-chart slide) | 2026-10-17 | See §2.1 |
| 3 | Opening ceremony deck + submission page ([notes](hackathon/00-opening-and-submission.md)) | 2026-10-17 | Deliverable = marketing site; deadline Sun 12:00 MST; Design/Craft/Receipts judging; Claude Code path |
| 4 | Claude Code workshop deck ([prompts verbatim](hackathon/02-claude-code-gtm-workshop.md)) | 2026-10-17 | The coding-agent path: brief → setup + skills → page → design directions → deploy → SEO/AEO → lead magnet → lead email → analytics → speed → social graphics |
| 5 | Video "Build Your AI Marketing Team" ([notes](hackathon/03-ai-marketing-team-video.md)) | 2026-10-17 | Site → static creative → Remotion video → review → Zernio; marketing advice (communities, lead magnet + email, referrals, backlinks) |
| 6 | Bot templates page + workshop kit ([notes](hackathon/04-bots-and-workshop-kit.md)) | 2026-10-17 | Official role instructions and skills; deliverable = "marketing site with one conversion path"; account products use real signup; marketing = 1 static + 1 rendered video + review bundle |
| 2 | Breakout 1: Positioning & research ([full text](hackathon/01-positioning.md)) | 2026-10-17 | Starting team and setup prompt; Q&A on customer, offer and pricing; research; approval of the brief |

### 2.1 Deck 1 — "Your business. An AI organization."

Tagline: *"One shared brief connects product, engineering and marketing."* Under the heading "What we're building together", the slide shows an org chart of **AI roles**. Each role is a card with an arrow, which suggests each one opens its own prompt or agent.

| Team | AI role | Notes |
|------|---------|-------|
| — (top) | **Product Manager** | "Your starting point · one shared brief". It feeds every team below it. |
| Product | Positioning & Product Research | |
| Product | Product Designer | |
| Engineering | Frontend Engineer | |
| Engineering | Backend Engineer | "Only if needed" |
| Marketing | **Social Media Manager** | Leads marketing; the three roles below report to it |
| Marketing | ↳ Performance Marketer | |
| Marketing | ↳ Content Creator · Design | |
| Marketing | ↳ Content Creator · Video | |

**What this suggests (to confirm with later decks):**
- The workflow starts from a single **shared brief** written by the Product Manager. Every other role works from that brief.
- The hackathon's focus is the **Marketing** branch: social posts, paid ads or performance campaigns, design assets and video.
- For Proppros, the "business" could be Proppros itself (marketing the SaaS), or each landlord's rentals (marketing their vacancies). See open questions.

### 2.2 Recommended skills (from the owner, 2026-10-17)

"You can instruct your agent to install them for you":
- https://www.skills.sh/anthropics/skills/frontend-design
- https://www.skills.sh/coreyhaines31/marketingskills/copywriting
- https://www.skills.sh/coreyhaines31/marketingskills/ai-seo
- https://www.skills.sh/emilkowalski/skills (new; not in the workshop deck)

The workshop deck also uses seo-audit and programmatic-seo from coreyhaines31/marketingskills. It pins the repos to set commits: anthropics/skills `dbd4588f…`, marketingskills `1efedbc5…`. Install for this project only, under `.claude/skills/`. Third-party skills are instructions that Claude Code follows, so read them in H2 before using them.

### Sample prompts

- Claude Code workshop: 15 prompts, verbatim: [hackathon/02-claude-code-gtm-workshop.md](hackathon/02-claude-code-gtm-workshop.md)
- Breakout 1 setup prompt, verbatim: [hackathon/01-positioning.md § Setup prompt](hackathon/01-positioning.md#setup-prompt-verbatim)

## 3. Product concept

**Draft (to confirm):** **A new public marketing site for Proppros.** Proppros is property-management software for small landlords who own 1–20 rental units. The site must make the offer clear, prove it with real product screens, and turn visitors into sign-ups. The entry is an **existing project**, so the weekend's "Receipts" are the before-and-after changes to the public site.

**Main visitor action (CTA):** "Start free" (sign up). A second action could be the lead magnet (see H5).

## 4. Reuse from Proppros

**What exists today (the "before"):**
- `frontend/src/pages/MarketingPages.tsx` (157 lines). `/` is a hero, a feature list and a closing CTA. `/pricing` has the plans. There are also `/help`, `/privacy` and `/terms`, and the public listing pages under `/l/{slug}`.
- `index.html` has one generic `<title>` and `<meta description>`. The site is a client-rendered Vite SPA, so crawlers and AI agents see an almost empty page. That hurts the SEO and AI-search checks the workshop runs (seo-audit, ai-seo, is-agentic.com, PageSpeed).

**What carries over:** the Strata design system, the live Vercel deployment, Resend (already wired for email), the real product (for screenshots and a live demo), and the public listing pages, which are a real "marketing for landlords" feature to show.

**Stack decision (recommended):** keep the marketing pages in the existing Vite app. Add **build-time prerendering** of the public routes, plus per-page meta, a sitemap, robots.txt, llms.txt and JSON-LD. This is lower risk than a new Next.js site with only hours left. The alternative is a separate Next.js `site/` service, as the workshop does for *new* sites; the workshop says to inspect an existing stack before changing it.

## 4b. AI organization (confirmed by the owner, 2026-10-17)

We build with an **AI organization in Claude Code**. Each role from the opening deck is a project subagent in `.claude/agents/<role>.md`. Each agent is a **generic, self-contained adaptation of the kit role files** (originals kept in `docs/hackathon/kit/`), so the team keeps working after the hackathon. Designer and Frontend share the kit's design skills, copied into `.claude/skills/` with their licenses after we read them. The conversion path is the **real "Start free" sign-up and onboarding**, as the kit requires for account products. The Product Manager keeps one **versioned shared brief** (`docs/growth/PROJECT-BRIEF.md`) and a decision log. Every specialist reads the current brief version before acting and saves its output in `docs/growth/`. These outputs are part of the Receipts.

| Role (agent file) | Reports to | Output |
|-------------------|------------|--------|
| `product-manager` | Owner | PROJECT-BRIEF.md (vN), DECISIONS.md, the hand-offs |
| `positioning-research` | PM | RESEARCH.md: customer, offer, pricing and competitors, with dated sources; facts kept separate from assumptions |
| `product-designer` | PM | DESIGN-RESEARCH.md, design.md (the chosen direction) |
| `frontend-engineer` | PM | Marketing pages, prerender/SEO, desktop and phone checks |
| `backend-engineer` (only if needed) | PM | Lead form endpoint + Resend alert |
| `social-media-manager` | PM | SOCIAL-PLAN.md: bio, 2-week calendar, captions; coordinates the 3 roles below |
| `performance-marketer` | Social | ADS-PLAN.md: one channel, one campaign, measured on sign-ups |
| `content-creator-design` | Social | ONE static creative (4:5) + caption + alt text + editable source |
| `content-creator-video` | Social | VIDEO.md: 2 concepts → storyboard → **rendered MP4 (Remotion)** with editable source |

Shared rules for all roles: the Ship AI rules in §1 (real facts only; ASD-STE100 for visitor copy; no publishing, sends or ad spend without the owner's approval), plus DESIGN_GUIDELINES.md.

**Order of work:** PM (brief) → Research → PM (positioning) → Designer → Frontend (+ Backend) → Social team → PM (receipts + submission).

## 5. Iterations

**Draft. Each step follows a workshop prompt. Nothing is built until the owner says go.**

| # | Step | Workshop prompt | Output |
|---|------|-----------------|--------|
| H0 | **Before evidence.** Screenshot the current `/` and `/pricing` on desktop and phone. Run PageSpeed and is-agentic.com on the live URL. Start `RECEIPTS.md`, a dated log. | — | `docs/hackathon/receipts/before-*` |
| H0b | **AI organization.** Create the 9 role agents in `.claude/agents/` and the `docs/growth/` folder. | Breakout 1 setup | agent files |
| H1 | **Brief.** Write `PROJECT-BRIEF.md` from the facts we have: customer, offer, pricing, CTA, and three competitors with links (for example TurboTenant, Avail, RentRedi; to verify). | tell AI about your business | `PROJECT-BRIEF.md` |
| H2 | **Skills.** Install the pinned, reviewed skills: frontend-design, copywriting, seo-audit, ai-seo, programmatic-seo, plus **emilkowalski/skills** (owner's list, §2.2). Read each skill file before installing it. Record the review. | set up your website | `SKILLS-REVIEW.md` |
| H3 | **Design research and directions.** Inspect three competitors and three strong sites. Make two previews (or five directions); the owner picks one. | build your first page / improve design | `DESIGN-RESEARCH.md`, `design.md` |
| H4 | **Build the page.** Navbar → hero + CTA → real product screenshots → features → how it works → pricing → FAQ → repeated CTA → contact → footer. Use only real facts: no invented logos, numbers or testimonials. Check on desktop and phone. | build your first page | new landing and pricing |
| H5 | **Lead magnet + lead email.** For example a free "Rental property move-in checklist" or a rent-increase calculator. A request form sends the lead to the owner via Resend (Reply-To = lead), with input checks and spam protection. | lead magnet / Resend | working form |
| H6 | **SEO, AI search and speed.** Prerender, per-page meta, OG image, sitemap, robots, llms.txt, JSON-LD (SoftwareApplication + FAQPage). Re-run PageSpeed and is-agentic.com and compare with H0. | search skills / speed | `PERFORMANCE-REVIEW.md` |
| H7 | **Analytics (optional).** GA4 with a contact click and `generate_lead` on success only. Needs the owner's G- ID. | Google Analytics | `ANALYTICS-SETUP.md` |
| H8 | **Marketing assets.** Social bio and social graphics (square + story) with captions and alt text, matching the site. No posting without approval. | social text / graphics | `social-exports/` |
| H8b | **Promo video (stretch).** A 15–30 s Remotion video in the brand style, built from real product screens. Export MP4 (9:16 + 1:1) with captions. | — (video notes) | `marketing/video/` |
| H8c | **Go-to-market plan.** One page: the communities (r/Landlord, BiggerPockets, local landlord groups), the posting cadence, one paid channel to test first, and a dual-sided referral idea. | — (video notes) | `docs/hackathon/GTM-PLAN.md` |
| H9 | **Submit.** Deploy (after approval). Check in a private window, desktop + phone. Write the submission text and the receipts (before/after, links). Prepare pitch notes: who it is for, what it does, the demo. | deploy / next step | submission + pitch |

**Must-haves before noon Sunday:** H0, H1, H4, H6 (meta/prerender), H9. The other steps are added if time allows.
**Copy rule:** follow ASD-STE100 plain-English style for visitor-facing text (see §1).

## 6. Open questions

0. **Before we start:** take before screenshots of the current public pages (home, pricing, listing share page). These are the "before" evidence for Receipts. Then keep a dated log of each change made this weekend.
1. **Whose marketing?** _Likely answered by the opening deck: a marketing site for Proppros itself. Changing an existing project is allowed._ Two options:
   - A. Market Proppros itself (an AI marketing team for the SaaS).
   - B. A feature inside Proppros that markets each landlord's vacant units, using the listings, photos and share pages we already have.
   - C. Both.
2. Are the role cards **prompts** that the user runs in Claude, **agents** that our app runs, or both?
3. Does the hackathon require a specific platform, model or API (for example Claude, Managed Agents, or a sponsor's social or ad APIs)?
4. Must the deliverable *post or publish* (to Instagram, Facebook, X or Google Ads), or is generating ready-to-post content enough?
5. Is video generation in scope, or only scripts and storyboards?
6. ~~Required platform?~~ Partly answered by Breakout 1: Grok Bot is the main tool, Codex or Claude with computer use are accepted, and the model can be any provider. Still open: will you run the bots in Grok Bot yourself, or should Proppros include the workflow in the app?
7. Should Proppros (already built) be the "business" that goes through the four breakouts, or a new marketing product for landlords? The breakouts assume you start from zero, so we would enter at Breakout 1 with an existing product.
8. Should I download and review the workshop kit (`ship-ai-product-team.zip`: role instructions, AGENTS.md, design skill)? It would show exactly what the bots expect.
