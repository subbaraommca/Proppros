# Direction 2 — Ledger Paper

v1 · 2026-10-17 · Product Designer · Brief v1 · Preview: `index.html`, `desktop.png`, `phone.png`

## Audience and positioning
Landlords who keep a spreadsheet or a paper ledger today. The page looks like a clean, trusted account book, and the hero object is the rent ledger itself. Impression: "my books, finally tidy." Restrained, light and bookish.

## Principles
1. The ledger is the hero: rows of tenants, amounts and status.
2. Rules, not boxes: thin ruled lines and one strong ink rule per section.
3. Numbers in mono, right-aligned, always with cents.
4. One green action color. A red margin rule is the only ornament.

## Color tokens
| Role | Hex |
|---|---|
| Paper / sheet | `#F7F5EF` / `#FFFFFF` |
| Rule / rule strong | `#DCE1E8` / `#B9C2CE` |
| Ink / muted | `#1D2733` / `#55606E` (5.9:1) |
| Action (ledger green) | `#1F5F4A` with white text (7.5:1); hover `#174B3A` |
| Margin red (ornament, step numbers) | `#C0473B` (4.6:1) |
| Paid / Behind / Soon | `#1F6B4F` on `#E3F0E9` · `#A4372C` on `#F7E4E1` (5.4:1) · `#7A5A0E` on `#F5ECD5` (5.4:1) |

## Type
| Role | Family | Weight / size |
|---|---|---|
| Display | Newsreader (serif) | 500; hero clamp(40px, 5.6vw, 72px); h2 28–38px |
| Body | Public Sans | 400/600; 16.5px body, 18px lead |
| Numbers / labels | IBM Plex Mono | 400/500; 12–15px |

## Layout and spacing
1120px container, 32px gutter (16px on phone). Hero: headline left (7 parts), offer and CTA right (4 parts), then a full-width ledger sheet. Sections use a 3:8 split with the title in the left column under a 2px ink rule. On phone the ledger hides the Unit and Paid columns.

## Components
- Primary button: green, 4px radius, 46px. Secondary: underlined text link "See pricing".
- Ledger table: 2px ink header rule, 1px row rules, mono status "stamps".
- Pricing: a 3-row ruled table, not cards.

## Imagery
No photos. The ledger, rent roll and profit-and-loss tables are the image family, always from example data and labeled.

## Motion
Ledger rows fade in one after another (400ms each, 80ms stagger), like ink drying. **Reduced motion:** rows are static.

## Accessibility
Contrast checked (all ≥ 4.5:1). Real `<table>` markup with headers. Status always has a word, not only color. Focus: 2px green outline.

## Avoid
Fake handwriting, coffee stains, skeuomorphic paper texture. Tiny serif body text. Bank or tax-form claims.
