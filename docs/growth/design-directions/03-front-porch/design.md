# Direction 3 — Front Porch

v1 · 2026-10-17 · Product Designer · Brief v1 · Preview: `index.html`, `desktop.png`, `phone.png`

## Audience and positioning
The human side of being a small landlord: homes, tenants and the paperwork between them. Warm forest green and cream, a soft serif and rounded paper cards. Impression: "a neighborly, careful landlord." The founder fact gets its own band.

## Principles
1. Show the artifacts, not a dashboard: a signed lease, a repair photo, a tenant balance.
2. Warm but adult: forest and cream, no cartoons.
3. Rounded and soft, with one clay accent for action.
4. The founder fact is a section, not a footnote.

## Color tokens
| Role | Hex |
|---|---|
| Forest (hero band) / forest 2 | `#1F3A2E` / `#2A4A3B` |
| Cream page / card / sand | `#F3EEE4` / `#FFFDF8` / `#E7DFD0` |
| Ink / muted | `#22201C` / `#5E5A52` (5.9:1) |
| Text on forest / muted | `#F3EEE4` / `#C5D1C8` (7.8:1) |
| Action (light clay) | `#E9A27F` with ink text (7.7:1) |
| Clay (labels on cream) | `#A9532F` (4.6:1) |
| Sage (positive) | `#3E7A5C` |

## Type
| Role | Family | Weight / size |
|---|---|---|
| Display | Fraunces (opsz 9–144) | 500/600; hero clamp(40px, 5.4vw, 68px) |
| Body | Work Sans | 400/600; 17px body, 19px lead |
| Signature only | Caveat | 500; only inside the lease mock signature |

## Layout and spacing
1200px container. A forest hero band with a two-column grid: copy left, three tilted paper cards right. On phone the cards stack vertically with offsets and do not overlap. Radii: pill buttons, cards 14–18px, bands 24px. Section rhythm 96px (64px on phone).

## Components
Pill buttons; outlined secondary on forest. Step cards with a forest numbered disc. A founder band on sand with a two-house line icon. Feature list with a 2px forest top rule.

## Imagery
Art brief: paper artifacts from the real workflow (lease, work order with a photo, portal balance), drawn in HTML/CSS. Later: photos of the founder's own rentals, only if the owner supplies them. No stock photos of people holding keys.

## Motion
Cards settle into place on load (fade and 16px rise, 700ms, 120ms stagger). **Reduced motion:** cards are static.

## Accessibility
Contrast checked. Rotations are small (≤ 2.5°). The signature font is decorative; the "Signed online" label carries the meaning.

## Avoid
Cartoon houses, emoji, playful bounces. Overlapping cards that hide text (found and fixed in v1). The e-signature mock must match the real signing screen before launch.
