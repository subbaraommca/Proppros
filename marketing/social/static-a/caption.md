# Static A: "Fill your vacancy" (Meta Feed, 4:5)

- **Brief version read:** PROJECT-BRIEF v2 (2026-10-18); Creative brief A in `docs/growth/ADS-RESEARCH.md` §8
- **Files:** `static-a-1440x1800.png` (main), `static-a-1080x1350.png` (second size), `index.html` (editable source)
- **Status:** DRAFT for owner review. Nothing is uploaded, posted or paid for.

## Ad fields (Meta: Facebook and Instagram Feed)

| Field | Copy | Length |
|-------|------|--------|
| Primary text | Got a unit coming open? Proppros gives each listing a public page, ready-to-post ad text, a share image, a QR flyer and online applications. | 140 characters (Meta range 50–150) |
| Headline | Fill your next vacancy | 22 characters (Meta recommends 27 or fewer) |
| Description | No card needed. | 15 characters |
| CTA button type | Sign Up | Matches the one conversion path, "Start free" |
| Destination URL | https://proppros.vercel.app/features/vacancies | |

## Text in the image

- Hook (copper, DM Sans): "Got a unit coming open?"
- Headline (Archivo 112%, 800): "One listing. Everything you need to fill it."
- Supporting line: "A listing page, ready-to-post ad text, a share image, a QR flyer and online applications."
- Button: "Start free" · Small print: "No card needed." · Wordmark: Proppros
- Labels: "Example data" next to the browser screen and next to the phone screen

## Alt text

Proppros ad. Headline: One listing. Everything you need to fill it. The Proppros vacancies screen with a published listing and two applications, the listing text editor, and the public listing page on a phone. All screens show example data. Button: Start free.

## Which brief items it implements

- 1440 x 1800 PNG (4:5) and the 1080 x 1350 export.
- Background #111217, one copper accent (#EDAF88) used for the hook, the thin rule and the button. White headline and off-white body text (#E6DFD8). Both pass WCAG AA on #111217.
- Layout: hook, headline and supporting line in the top 40%; product screens in the middle; button, small print and wordmark at the bottom.
- Safe areas: all text stays inside 96 px side margins (the 6% rule is 86 px). The lowest text ends at about y = 1604, above the bottom 10% (y 1620) where Meta places its CTA bar.
- Screens come only from the fictional showcase data in `frontend/public/screens/` (`vacancy-dark.webp`, `listing-manage-dark.webp`, `listing-public-phone-dark.webp`). Applicant names are cropped out. The listing text describes the home only.
- No people, no stock photos, no app store badges, no rent payment, no "post to 20 sites" claims, no user counts and no unit counts.

## Changes from the brief (and why)

1. **No share-image or flyer artwork in the image.** The brief asked for the share image and the QR flyer, laid at an angle. Those captures do not exist in `frontend/public/screens/`, and I did not make mock versions (they would look like product screens). In their place: the listing text editor (the "ready-to-post ad text" source) and the public listing page on a phone. The supporting line still names the share image and the QR flyer. **Before launch, confirm that the vacancy marketing kit is live in production.** Brief §2b lists it as "in scope", not in §3 "live in production". If it is not live, change the supporting line to "A listing page with a share link and online applications."
2. **Vacancy screen cropped below its header.** The phone covered the "New listing" button and cut it. The browser bar shows "/vacancies" for context.
3. **The views counter shows 0.** That is the real showcase value. It is not a claim about results.
4. **The phone screen shows the product's fair-housing note, which uses "don't".** That is product text in a screenshot, not ad copy, so I left it as it is.
