# Social plan — v1 — 2026-10-18

**Status:** DRAFT for owner review. **Nothing is posted.** No account is created, connected or changed.
**Based on:** PROJECT-BRIEF **v2** (2026-10-18), ADS-RESEARCH v1, Static A (`marketing/social/static-a/caption.md`), VIDEO.md (Concept 1, "One calm month").
**Author:** Social Media Manager. Skills loaded: social (SKILL.md), copywriting (SKILL.md).

**Gate before any post:** the vacancy marketing kit must be live in production. It is built, and it goes live with the next deploy. After that deploy, check one real listing in production (ad text, share image, flyer with QR code). Until then, posts 2 and 3 below must not mention the share image or the flyer.

Rules for all copy below:
- Every claim comes from brief §3 or the vacancy kit in brief §2b. Each post names its source.
- Audience words: "independent landlords" or "small landlords". No unit counts.
- Never claim online rent payment, SMS texts, an app in the app stores, AI, bank sync or email notifications.
- No contractions in post copy. Short, plain sentences.
- Screens come only from the fictional showcase data in `frontend/public/screens/`. Each image keeps its "Example data" label, or the caption says "example data".
- Vacancy posts describe the home, never the people who should live there (fair housing).

---

## 1. Profile bios

The offer is the same as the site: **"Start free. No card needed."** Every bio links to https://proppros.vercel.app.
Character counts are approximate and include spaces.

### Facebook Page

- **Page name:** Proppros
- **Category (proposed):** Software
- **Intro (101 characters max):**
  > Leases, rent and repairs in one place for independent landlords. Start free. No card needed. (92)
- **Website:** https://proppros.vercel.app
- **About (longer field):**
  > Proppros is web software for independent landlords. Track rent, sign leases online, handle repairs and fill vacancies with a listing page, ad text, a share image and a flyer. Your tenants get their own portal in the browser. Built by a landlord who runs three rental homes with it. Start free at https://proppros.vercel.app

### Instagram

- **Name field:** Proppros | Landlord software
- **Bio (150 characters max):**
  > Leases, rent and repairs in one place.
  > Fill vacancies with a listing page and flyer.
  > Built by a landlord. Start free, no card needed. (133)
- **Link:** https://proppros.vercel.app

### X

- **Name:** Proppros
- **Bio (160 characters max):**
  > Property management for independent landlords. Track rent, sign leases online, handle repairs and fill vacancies. Built by a landlord. Start free. (146)
- **Website:** https://proppros.vercel.app

### LinkedIn Company Page

- **Tagline (120 characters max):**
  > Leases, rent, repairs and vacancies in one place for independent landlords. (75)
- **About:**
  > Proppros is property management software for independent landlords. It keeps leases, rent tracking, maintenance, vacancies, tenant messages and reports in one place.
  >
  > Monthly rent charges post on their own. Tenants sign leases online. Repairs move from a tenant request to a work order and a vendor. Each vacancy gets a listing page, ready-to-post ad text, a share image, a flyer with a QR code and online applications. Tenants use their own portal in the browser, with nothing to install.
  >
  > Proppros was built by a landlord who runs three rental homes with it. Start free, with no card needed: https://proppros.vercel.app
- **Website:** https://proppros.vercel.app
- **Industry (proposed):** Software Development

**Bio claim check:** leases, e-signature, rent tracking, repairs, tenant portal (brief §3); listing page, ad text, share image, flyer (vacancy kit, brief §2b, live after the next deploy); "Built by a landlord" and three rental homes (brief §1); "Start free. No card needed." (site hero copy, D2). No unit counts.

---

## 2. Two-week organic calendar (proposed dates, after the deploy and owner approval)

Three posts a week on Facebook, Instagram, X and LinkedIn. Same core message, adapted to each format.
Organic links use UTM tags so the owner can tell posts apart later (for example `?utm_source=instagram&utm_medium=organic_social&utm_campaign=organic_oct26&utm_content=post1`). D7 says no analytics this round, so these tags only help if analytics is added later.

| # | Date (proposed) | Topic and live feature | Format | Asset |
|---|-----------------|------------------------|--------|-------|
| 1 | Tue 2026-10-20 | Founder story: why Proppros exists | Image post (FB, LinkedIn, X); IG single image | Use: `frontend/public/screens/dashboard-dark.webp` (example data) |
| 2 | Thu 2026-10-22 | Fill your vacancy (vacancy kit) | Carousel, 3 slides (IG, FB, LinkedIn document or multi-image); X image post | Use: `marketing/social/static-a/static-a-1080x1350.png`, `frontend/public/screens/kit-share-image.webp`, `frontend/public/screens/kit-flyer.webp` |
| 3 | Sat 2026-10-24 | One calm month (whole product) | Vertical video (IG Reels, FB Reels); native video on X and LinkedIn | Use: `marketing/video/renders/one-calm-month-1080x1920.mp4` |
| 4 | Tue 2026-10-27 | Leases with built-in e-signature | Carousel, 3 slides | Create: 3 slides at 1080 x 1350 from `lease-dark.webp` (Content Creator - Design) |
| 5 | Thu 2026-10-29 | A repair, from request to vendor | Carousel, 3 slides | Create: 3 slides at 1080 x 1350 from `maintenance-dark.webp` and `workorder-dark.webp` |
| 6 | Sat 2026-10-31 | Month-end books (reports and CSV export) | Image post | Use: `frontend/public/screens/reports-dark.webp` (crop to 1080 x 1350; keep the "Example data" label) |

### Post 1 — Founder story (Tue 2026-10-20)

- **Feature and source:** dashboard, balances due, founder story (brief §1, §3).
- **Caption (FB, LinkedIn, IG):**
  > I own three rental homes. For years I kept them in spreadsheets, texts and paper leases.
  >
  > Rent was in one file. Repairs were in my texts. Leases were in a folder in my car.
  >
  > So I built Proppros. Now leases, rent, repairs and tenant messages sit in one place. The dashboard shows me who is behind before I have to ask.
  >
  > It is free to start, and you do not need a card.
  > https://proppros.vercel.app
  >
  > (The screen shows example data.)
- **X version (under 280 characters):**
  > I own three rental homes. I ran them on spreadsheets, texts and paper leases. So I built Proppros: leases, rent, repairs and tenant messages in one place. Free to start. https://proppros.vercel.app
- **Note:** the brief says the founder story is shown without a personal name. Post from the brand account, or from the founder's account only if the owner approves that.
- **Owner check:** the "spreadsheets, texts and paper leases" line and the "folder in my car" line need the owner's confirmation. They are a draft of the founder's voice. Remove any line that is not true.

### Post 2 — Fill your vacancy (Thu 2026-10-22)

- **Feature and source:** listing page with share link, ready-to-post ad text, share image, flyer with QR code, online applications (brief §2b, §3).
- **Gate:** post only after the vacancy kit is verified in production.
- **Caption:**
  > Got a unit coming open?
  >
  > Create one listing in Proppros. You get a public listing page with a share link and ad text that is ready to post. You also get a share image for social media and a flyer with a QR code that opens the listing.
  >
  > Applicants apply online.
  >
  > The ad text describes the home, not the people. That helps you keep your ads fair.
  >
  > Start free: https://proppros.vercel.app/features/vacancies
  >
  > (Slides show example data.)
- **Slides:** 1 = Static A (1080 x 1350). 2 = the share image. 3 = the flyer with QR code.
- **Before posting:** open `kit-share-image.webp` and `kit-flyer.webp`. Confirm they show only showcase data and that the QR code does not open a real listing. If the QR opens a showcase listing on production, confirm that page is fictional.
- **Wording note:** "helps you keep your ads fair" is a soft claim. It matches the site ("It describes the home, not the people"). Do not say "fair-housing compliant".

### Post 3 — One calm month (Sat 2026-10-24)

- **Feature and source:** automatic rent charges, e-signature, balances due, work orders and vendors, listing and applications, profit and loss with CSV export (brief §3).
- **Caption:**
  > One calm month of landlording, in one place.
  >
  > On the 1st, rent charges post on their own. On the 3rd, a lease is signed online. On the 6th, you see who is behind. On the 12th, a leak is reported and a vendor is assigned. On the 20th, a vacancy is shared and applications come in. On the 31st, your books are ready for your accountant.
  >
  > Built by a landlord. Start free: https://proppros.vercel.app
- **Alt text:** reuse the alt text in `docs/growth/VIDEO.md`.
- **Note:** the video has no sound. Add no trending audio unless it is licensed and the owner approves.

### Post 4 — Leases with built-in e-signature (Tue 2026-10-27)

- **Feature and source:** lease templates, built-in e-signature, renewals (brief §3).
- **Caption:**
  > Still printing leases and driving them over for a signature?
  >
  > In Proppros, you start from a lease template. Proppros fills in the names, the address, the rent and the dates. Your tenant signs online with a secure link. The signed copy is saved to the lease.
  >
  > When the lease nears its end, you can send a renewal offer. The tenant accepts it online.
  >
  > Start free: https://proppros.vercel.app/features/leases-and-e-signature
- **Asset to create:** 3 slides at 1080 x 1350. Slide 1: hook text "Sign leases online." Slide 2: crop of `lease-dark.webp` with the Signatures tab. Slide 3: "Start free. No card needed." Keep the "Example data" label on every screen.
- **Known gap (VIDEO.md):** no showcase screen shows a completed signature. Do not show or imply a "Signed" status unless a real showcase screen has one.

### Post 5 — A repair, from request to vendor (Thu 2026-10-29)

- **Feature and source:** tenant requests with photos, work orders, vendors, quotes and invoices (brief §3).
- **Caption:**
  > A tenant reports a dripping faucet. What happens next?
  >
  > The tenant sends the request from their portal and can add photos. You turn it into a work order and assign a vendor. You can record the quote and the invoice, so the cost stays with the property.
  >
  > Your tenant does not need to install anything. The portal works in the browser.
  >
  > Start free: https://proppros.vercel.app/features/maintenance
- **Asset to create:** 3 slides at 1080 x 1350 from `maintenance-dark.webp` and `workorder-dark.webp`. Slide 3 is the CTA slide.
- **Known gap (VIDEO.md):** the showcase work order has no photos. The caption says tenants "can add photos". Do not show photos that are not in the screen.

### Post 6 — Month-end books (Sat 2026-10-31)

- **Feature and source:** profit and loss, rent roll, expenses with receipt photos, CSV export (brief §3).
- **Caption:**
  > It is the last day of the month. Are your rental books ready?
  >
  > Proppros keeps a profit and loss report by property and by month. The rent roll shows each unit, its tenant, its rent and its balance on one page. Add expenses with a photo of the receipt. Export to CSV for your accountant.
  >
  > Start free: https://proppros.vercel.app/features/reports
  >
  > (The screen shows example data.)
- **Note:** say nothing about taxes or tax forms. Tax forms are not live.

### Reply rules for comments (after the owner approves posting)

- Answer product questions with facts from brief §3 only.
- If someone asks about online rent payment or SMS, say plainly that it is not available today. Do not promise a date.
- Do not give legal advice. For fair-housing or lease-law questions, suggest a local attorney or the local housing authority.
- Never ask for or repeat a tenant's personal details in public.

---

## 3. Community plan

Small landlords talk in a few places. The goal is to be useful there. Sign-ups are a side effect, not the goal.

### Where

| Community | What happens there | How we take part |
|-----------|--------------------|------------------|
| BiggerPockets forums (landlord and property management sections) | Questions about leases, late rent, tenant screening, repairs and tools | Answer questions with practical, tool-neutral advice. Mention Proppros only when someone asks for software, and only if the forum rules allow it. |
| r/Landlord on Reddit | Day-to-day landlord problems, often urgent | Read the sidebar rules first. Answer the question asked. Link to Proppros only where the rules allow it, for example in a thread that asks for software suggestions. |
| Local landlord Facebook groups | Local questions: vendors, local rules, rental markets | Ask the group admin before you ever mention Proppros. Most value comes from answering questions. |

### Rules

1. **Help first.** Answer the question that was asked. A good answer must be useful even if no one clicks a link.
2. **Disclose every time.** When Proppros comes up, say so. Proposed line:
   > Disclosure: I am the founder of Proppros, a property management tool for landlords. I use it for my own three rentals.
3. **Follow each community's self-promotion rules.** Read the rules of each forum, subreddit and group before the first post. Rules change, so check again each month. If the rules are unclear, ask a moderator or admin.
4. **Never spam.** No copy-paste replies. No links in threads that do not ask for tools. No direct messages to people who did not ask. No fake accounts and no asking friends to upvote.
5. **No claims beyond the brief.** The same "Do NOT claim" list from brief §3 applies in comments.
6. **Use the founder's real account.** The founder takes part as a person. The brand account does not join these communities.
7. **Privacy.** Never share real tenant details or screenshots of real data. Use example data only.

### Weekly rhythm (proposed; HYPOTHESIS)

- 3 sessions a week, about 20 minutes each.
- Each session: read new threads, answer 2 to 3 questions well, and save common questions as ideas for future posts.
- Keep a simple log of the threads joined and any mention of Proppros, so the owner can review it.

### Topics where the founder can help without selling

- Keeping a rent ledger: what to record, how to see who is behind.
- Move-in and move-out inspections with photos, and deposit letters.
- Writing a fair listing that describes the home, not the people.
- Preventive maintenance schedules, such as filter changes.
- Getting month-end numbers ready for an accountant.

### Before the first community post

- The owner approves this plan.
- The founder reads the current rules of each community.
- Nothing in this plan is posted until the owner gives that approval.
