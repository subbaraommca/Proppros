# Video: "Build Your AI Marketing Team" (Ship AI)

**Source:** https://youtu.be/sAqxC8woInY. Recorded Oct 14, 2026, at Workuity, Phoenix. Runs 83 minutes. Presented by Santos Hernandez (Ship AI, desic), with Raj Shah (design).
**Deck and bot templates:** https://www.shipai.club/programs/zero-to-launch/growth-engineering/deck?track=grok-bot (there is also an engineering track).
These notes come from the auto-generated transcript, read 2026-10-17. Timestamps are mm.

## The demo (from about 20)

The example is **Desert Shine**, a fictional house-cleaning business in Phoenix. The presenter plays a social media agency that serves it. The goal is "more qualified cleaning inquiries".

The flow is **one repeatable campaign**:
1. **Marketing site.** Codex builds it. The owner reviews it, then approves the Vercel deploy.
2. **Static creative.** A 4:5 social post graphic, made from the marketing site.
3. **Short video creative.** Made with **Remotion**, which is free and code-based. This gives consistent, on-brand output.
4. **Client review bundle.** The creative, the captions and the destination, shown for approval.
5. **Distribution** through **Zernio**, "marketing infrastructure for agents". It posts to X, Instagram, TikTok, LinkedIn, Facebook, YouTube, Threads and Reddit, and does analytics, SMS and auto-DMs. It is a paid service and the only one the demo needs.

**Who does the work.** Codex with computer use drives a team of Grok Bots. The Social Media Manager coordinates the Performance Marketer and two Content Creators (Design and Video). The Performance Marketer researches the competitors' ads in the Meta Ad Library and writes the creative briefs. Every step stops for human approval before anything is published.

**Engineering-track stack** (prompts in the deck): Next.js, Workflow SDK, Zernio AI SDK, Remotion, Vercel.

## Marketing advice in the talk

- **Guerrilla marketing.** Join the communities where your users already are (Reddit, Facebook groups, Discord, X, LinkedIn). Answer frustrated posts about a competitor and say why you built your product. This is better than building your own funnel first.
- **Partner, affiliate and creator/UGC programs.** These come later, once you have users. UGC means user-generated content. AI UGC video ads worked well for the presenter: cost per action was 3–4× lower and revenue rose 40%. This is his anecdote, not a benchmark.
- **Community and email are a direct line to users.** Collect an email in exchange for free value (a lead magnet). Then send useful updates, each with one small call to action. B2B sales often need about 8–62 touch points.
- **Dual-sided referral program.** Both the person who refers and the new user get a reward, for example a free month or 50% off.
- **Paid ads.** Start with **one campaign on one channel**. Optimize on the signup or revenue event, not on clicks or installs.
- **Push notifications** are the strongest channel for re-engaging app users.
- **Backlink to your site from every social post.** This helps you rank first for your brand name, which builds trust when prospects search for you.
- **Post consistently.** The presenter cites about 26 posts a week as the driver of follower growth. Volume matters more than polish at first.
- **Launch is a starting point.** Get feedback early.
- **Lead webhook idea.** When a lead submits the form, a bot researches the lead and prepares a one-page brief before the call.
- **Models.** The presenter uses Sonnet 5.5 for component-level UI and motion, and Opus 5.5 for "fix this whole page" design work.

## What this means for Proppros

- The hackathon rewards a **working marketing site** first. A campaign draft (graphic, video and captions) supports the pitch and the Receipts.
- Remotion fits our stack. It is React, so a short promo video can come from the same brand tokens.
- Ideas the product could also ship: a **dual-sided referral** program (landlord refers landlord), and a **lead magnet** with an email follow-up through Resend, which we already use.
- Proppros users are small landlords. Communities to name in the marketing plan: r/Landlord, r/realestateinvesting, BiggerPockets forums, and local landlord Facebook groups.
