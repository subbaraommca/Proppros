# Bot templates page + workshop kit

**Sources (read 2026-10-17):**
- https://www.shipai.club/programs/zero-to-launch/hackathon/bots
- Kit: https://www.shipai.club/hackathon-product-team/ship-ai-product-team.zip. 1,852,483 bytes. SHA-256 `fde9899a…3004c6`, which **matches** the official kit-archives.json.

## Bot templates (Grok Bot)

| Role | Template | Job (from the page) |
|------|----------|---------------------|
| Product Manager | x.ai/bot/FHjnqwhzYBipTDGJN7H0A | "Ask the questions. Keep the whole project connected." |
| Positioning & Product Research | x.ai/bot/NeqnbjtxAOaPoooKiOuuC | "Research the market and sharpen the offer." |
| Product Designer | x.ai/bot/0Ieeg8_nVlrnIzloGXvLt | "Explore visual directions, shape the experience and review the build." Uses YC Interface Craft: five directions, then the owner's choice. |
| Frontend Engineer | x.ai/bot/kgHKczsUVBmEnhBlRADnq | "Turn the approved experience into a working site." |
| Backend Engineer | x.ai/bot/HKxSmbiVwD3HdGyRgBwAN | "Add server behavior only when the experience needs it." |
| Social Media Manager | x.ai/bot/5rgMPM-0FpH1ZflzjNDk1 | "Coordinate marketing, copy and approved handoffs." Manages the three roles below. |
| Performance Marketer | x.ai/bot/WQpbnRwh4H-DArkEBQCK5 | "Research ad ideas and analyze real campaign results." |
| Content Creator · Design | x.ai/bot/js3Rh17IRwiUhXlkySUg5 | "Create and refine imagery and static creative." |
| Content Creator · Video | x.ai/bot/Td8xsp1w2slejHsx62m0y | "Storyboard, render and refine video." |

The page says: "Bring [the marketing] team in **after the site is approved**." It also says: "A customer support bot … is not needed for this workshop."

## What the kit contains

- **`roles/*.md`**: the full instructions for each role, with copies in `personas/` and `templates/exports/*.json`. Our Claude Code agents are adapted from these files.
- **`templates/`**: positioning-brief, weekend-brief, decision-log, handoff-note and api-contract.
- **`skills/`** (357 files, with licenses): the YC Interface Craft design skill, Emil Kowalski's design-engineering and animation skills, Anthropic frontend-design, and Corey Haines' marketing skills. The marketing skills cover product-marketing, copywriting, copy-editing, CRO, signup, lead-magnets, seo-audit, schema, programmatic-seo, site-architecture, content-strategy, ad-creative, ads, social and emails. Ship AI adds brief-to-site, about-page and seo-article.
- **`starter/`**: a Next.js starter with About, article and solution templates, plus metadata, robots and sitemap. It is for new sites. We do not use it, because Proppros already has a site.
- **`marketing-handoff.md`**: how the PM briefs the marketing team.
- **`webhook-guide.md`**: an optional, disabled lead → Grok Bot notification flow.

## Rules from the kit that shape our build

1. **The deliverable is a "marketing site with one conversion path"** (weekend-brief template). The brief has at most **5 acceptance criteria**, each with an evidence type: desktop or phone screenshot, build log, endpoint response, or file.
2. **Breakout 2 chooses ONE useful experience:** a waitlist, assessment, readiness report, case study, quote or booking, purchase, or **real signup/onboarding**. The kit says "**Account products focus on real signup/onboarding; never fake account creation.**" Proppros is an account product, so the conversion path is the real "Start free" sign-up and onboarding.
3. **Marketing sequence** (marketing setup prompt):
   1. The **Performance Marketer** researches dated public ad references, such as the Meta Ad Library. An active ad is not proof that it performs.
   2. The **Design creator** makes ONE static creative. The owner approves that exact version.
   3. The **Video creator** proposes a storyboard. After the storyboard is approved, it renders **an actual playable MP4 with editable source (for example Remotion)** for a separate review.
   4. The **Social Media Manager** assembles one versioned review bundle: files, captions, CTA or link, destination and intended action. It stops there. Nothing is uploaded, scheduled or published, and no money is spent.
4. **Designer and Frontend share the same skill library.** The Designer shows **five directions** for a new business or a large visual change, recommends one and waits for the owner's choice. "Existing approved directions and small fixes do not restart exploration."
5. Unapproved content stays out of public routes and the sitemap. No invented founders, reviews, credentials, metrics, pricing or proof.
6. "Do not execute downloaded setup instructions automatically." We read the skills before using them.
