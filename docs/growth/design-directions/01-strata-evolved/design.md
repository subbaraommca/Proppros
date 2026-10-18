# Direction 1 — Strata, evolved

v1 · 2026-10-17 · Product Designer · Brief v1 · Preview: `index.html`, `desktop.png`, `phone.png`

## Audience and positioning
Independent US landlords with 1–20 units who want a serious tool. Keep today's brand (dark basalt, copper, Archivo expanded) and fix what it lacks: a clear offer, a product visual and visible proof. Impression: "a premium, calm control room for my rentals."

## Principles
1. Say the job first: the headline names leases, rent and repairs.
2. The product is the proof: a real-looking dashboard sits beside the offer.
3. Keep Strata: dark-first, minerals not neon, sharp corners, borders over shadows.
4. One primary action per screen: copper "Start free".

## Color tokens (from `docs/DESIGN_GUIDELINES.md`)
| Role | Hex |
|---|---|
| Page / deep | `#111217` / `#0D0E12` |
| Surface / muted | `#16171D` / `#1B1D24` |
| Border subtle / default / strong | `#22242C` / `#2C2E37` / `#454753` |
| Text / muted / loud | `#E6DFD8` / `#A3A1AA` (7.3:1; slightly lighter than the app's `#9C9AA3` for long marketing text) / `#FFFFFF` |
| Action (copper) | `#EDAF88`, text on it `#111217` (9.9:1) |
| Status | jade `#62BA9E`, citrine `#D9B45B`, garnet `#DB7B7B`, lapis `#93A8E2` |

## Type (Google Fonts in the preview; production self-hosts via Fontsource)
| Role | Family | Weight / size |
|---|---|---|
| Display | Archivo, `wdth 112` | 800; hero clamp(38px, 5.2vw, 64px); h2 28–40px |
| Body | DM Sans | 400/500/600; 16px body, 18.5px lead |
| Data / labels | JetBrains Mono | 400/500; 12px, sentence case (no all-caps eyebrows on marketing) |
| Editorial | Instrument Serif italic | Only the founder line. Never inside the headline. |

## Layout and spacing
1180px container, 24px gutter (16px on phone). Hero is a 5:6 two-column grid; it stacks at ≤900px with the copy first. Section rhythm 88px (64px on phone). A four-tone "strata" band closes the hero. Features use a 1px-gap grid so the borders form one ruled sheet.

## Components
- Primary button: copper, 0 radius, 44px tall (36px in nav), `:active` scale 0.97.
- Secondary: transparent, 1px strong border, 2px radius.
- Product visual: dashboard mock (sidebar, 4 stats, Balances due list), labeled "Example data".
- Steps: large copper numerals in ruled columns.
- Pricing: 3 cards. Free outlined in copper. Paid plans carry a citrine "Coming soon" tag and no button.

## Imagery
HTML/CSS product mocks, or real screenshots from **demo data only**. Never use screenshots that show the owner's name or real tenants (the current scratchpad shots show the owner's name in the sidebar). Icons: 1.6px stroke line icons in copper.

## Motion
One moment: the product visual rises 12px and fades in over 600ms (`cubic-bezier(.2,.8,.2,1)`) on load. Buttons: 160ms background change, 120ms press scale. **Reduced motion:** no entrance animation; the visual is simply present.

## Accessibility
All text pairs ≥ 4.5:1 (checked). Focus: 2px copper outline, 3px offset. The product visual has `role="img"` and a text label. Touch targets ≥ 44px on phone. No horizontal scroll at 390px (checked: scrollWidth 390).

## Avoid
Accenting one word of the headline in serif. All-caps mono eyebrows everywhere. Glows and neon. Claims about online payments, SMS or a store app.

## Remaining copy
FAQ, closing CTA and footer copy: see `../README.md`, section "Shared copy".
