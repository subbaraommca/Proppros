# Proppros video: "One calm month" (Concept 1)

**Status: DRAFT, pending owner approval.** Nothing is uploaded, posted or boosted.
**Based on:** PROJECT-BRIEF **v2** (2026-10-18) and ADS-RESEARCH.md v1, section 9 "Creative brief B".
**Made by:** Content Creator - Video, 2026-10-18.
**Process note:** to save time, the PM asked for the storyboard and the render together. The owner reviews both at the end, so the storyboard was not approved before the render.

## Files

| What | Path |
|------|------|
| Rendered video (H.264, 1080 x 1920, 30 fps, 22.0 s, 3.8 MB, no audio track) | `marketing/video/out/one-calm-month-1080x1920.mp4` |
| Review stills (1 s, 8.3 s, 15 s, 21 s) | `marketing/video/out/still-01s.png`, `still-08s.png`, `still-15s.png`, `still-21s.png` |
| Editable source (Remotion 4.0.536, React 18.3.1) | `marketing/video/src/OneCalmMonth.tsx` (scenes, copy, timings and pan/zoom points are in the `SCENES` array at the top) |
| Screens used (copied from `frontend/public/screens/`, fictional showcase data) | `marketing/video/public/screens/` |
| Fonts (Archivo variable with width axis, DM Sans; OFL-1.1, from the frontend's @fontsource packages) | `marketing/video/public/fonts/` |

`out/` and `node_modules/` are git-ignored. To re-render: `cd marketing/video && npm install && npm run render`. To edit visually: `npm run studio`.

## Two concepts (from creative brief B)

1. **"One calm month" (RECOMMENDED, rendered).** A month of six days on a timeline: rent posts, a lease is signed, balances show, a repair gets a vendor, a vacancy fills, the books are ready. It matches the approved "How it works" section (`MONTH` in `frontend/src/marketing/content.ts`), so the ad and the home page tell the same story.
2. **"Fill your vacancy" (backup, 18 s, not rendered).** Blank "For rent" sign, then a listing, share link, ready-to-post ad text, share image and QR flyer, then applications. End card "Fill your vacancy. Start free." Landing page `/features/vacancies`. It needs screens of the ad text, share image and flyer, which are not in `frontend/public/screens/` yet.

## Storyboard (as rendered)

Format: 1080 x 1920 (9:16), 30 fps, 660 frames = 22 s. Background `#111217`, copper `#EDAF88`, text `#FFFFFF` / `#E6DFD8`. Day numbers and end title in Archivo 800 at 112% width; captions in DM Sans 700.

Fixed layout on every scene, all inside the Reels safe area (14% top = 269 px, 35% bottom = 672 px, 6% sides = 65 px; usable box x 65 to 1015, y 269 to 1248):
- **Timeline** (y 293 to 373): six dots (1st, 3rd, 6th, 12th, 20th, 31st). A copper line grows to the current day; the current dot is larger and its label is white.
- **Day counter** (y 369 to 519): the day in copper, 136 px, springs up from below (the "calendar flip").
- **Caption** (y 531, 56 px, one or two lines): the burned-in caption.
- **Screen card** (y 689 to 1234, 950 px wide): a real product screen with a slow pan and zoom, then a copper outline on the important area while the rest dims a little. A small "Example data" label sits in the bottom-right corner of every screen.
- The bottom 35% stays empty on purpose (Reels name, caption and buttons cover it).

| Time | Day | Caption (burned in) | Screen and motion | MONTH step it shows |
|------|-----|---------------------|-------------------|---------------------|
| 0.0 to 2.0 s | 1st | Rent charges post on their own. | Lease ledger (Maple Court, Unit 2A). Slow zoom; the "Rent — October 2026" charge row gets the copper outline at 0.4 s. | "Rent charges post" |
| 2.0 to 5.0 s | 3rd | Lease signed online. | Same lease, header: "Active" status, balance, monthly rent, tab row. Zoom in; the "Signatures" tab gets the outline. | "A new lease is signed" |
| 5.0 to 8.0 s | 6th | See who is behind. | Dashboard. Pans from the summary cards to "Balances due" (two tenants, amounts in red), which gets the outline. | "You see who is behind" |
| 8.0 to 12.0 s | 12th | A leak is reported. Vendor assigned. | Work order "#1 Kitchen faucet dripping" with the tenant's description and activity, then pans to the Vendor card (Brightline Plumbing Co.), which gets the outline. | "A tenant reports a leak" |
| 12.0 to 16.0 s | 20th | Vacancy shared. Applications come in. | Listing page: share link, then "Applicants (2)" gets the outline. At 14 s it changes to the public listing page on a phone (price, "Apply now", fair-housing note, photo) and pans down. | "A vacancy is shared" |
| 16.0 to 19.0 s | 31st | Books ready for your accountant. | Reports, Profit & loss by property with totals; the "CSV" export button gets the outline. | "Your books are ready" |
| 19.0 to 22.0 s | End | One calm month. / Start free / proppros.vercel.app / No card needed. Built by a landlord. | Proppros logo, title, copper "Start free" button, URL and small line. Each line fades up in turn. The timeline fades out. | CTA |

**Hook (first 2 s):** the big copper "1st" plus "Rent charges post on their own." over a ledger that already has the charge. No logo intro; the product is on screen from frame 1.
**Pacing:** 2 s, then 3 s per day, 4 s for the two busiest days, 3 s end card. Scenes change with a short fade (about 0.15 s).
**Audio:** none. The file has no audio track. Captions carry the whole message, because most feeds play muted.
**CTA:** "Start free" on the end card. In Meta, use the "Sign up" button and the landing page `https://proppros.vercel.app/` (the real sign-up).

## Caption (post text, for review only; not posted)

Primary text (Meta Reels shows about 44 characters before "more"):

> One calm month of landlording, in one place.
>
> Rent charges post on their own. Leases are signed online. You see who is behind, assign a vendor to a repair, share a vacancy and take applications online. At the end of the month, your profit and loss is ready to export for your accountant.
>
> Free plan. No card needed. Built by a landlord who runs 3 rentals with it.

Headline: `Start free` · Button: `Sign up` · URL: `proppros.vercel.app`

## Alt text

> A 22-second vertical video on a dark background. A copper timeline runs across the top with six days of a month: 1st, 3rd, 6th, 12th, 20th and 31st. For each day, a large copper day number and a white caption appear above a real Proppros screen with example data. 1st: "Rent charges post on their own" over a lease ledger with an October rent charge. 3rd: "Lease signed online" over a lease page with a Signatures tab. 6th: "See who is behind" over a dashboard list of balances due. 12th: "A leak is reported. Vendor assigned" over a work order for a dripping kitchen faucet with a plumbing vendor. 20th: "Vacancy shared. Applications come in" over a listing with two applicants and then a public listing page on a phone. 31st: "Books ready for your accountant" over a profit and loss report with a CSV export button. The video ends with the Proppros logo, the words "One calm month.", a copper "Start free" button, the address proppros.vercel.app and the line "No card needed. Built by a landlord." There is no sound.

## Facts check (every claim is in brief v2 section 3)

| On-screen claim | Source |
|-----------------|--------|
| Rent charges post on their own | Brief §3 "monthly charges post automatically"; MONTH step 1 |
| Lease signed online | Brief §3 "built-in e-signature"; MONTH step 2 |
| See who is behind | Brief §3 "the ledger shows who is behind"; dashboard "Balances due" |
| A leak is reported. Vendor assigned. | Brief §3 maintenance, work orders, vendors; MONTH step 4 |
| Vacancy shared. Applications come in. | Brief §3 public listing pages, share links, online applications; MONTH step 5 |
| Books ready for your accountant | Brief §3 profit and loss, CSV export; MONTH step 6 |
| Start free · No card needed · Built by a landlord | Brief §2 (sign-up works, free plan), §1 founder story, D2 |

Not claimed: online rent payment, SMS, app-store app, AI, bank sync, email notifications, any number of users, any review. All names, addresses and amounts on screen come from the fictional showcase database ("Maple Row Rentals", "Jordan Avery", @example.com addresses, 555 phone numbers), and each screen has the "Example data" label.

## Differences from creative brief B (for the owner to accept or change)

1. **12th caption.** The brief says "A leak, with photos. Vendor assigned." The showcase work order shows "No photos yet", so the caption is "A leak is reported. Vendor assigned." to match the screen. To use the brief's line, add photos to that showcase work order and retake the screen.
2. **3rd scene.** No showcase screen shows a "Signed" status or a signed PDF. The video shows the lease page and outlines the "Signatures" tab. A screen of the Signatures tab with a completed signature would be stronger.
3. **20th scene.** There is no flyer or QR screen in `frontend/public/screens/`, so the scene uses the listing page (share link, applicants) and the public listing on a phone instead of "the QR flyer slides in".
4. **1st scene.** The balance column on the right edge of the ledger is slightly cut off. The charge column, which matters, is fully visible.

## Limits and checks done

- Rendered with `npx remotion render` (Remotion's own headless browser); no Chrome fallback was needed. Checked with ffprobe: H.264, 1080 x 1920, 30 fps, 22.00 s, about 1.37 Mbit/s.
- The pixel format is reported as `yuvj420p` (full range) because frames are captured as JPEG. Meta and YouTube accept this. If an upload tool rejects it, re-encode with `-pix_fmt yuv420p`.
- No audio track. Some ad tools want a track; if so, add a silent track when you export.
- I checked 11 still frames by eye for text size, safe area and cropping, and fixed three crops (work order, dashboard, reports) and one scene change (a cross-fade that overlapped two screens).
- The screens are desktop screenshots shown in a 950 px card, so the small UI text in them is about 17 to 25 px high. The burned-in captions (56 px) carry the message; the screens are support.
- Not tested in a real Reels preview (that needs an upload, which needs the owner's approval).

## Open questions for the owner

1. Approve this draft, or ask for changes (copy, pace, scenes)?
2. Accept the three differences from brief B above, or should the showcase data get leak photos, a signed lease and a flyer screen so the video can match the brief word for word?
3. Make Concept 2 "Fill your vacancy" next?
4. Add licensed music or a voice-over, or keep it silent?
