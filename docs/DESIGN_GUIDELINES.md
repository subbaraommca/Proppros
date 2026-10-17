# Proppros Design Guidelines — "Strata"

> **Version:** 1.0 · **Date:** 2026-10-17
> **Implements:** `frontend/src/styles.css` (all tokens live there)
> **Inspired by:** the principles in [HEX_DESIGN_SYSTEM.md](HEX_DESIGN_SYSTEM.md). Proppros uses its own palette, names and freely licensed fonts. Never copy Hex's brand colors or typefaces.

Strata is named for the mineral layers under every property: dark bedrock surfaces, warm mineral accents, and layers stacked by tone rather than shadow. Proppros is a working tool that landlords open every day to check money, leases and repairs. So the design goal is **calm, premium and very legible**, not flashy.

---

## 1. Principles

| # | Principle | What it means in Proppros |
|---|---|---|
| 1 | **Dark-first** | Basalt (near-black, cool) is the default. Limestone (light) is a full theme, not an afterthought; users switch in the sidebar and the choice is remembered. The sidebar stays dark in both themes as the brand anchor. |
| 2 | **Minerals, not neon** | Accents are warm, muted gem tones (carnelian, jade, citrine, garnet, lapis, amethyst). No saturated primaries, no pure black (`#000`), no pure red/green. |
| 3 | **Type does the work** | A semi-expanded display face (Archivo, `font-stretch: 112%`) for titles and big numbers, set against a clean geometric UI sans (DM Sans). Hierarchy comes from type, not color or boxes. |
| 4 | **Data wears mono** | Money columns, receipt numbers, dates in ledgers, badges and eyebrow labels use JetBrains Mono. Numbers line up and read as data. |
| 5 | **Sharp corners** | Radii are 0–7px. Cards 2px, inputs 6px, primary buttons 0px. Never above 8px. Pills (`999px`) are only for status dots. |
| 6 | **Borders over shadows** | Layers separate with 1px tonal borders and the layer scale. Shadows are reserved for floating things (modals, menus). |
| 7 | **Tactile surfaces** | A faint paper-noise texture (≈5% dark / 3% light) sits on the page and sidebar, behind the content. It must never reduce text contrast. |
| 8 | **Color means something** | Each accent has one job (§2.3). Status color always comes with a text label or icon, never color alone. |

### Where we deliberately differ from the Hex reference

| Hex reference | Strata | Why |
|---|---|---|
| Body text is rose-tinted (`#F5C0C0`) | Body text is warm bone (`#E6DFD8`) | Tinted body text tires the eyes in long tables of numbers. The accent stays for emphasis. |
| 18px body, 60px heroes (marketing scale) | 14px body, 26px page titles (product scale) | Dense, daily-use screens. |
| Body weight 300 | Body weight 400; 300 only for large lead text | Thin weights at 14px fail on low-DPI screens. |
| Primary button text white on rose | Basalt text on carnelian (9.9:1) | White on a light accent fails WCAG. |
| Proprietary fonts | Archivo, DM Sans, JetBrains Mono, Instrument Serif (all OFL, self-hosted via Fontsource) | Licensing, and no external font requests. |

---

## 2. Color

### 2.1 Basalt (dark, default)

| Token | Value | Role |
|---|---|---|
| `--pp-bg-sidebar` | `#0D0E12` | Sidebar, mobile top bar (same in both themes) |
| `--pp-bg` | `#111217` | Page background |
| `--pp-surface` | `#16171D` | Cards, panels, modals |
| `--pp-surface-muted` | `#1B1D24` | Table headers, sub-sections, board columns |
| `--pp-surface-hover` | `#1F2129` | Row hover, raised controls |
| `--pp-border-subtle` | `#22242C` | Inner dividers, table rows |
| `--pp-border` | `#2C2E37` | Card and control borders |
| `--pp-border-strong` | `#454753` | Inputs, emphasized edges |
| `--pp-text` | `#E6DFD8` | Default text ("bone") |
| `--pp-text-muted` | `#9C9AA3` | Meta, labels, captions ("ash", 6.4:1 on surface) |
| `--pp-text-loud` | `#FFFFFF` | Headlines, key numbers only |

### 2.2 Limestone (light)

| Token | Value |
|---|---|
| `--pp-bg` | `#F6F4F0` (warm paper) |
| `--pp-surface` | `#FFFFFF` |
| `--pp-surface-muted` | `#F1EEE9` |
| `--pp-surface-hover` | `#EFECE7` |
| `--pp-border-subtle` | `#ECE8E2` |
| `--pp-border` | `#E1DCD4` |
| `--pp-border-strong` | `#C9C2B8` |
| `--pp-text` | `#2B2724` |
| `--pp-text-muted` | `#6B6560` (5.7:1) |
| `--pp-text-loud` | `#14110F` |

### 2.3 Mineral accents: one job each

| Mineral | Dark | Light | Job | Used for |
|---|---|---|---|---|
| **Carnelian / Copper** | `#EDAF88` | `#A4502A` | Brand & action | Primary buttons, links, active nav, focus ring, brand mark |
| **Jade** | `#62BA9E` | `#26705A` | Positive | Paid, active, occupied, completed, credits |
| **Citrine** | `#D9B45B` | `#7D5F0F` | Attention | Vacant, due soon, in progress, high priority |
| **Garnet** | `#DB7B7B` | `#B03A3A` | Problem | Overdue balances, emergency, destructive actions, errors |
| **Lapis** | `#93A8E2` | `#3E58A8` | Informational | New, scheduled, info notices |
| **Amethyst** | `#B892CC` | `#7B4D94` | Secondary accent | Assigned, roles, "maintenance" unit status |

Each mineral has a `-soft` tint (14% over surface in dark, 11% over white in light) for badge and notice backgrounds. Text on its own tint is ≥ 5.0:1 dark and ≥ 4.8:1 light.

**Status mapping** (implemented in `Badge` in `components/ui.tsx`):

| Tone | Values |
|---|---|
| jade | active, occupied, completed, paid |
| citrine | vacant, in_progress, high |
| garnet | emergency, overdue |
| lapis | new, scheduled, invited, medium |
| amethyst | assigned, maintenance, manager |
| carnelian | owner, primary |
| neutral | ended, closed, low, accountant, tenant |

### 2.4 Chart palette (validated)

Charts don't reuse status colors. Income vs. expenses use a blue/copper pair that stays distinct for colorblind readers. All values pass the dataviz validator (lightness band, chroma floor, CVD ΔE ≥ 23, contrast ≥ 3:1):

| Series | Dark (on `#16171D`) | Light (on `#FFFFFF`) |
|---|---|---|
| Income (`--pp-chart-1`) | `#5B8DEF` | `#3461C1` |
| Expenses (`--pp-chart-2`) | `#D9773F` | `#B85A2A` |

Rules: always a legend for two or more series; grid lines use `--pp-border-subtle`; axis and tick text uses `--pp-text-muted`; values in tooltips use text tokens, never the series color. Add a third series only by re-running the validator.

---

## 3. Typography

| Role | Family (token) | Use |
|---|---|---|
| Display | Archivo Variable, `font-stretch: 112%` (`--pp-font-display`) | Page titles, card titles, stat values, brand wordmark |
| UI / body | DM Sans Variable (`--pp-font-body`) | Everything else |
| Data | JetBrains Mono Variable (`--pp-font-mono`) | Money in tables, ledger dates, receipt and work order numbers, badges, eyebrow labels |
| Editorial | Instrument Serif *italic* (`--pp-font-editorial`) | At most one accent line per screen, e.g. the sign-in hero quote. Never for UI. |

### Scale (product)

| Token | Size / line-height | Weight | Element |
|---|---|---|---|
| `--pp-text-hero` | 40 / 1.1, tracking −0.02em | Display 750 | Auth hero, portal balance |
| `--pp-text-title` | 26 / 1.2, tracking −0.015em | Display 720 | Page title (`h1`) |
| `--pp-text-stat` | 26 / 1.1 | Display 680 | Stat tile value |
| `--pp-text-section` | 15 / 1.3 | Display 650 | Card / section title (`h2`) |
| `--pp-text-base` | 14 / 1.5 | Body 400 | Body, table cells, inputs |
| `--pp-text-sm` | 13 / 1.45 | Body 400–500 | Secondary text, buttons-sm |
| `--pp-text-xs` | 12 / 1.4 | Body 400 | Captions, meta |
| `--pp-text-eyebrow` | 11 / 1.3, uppercase, tracking 0.08em | Mono 500 | Stat labels, table headers |

Rules: white (`--pp-text-loud`) only for headings and key figures. No bold body text (max 600 for a label). Don't put display type in paragraphs.

---

## 4. Shape, borders, elevation, texture

| Token | Value | Use |
|---|---|---|
| `--pp-radius-none` | 0 | Primary buttons |
| `--pp-radius-xs` | 2px | Cards, secondary buttons, badges, table wrappers, nav items |
| `--pp-radius-sm` | 3px | Modals, photo tiles, menus |
| `--pp-radius-md` | 6px | Inputs, selects, textareas |
| `--pp-radius-pill` | 999px | Status dots and progress bars only |

- **Borders:** cards `1px solid --pp-border`; inner dividers `--pp-border-subtle`; inputs use an inset 1px ring (`box-shadow: inset 0 0 0 1px var(--pp-border-strong)`), not a border.
- **Focus:** `2px` ring in carnelian (`--pp-focus`), offset 2px, on every interactive element. Never remove it.
- **Elevation:** only `--pp-shadow-float` (`0 12px 32px rgba(0,0,0,.45)` dark) for modals and drawers. Cards have no shadow.
- **Accent glow:** `--pp-glow` (soft carnelian) marks the single most important card on a screen (e.g. the portal balance). Use it once at most.
- **Texture:** `--pp-texture` (an inline SVG noise data-URI) layered behind the page and sidebar backgrounds. No external asset needed.

## 5. Spacing & layout

- 4px base: `--pp-space-1` (4) … `--pp-space-12` (48). Card padding 20px; gaps between cards 16px; page padding 32px desktop / 16px mobile.
- App shell: 240px dark sidebar + content (max 1280px). Below 900px the sidebar becomes a drawer behind a top bar.
- Breakpoints: 1100px (4-up stats → 2-up), 900px (two-column → stacked), 600px (forms → one column).
- Tables scroll horizontally inside their card. The page itself never scrolls sideways.

---

## 6. Components

| Component | Spec |
|---|---|
| **Primary button** | Carnelian fill, basalt text, 0 radius, 36px tall, DM Sans 600 13.5px. Hover: lighten 6%. One per area. |
| **Secondary button** | Transparent, 1px `--pp-border-strong`, 2px radius, `--pp-text`. Hover: border → carnelian, text → loud. |
| **Ghost / icon button** | No border; hover fills `--pp-surface-hover`. Icons 15–18px, Lucide, stroke 1.75. |
| **Danger button** | Secondary shape, garnet text; hover garnet-soft fill. Always behind a confirm. |
| **Input / select** | 38px, 6px radius, transparent bg, inset ring; focus ring carnelian. Placeholder `--pp-text-muted`. Money inputs show a `$` prefix and mono digits. |
| **Card** | `--pp-surface`, 1px border, 2px radius, header 14px/20px padding with `h2` in display face. |
| **Stat tile** | Eyebrow (mono caps, muted), value (display, loud), sub-line (muted 12.5px). Value is the hero; no icons bigger than 14px. |
| **Table** | Header row: eyebrow style on `--pp-surface-muted`. Rows 44px, `--pp-border-subtle` dividers, hover `--pp-surface-hover`. Numeric columns right-aligned mono. |
| **Badge** | Mono 11.5px, 2px radius, `-soft` background + mineral text, 2px × 8px padding. Sentence case. |
| **Nav item (sidebar)** | DM Sans 500 14px, ash text; hover bone; active: carnelian 2px left rule + `rgba(carnelian, .10)` fill + loud text. |
| **Tabs** | Underline style: 2px carnelian rule on the active tab; inactive tabs muted. |
| **Modal** | `--pp-surface`, 3px radius, float shadow, backdrop `rgba(5,6,9,.7)`. Title in display face. |
| **Notices** | Error / success boxes: `-soft` background, 2px left rule in the mineral, text in the mineral. |
| **Empty state** | Muted 36–40px icon, display-face title, one-line explanation, one primary action. |
| **Timeline comment** | Surface-muted block; internal notes get a citrine left rule and a "lock: Internal" tag; system events are single muted lines. |
| **Balance text** | Owed → garnet, credit → jade with the word "credit", zero → default. Always mono. |

## 7. Voice in the UI

Plain, short, landlord-friendly words: "Record payment", "End lease", "Balance due". Money is always formatted (`$1,850.00`). Dates are `Oct 17, 2026`. Never use error codes in the UI.

## 8. Accessibility checklist

- Text contrast ≥ 4.5:1 (all token pairs above are measured; muted text is 6.4:1 dark and 5.7:1 light).
- Focus ring visible on every control; modals trap Escape and label themselves.
- Status never by color alone: badges carry words, balances say "credit".
- Charts: validated CVD-safe pair, legend, native `<title>` tooltips, and the same data in the Reports tables.
- Touch targets ≥ 36px; layout works at 360px wide.

## 9. Do / Don't

**Do:** use tokens for every color, radius and font. Use the layer scale for depth. Keep one primary button per area. Use mono for numbers in tables. Keep corners sharp.

**Don't:** hard-code hex values in components. Use pure black or pure white backgrounds in dark mode. Use radii above 8px on cards or buttons. Use colored text for whole paragraphs. Reuse status colors as chart series. Stack shadows on cards. Use the editorial serif in controls.
