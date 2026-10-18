# Direction 5 — Calm Month

v1 · 2026-10-17 · Product Designer · Brief v1 · Preview: `index.html`, `desktop.png`, `phone.png`

## Audience and positioning
A challenge to the category's long feature lists: tell the story of **one month** as a landlord. A timeline shows rent posting on the 1st, a lease signed, a late balance, a repair with a photo, a listing shared and a report exported. Impression: "this is my month, handled." Light mist and navy with a teal action.

## Principles
1. Time is the organizing idea: features appear as moments in a month.
2. Every moment is a live feature (brief §3).
3. A quiet light page with one deep navy band for price.
4. Serif body for warmth, sans headlines for clarity.

## Color tokens
| Role | Hex |
|---|---|
| Mist page / panel | `#EEF2F6` / `#FFFFFF` |
| Navy ink and band | `#13294B` (band text `#E9EEF5`, muted `#BAC6D6`, 8.4:1) |
| Muted text | `#4F5F75` (5.8:1) |
| Action teal | `#0E6B66` with white text (6.3:1); soft `#DDEFEC` |
| Moment tags | rose `#A63A32` on `#F8E1DE`; amber `#8A5A00` on `#FBEBCB` (5.0:1); sky `#24498A` on `#E1EAF8` |

## Type
| Role | Family | Weight / size |
|---|---|---|
| Display / UI | Albert Sans | 600/700; hero clamp(40px, 5.6vw, 74px) |
| Body | Source Serif 4 | 400; 17px body, 20px lead |
| Dates / tags | Spline Sans Mono | 400/500; 11.5–13.5px |

## Layout and spacing
1200px container, centered hero, then a full-width month card with a horizontal track of 6 events. At ≤900px the track turns vertical with a rail on the left. Step cards use a 16px radius; the navy pricing band uses 24px.

## Components
Teal buttons with a 10px radius; white outlined secondary. Timeline event: date, one-line event, colored tag. Pricing as a list inside the navy band.

## Imagery
No photos. The month timeline is an illustration made from example data and labeled. Later, each event can open a real screenshot of that screen.

## Motion
Events pin in from left to right (450ms, 80ms stagger), like days passing. **Reduced motion:** all events show at once.

## Accessibility
Contrast checked. The timeline is a labeled image in the preview; the real build should use an ordered list. Status is always written in the tag.

## Avoid
Promising reminders by email or SMS (not live). Calendar clichés such as tear-off pages. More than six events.
