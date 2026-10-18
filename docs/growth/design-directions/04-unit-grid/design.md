# Direction 4 — Unit Grid

v1 · 2026-10-17 · Product Designer · Brief v1 · Preview: `index.html`, `desktop.png`, `phone.png`

## Audience and positioning
A Swiss, engineered direction. A very large grotesk headline and one signature object: every unit as a colored tile (paid, rent due, vacant, open repair). Impression: "I can see my whole portfolio at a glance." Speaks most to the landlord with 5–20 units.

## Principles
1. One glance, every unit: the grid is the idea.
2. Black ink, white space, one signal blue.
3. Status color only with a word in the tile.
4. 12-column grid, square corners, hard rules.

## Color tokens
| Role | Hex |
|---|---|
| Page / panel | `#FAFAF7` / `#FFFFFF` |
| Ink / muted / line | `#0E0F12` / `#555A63` (6.6:1) / `#E2E3DE` |
| Signal (action) | `#2443C9` with white text (7.7:1); hover `#1C36A6` |
| Paid | edge `#2E7D5B`, text `#1E5A40` on `#E2F1E9` |
| Rent due | edge `#B3261E`, text `#8E1D17` on `#FBE5E3` (7.5:1) |
| Vacant | edge `#8A6100`, text `#6B4B00` on `#FBEFCF` (7.0:1) |
| Open repair | edge `#2443C9`, text `#1C36A6` on `#E3E8FB` |

## Type
| Role | Family | Weight / size |
|---|---|---|
| Display | Hanken Grotesk | 800, tracking −0.045em; hero clamp(44px, 7.4vw, 112px) |
| Body | Hanken Grotesk | 400/600; 16.5px body, 19px lead |
| Data | DM Mono | 400/500; 12.5–13.5px |

## Layout and spacing
1240px container on a 12-column grid. The headline spans about 7 columns; the lead sits in columns 1–5 and the CTAs in columns 7–12. The portfolio board is full width with one column per property. Section headers: label in columns 1–3, title in columns 4–12, under a 1px ink rule. Large blue step numerals.

## Components
Square buttons (48px). Portfolio board with a legend. Unit tile: 4px left status edge, unit name, mono status.

## Imagery
No photos. The unit grid is an **illustration**: Proppros has no such screen today. The preview labels it "Illustration built from example data. Not a screen in the product today." Pair it with real screenshots lower on the page.

## Motion
Tiles fade in property by property (350ms, 50ms stagger), like a portfolio loading. **Reduced motion:** static.

## Accessibility
Contrast checked. Each tile carries a word. The legend repeats the meaning. The board has `role="img"` and a text label.

## Avoid
Implying that a portfolio grid screen exists. Showing more than 20 units (off-audience). A cold, all-black page with no warmth.
