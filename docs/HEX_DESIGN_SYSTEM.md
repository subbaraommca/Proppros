# Hex — Design System Reference

> **Version:** 1.0 · **Extracted:** April 2026 · **Source:** hex.tech
> **Purpose:** Agent-consumable design system for building UIs consistent with Hex's brand.
> Give this file to any coding agent (Claude Code, Cursor, Copilot, etc.) as context.

---

## 1. Core Principles

Hex's visual identity is built on a **gemstone-inspired dark palette** — deep obsidian backgrounds, rose quartz highlights, and mineral-named accent tones. The overall effect is premium, polished, and intentionally restrained.

**Dark-first:** Every surface defaults to near-black. Light mode exists but dark is the primary context. Design dark first, adapt to light second.

**Gem over neon:** Accent colors are muted and warm (rose quartz, amethyst, jade, citrine) — never saturated primaries. The palette feels geological, not digital.

**Type does the work:** Headlines use a distinctive semi-extended display face (PP Formula). Body copy sits in a clean geometric sans (GT Cinetype). The contrast between the two creates hierarchy without relying on color or decoration.

**Paper texture overlay:** Surfaces carry a subtle noise texture (`bkg-noise.webp` at 6.25% opacity, `200px` tiling, `normal` blend mode). This adds tactile warmth to the dark UI without competing with content.

**Minimal border-radius:** Components use very tight radii (`1px`–`7px`). Sharp corners reinforce the premium, editorial feel. Avoid anything above `12px`.

**Foreground scale system:** Hex uses a 12-step foreground opacity ramp (`fg100`–`fg1200`, plus alpha variants `fgA100`–`fgA1200`) for layering surfaces over the dark background. This replaces arbitrary gray values with a unified warm-tinted scale.

---

## 2. Color Palette

### 2.1 CSS Custom Properties

```css
:root {
  /* ── Named Brand Colors ── */
  --hex-black:          #01011B;
  --hex-white:          #FFFFFF;
  --hex-obsidian:       #14141C;    /* Primary background            */
  --hex-rose-quartz:    #F5C0C0;    /* Primary brand / highlight     */
  --hex-amethyst:       #A477B2;    /* Secondary accent              */
  --hex-minsk:          #473982;    /* Deep purple accent             */
  --hex-eggplant:       #31263B;    /* Dark purple for text on light  */
  --hex-jade:           #5CB198;    /* Success / positive accent      */
  --hex-citrine:        #CDA849;    /* Warning / attention accent     */
  --hex-opal:           #FBF9F9;    /* Light background (near-white)  */
  --hex-violet-topaz:   #5F509D;    /* Tertiary purple               */
  --hex-cement:         #717A94;    /* Muted UI text / meta           */

  /* ── Semantic Roles ── */
  --hex-color-primary:       var(--hex-rose-quartz);
  --hex-color-secondary:     var(--hex-black);
  --hex-color-accent:        #E3B2B3;    /* Muted rose — links, subtle emphasis */
  --hex-color-background:    var(--hex-obsidian);
  --hex-color-surface:       #111118;    /* Elevated card / panel bg     */
  --hex-color-text-default:  var(--hex-rose-quartz);
  --hex-color-text-muted:    #99797D;
  --hex-color-text-loud:     var(--hex-white);
  --hex-color-link:          #E3B2B3;
  --hex-color-highlight:     var(--hex-rose-quartz);

  /* ── Feedback ── */
  --hex-color-success:       #8DC572;
  --hex-color-error:         #BE6464;
  --hex-color-warning:       #F0AD4E;
  --hex-color-info:          #337AB7;

  /* ── Foreground Scale (warm-tinted grays over obsidian) ── */
  --hex-fg-100:   #14141C;
  --hex-fg-200:   #191820;
  --hex-fg-300:   #201D25;
  --hex-fg-400:   #252128;
  --hex-fg-500:   #2B252C;
  --hex-fg-600:   #312A31;
  --hex-fg-700:   #3A3138;
  --hex-fg-800:   #4C3E44;
  --hex-fg-900:   #6A565B;
  --hex-fg-1000:  #786065;
  --hex-fg-1100:  #99797D;
  --hex-fg-1200:  #E3B2B3;

  /* ── Foreground Alpha Scale (rose-quartz tinted transparency) ── */
  --hex-fgA-100:  rgba(245, 192, 192, 0);
  --hex-fgA-200:  rgba(245, 192, 192, 0.026);
  --hex-fgA-300:  rgba(245, 192, 192, 0.056);
  --hex-fgA-400:  rgba(245, 192, 192, 0.077);
  --hex-fgA-500:  rgba(245, 192, 192, 0.103);
  --hex-fgA-600:  rgba(245, 192, 192, 0.129);
  --hex-fgA-700:  rgba(245, 192, 192, 0.172);
  --hex-fgA-800:  rgba(245, 192, 192, 0.249);
  --hex-fgA-900:  rgba(245, 192, 192, 0.386);
  --hex-fgA-1000: rgba(245, 192, 192, 0.446);
  --hex-fgA-1100: rgba(245, 192, 192, 0.592);
  --hex-fgA-1200: rgba(245, 192, 192, 0.923);

  /* ── Background Scale ── */
  --hex-bg-300:   #0F0F15;
  --hex-bg-400:   #111118;
  --hex-bg-500:   #14141C;    /* same as obsidian — the default */

  /* ── Grid / Border Scale ── */
  --hex-grid-200:  #252128;
  --hex-grid-300:  #2B252C;
  --hex-grid-400:  #312A31;
  --hex-grid-500:  #3A3138;
  --hex-grid-600:  #4C3E44;
  --hex-grid-700:  #6A565B;
  --hex-grid-1200: #E3B2B3;
}
```

### 2.2 Light-mode overrides

Hex's homepage renders a light variant. When building light surfaces, swap these values:

```css
[data-theme="light"] {
  --hex-color-background:    var(--hex-opal);       /* #FBF9F9 */
  --hex-color-surface:       #FFFFFF;
  --hex-color-text-default:  var(--hex-eggplant);   /* #31263B */
  --hex-color-text-muted:    #43394C;
  --hex-color-text-loud:     var(--hex-black);
  --hex-color-link:          var(--hex-eggplant);
}
```

### 2.3 Usage guidance

| Context               | Variable                      | Value (dark)   |
|------------------------|-------------------------------|----------------|
| Page background        | `--hex-color-background`      | `#14141C`      |
| Card / panel surface   | `--hex-color-surface`         | `#111118`      |
| Default body text      | `--hex-color-text-default`    | `#F5C0C0`      |
| Secondary / meta text  | `--hex-color-text-muted`      | `#99797D`      |
| Headlines, emphasis    | `--hex-color-text-loud`       | `#FFFFFF`      |
| Interactive links      | `--hex-color-link`            | `#E3B2B3`      |
| Primary CTA highlight  | `--hex-color-primary`         | `#F5C0C0`      |
| Dividers, subtle lines | `--hex-grid-400`              | `#312A31`      |
| Hover / active states  | `--hex-fgA-700`               | `rgba(245,192,192,0.172)` |

---

## 3. Typography

### 3.1 Font Families

Hex uses four typeface families, each with a specific role:

```css
:root {
  /* Display headlines — geometric, semi-extended, high-impact */
  --hex-font-display: "PP Formula SemiExtended", ui-sans-serif, system-ui, sans-serif;

  /* Sub-headlines and UI headings — tighter cut of same family */
  --hex-font-heading: "PP Formula", ui-sans-serif, system-ui, sans-serif;

  /* Body copy, UI text, buttons, nav — clean geometric sans */
  --hex-font-body: "Cinetype", ui-sans-serif, system-ui, sans-serif;

  /* Long-form paragraphs, blog, docs — humanist workhorse */
  --hex-font-paragraph: "IBM Plex Sans", sans-serif;

  /* Code, data, monospaced contexts */
  --hex-font-mono: "Cinetype Mono", ui-monospace, monospace;

  /* Editorial accent — pull-quotes, testimonials, italic flourishes */
  --hex-font-editorial: "PP Editorial New", serif;
}
```

### 3.2 Font Files (self-hosted)

| Family                   | Weight | Style  | File                                        |
|--------------------------|--------|--------|---------------------------------------------|
| PP Formula SemiExtended  | 600    | normal | `/fonts/formula/PP-Formula-SemiExtendedBold.woff2`  |
| PP Formula               | 700    | normal | `/fonts/formula/PP-Formula-ExtraBold.woff2`         |
| PP Formula               | 500    | normal | `/fonts/formula/PP-Formula-SemiBold.woff2`          |
| GT Cinetype              | 300    | normal | `/fonts/cinetype/GT-Cinetype-Light.woff2`           |
| GT Cinetype              | 400    | normal | `/fonts/cinetype/GT-Cinetype-Regular.woff2`         |
| GT Cinetype              | 600    | normal | `/fonts/cinetype/GT-Cinetype-Bold.woff2`            |
| GT Cinetype Mono         | 400    | normal | `/fonts/cinetype/GT-Cinetype-Mono.woff2`            |
| PP Editorial New         | 400    | normal | `/fonts/editorial/PPEditorialNew-Regular.woff2`     |
| PP Editorial New         | 200    | italic | `/fonts/editorial/PPEditorialNew-UltralightItalic.woff2` |

### 3.3 Type Scale

```css
:root {
  /* ── Size Scale ── */
  --hex-text-xs:    14px;    /* Nav links, meta, small labels       */
  --hex-text-sm:    16px;    /* Body small, pricing copy, list items */
  --hex-text-base:  18px;    /* Default body / paragraph             */
  --hex-text-md:    20px;    /* Sub-headings (h4), feature labels    */
  --hex-text-lg:    24px;    /* Lead paragraph, large body           */
  --hex-text-xl:    28px;    /* Section headings (h3)                */
  --hex-text-2xl:   40px;    /* Page sub-headings (h2)               */
  --hex-text-3xl:   60px;    /* Hero headlines (h1)                  */
  --hex-text-4xl:   74px;    /* Impact headlines (customers page)    */

  /* ── Line Heights ── */
  --hex-leading-tight:    1.3;     /* Headlines — 60→78, 40→52, 28→36.4   */
  --hex-leading-normal:   1.5;     /* Body text — 24→36, 18→27             */
  --hex-leading-snug:     1.4;     /* UI text, labels — 16→22.4            */
  --hex-leading-relaxed:  1.78;    /* Long-form paragraphs — 18→32         */

  /* ── Letter Spacing ── */
  --hex-tracking-tight:   -1.85px; /* Display headlines (h1)               */
  --hex-tracking-normal:  0;       /* Body and UI text                     */

  /* ── Font Weights ── */
  --hex-weight-ultralight: 200;    /* Editorial italic accent              */
  --hex-weight-light:      300;    /* Body text (Cinetype Light)           */
  --hex-weight-regular:    400;    /* UI text, nav, buttons                */
  --hex-weight-medium:     500;    /* PP Formula SemiBold                  */
  --hex-weight-semibold:   600;    /* Sub-headings, card titles            */
  --hex-weight-bold:       700;    /* Display headlines (h1)               */
  --hex-weight-extrabold:  800;    /* Section headings (h2, h3)            */
}
```

### 3.4 Type Style Map

| Element          | Font Stack              | Size               | Weight    | Line-Height        | Letter-Spacing      |
|------------------|-------------------------|---------------------|-----------|--------------------|---------------------|
| Hero headline    | `--hex-font-display`    | `--hex-text-3xl`    | 700       | `--hex-leading-tight` | `--hex-tracking-tight` |
| Page heading     | `--hex-font-heading`    | `--hex-text-2xl`    | 800       | `--hex-leading-tight` | `--hex-tracking-normal` |
| Section heading  | `--hex-font-heading`    | `--hex-text-xl`     | 800       | `--hex-leading-tight` | `--hex-tracking-normal` |
| Card title       | `--hex-font-heading`    | `--hex-text-md`     | 600       | `--hex-leading-tight` | `--hex-tracking-normal` |
| Lead body        | `--hex-font-body`       | `--hex-text-lg`     | 300       | `--hex-leading-normal` | `--hex-tracking-normal` |
| Body             | `--hex-font-body`       | `--hex-text-base`   | 400       | `--hex-leading-relaxed` | `--hex-tracking-normal` |
| Long-form / blog | `--hex-font-paragraph`  | `--hex-text-base`   | 400       | `--hex-leading-relaxed` | `--hex-tracking-normal` |
| Nav / UI         | `--hex-font-body`       | `--hex-text-xs`     | 400       | `--hex-leading-snug` | `--hex-tracking-normal` |
| Button text      | `--hex-font-body`       | `--hex-text-xs`     | 400       | 1.0                | `--hex-tracking-normal` |
| Pull-quote       | `--hex-font-editorial`  | `38px`              | 200       | 1.2                | `--hex-tracking-normal` |
| Code / data      | `--hex-font-mono`       | `--hex-text-xs`     | 400       | `--hex-leading-snug` | `--hex-tracking-normal` |

---

## 4. Borders and Shadows

### 4.1 CSS Custom Properties

```css
:root {
  /* ── Border Radius ── */
  --hex-radius-none:   0px;     /* Primary buttons, hero CTAs            */
  --hex-radius-xs:     1px;     /* Default button corners                */
  --hex-radius-sm:     2px;     /* Base component radius (Hex default)   */
  --hex-radius-md:     3px;     /* Cards on light backgrounds            */
  --hex-radius-lg:     7px;     /* Input fields, form elements           */
  --hex-radius-full:   9999px;  /* Pills, tags (use sparingly)           */

  /* ── Border Colors ── */
  --hex-border-subtle:    var(--hex-grid-300);    /* #2B252C — barely visible lines  */
  --hex-border-default:   var(--hex-grid-400);    /* #312A31 — standard dividers     */
  --hex-border-strong:    var(--hex-grid-600);    /* #4C3E44 — emphasized borders    */
  --hex-border-highlight: var(--hex-grid-1200);   /* #E3B2B3 — active / focus ring   */

  /* ── Border Shorthand ── */
  --hex-border-default-style: 1px solid var(--hex-border-default);
  --hex-border-subtle-style:  1px solid var(--hex-border-subtle);

  /* ── Shadows ── */
  --hex-shadow-none:      none;
  --hex-shadow-inset:     rgb(255, 255, 255) 0px 0px 0px 1px inset;   /* Input focus ring        */
  --hex-shadow-card:      0 1px 3px rgba(0, 0, 0, 0.3);               /* Subtle card lift        */
  --hex-shadow-elevated:  0 4px 16px rgba(0, 0, 0, 0.4);              /* Modals, dropdowns       */
  --hex-shadow-glow:      0 0 20px rgba(245, 192, 192, 0.15);         /* Rose quartz glow accent */

  /* ── Paper Texture Overlay ── */
  --hex-texture-image:      url('/images/bkg-noise.webp');
  --hex-texture-size:       200px 200px;
  --hex-texture-blend:      normal;
  --hex-texture-opacity:    0.0625;
}
```

### 4.2 Usage guidance

| Context                  | Radius                | Shadow                  | Border                        |
|--------------------------|-----------------------|-------------------------|-------------------------------|
| Primary CTA button       | `--hex-radius-none`   | `--hex-shadow-none`     | none                          |
| Secondary button         | `--hex-radius-xs`     | `--hex-shadow-none`     | `--hex-border-default-style`  |
| Input field              | `--hex-radius-lg`     | `--hex-shadow-inset`    | none (uses inset shadow)      |
| Card                     | `--hex-radius-sm`     | `--hex-shadow-card`     | `--hex-border-subtle-style`   |
| Modal / dropdown         | `--hex-radius-sm`     | `--hex-shadow-elevated` | none                          |
| Focused element          | inherits              | ring only               | `2px solid var(--hex-border-highlight)` |
| Divider line             | —                     | —                       | `1px solid var(--hex-grid-400)` |

### 4.3 Paper texture mixin

Apply to any dark surface to match Hex's tactile aesthetic:

```css
.hex-surface-textured {
  position: relative;
}
.hex-surface-textured::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--hex-texture-image);
  background-size: var(--hex-texture-size);
  mix-blend-mode: var(--hex-texture-blend);
  opacity: var(--hex-texture-opacity);
  pointer-events: none;
  z-index: 1;
}
```

---

## 5. Component Examples

### 5.1 Buttons

```css
/* ── Primary CTA ── */
.hex-btn-primary {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-xs);
  font-weight: var(--hex-weight-regular);
  line-height: 1;
  color: var(--hex-color-text-loud);
  background: var(--hex-rose-quartz);
  border: none;
  border-radius: var(--hex-radius-none);
  padding: 12px 24px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.hex-btn-primary:hover {
  opacity: 0.85;
}

/* ── Secondary / Ghost ── */
.hex-btn-secondary {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-xs);
  font-weight: var(--hex-weight-regular);
  line-height: 1;
  color: var(--hex-color-text-default);
  background: transparent;
  border: 1px solid var(--hex-border-default);
  border-radius: var(--hex-radius-xs);
  padding: 12px 24px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.hex-btn-secondary:hover {
  border-color: var(--hex-border-highlight);
  color: var(--hex-color-text-loud);
}
```

### 5.2 Input Fields

```css
.hex-input {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-sm);
  font-weight: var(--hex-weight-regular);
  color: var(--hex-color-text-loud);
  background: transparent;
  border: none;
  border-radius: var(--hex-radius-lg);
  padding: 12px 16px;
  box-shadow: var(--hex-shadow-inset);
  outline: none;
  transition: box-shadow 0.15s ease;
}
.hex-input:focus {
  box-shadow: 0 0 0 2px var(--hex-border-highlight);
}
.hex-input::placeholder {
  color: var(--hex-color-text-muted);
}
```

### 5.3 Cards

```css
.hex-card {
  background: var(--hex-color-surface);
  border: 1px solid var(--hex-border-subtle);
  border-radius: var(--hex-radius-sm);
  padding: 24px;
  position: relative;                /* for texture pseudo-element */
}
.hex-card__title {
  font-family: var(--hex-font-heading);
  font-size: var(--hex-text-md);
  font-weight: var(--hex-weight-semibold);
  color: var(--hex-color-text-loud);
  margin: 0 0 8px;
}
.hex-card__body {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-sm);
  font-weight: var(--hex-weight-light);
  color: var(--hex-color-text-default);
  line-height: var(--hex-leading-normal);
}
```

### 5.4 Navigation Link

```css
.hex-nav-link {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-xs);
  font-weight: var(--hex-weight-regular);
  color: var(--hex-color-text-default);
  text-decoration: none;
  line-height: 1.57;
  transition: color 0.15s ease;
}
.hex-nav-link:hover {
  color: var(--hex-color-text-loud);
}
```

### 5.5 Badge / Tag

```css
.hex-badge {
  font-family: var(--hex-font-mono);
  font-size: 12px;
  font-weight: var(--hex-weight-regular);
  color: var(--hex-color-accent);
  background: var(--hex-fgA-500);
  border-radius: var(--hex-radius-sm);
  padding: 4px 8px;
  display: inline-block;
}
```

---

## 6. Layout Patterns

### 6.1 Spacing System

Hex's spacing is based on a **4px base unit**. Use multiples of 4:

```css
:root {
  --hex-space-1:   4px;     /* Tight inner gaps, icon-to-text    */
  --hex-space-2:   8px;     /* Small component padding           */
  --hex-space-3:   12px;    /* Button padding, list gaps         */
  --hex-space-4:   16px;    /* Default component padding         */
  --hex-space-6:   24px;    /* Card padding, section inner gap   */
  --hex-space-8:   32px;    /* Between components                */
  --hex-space-10:  40px;    /* Section padding                   */
  --hex-space-12:  48px;    /* Large section breaks              */
  --hex-space-16:  64px;    /* Hero-level vertical spacing       */
  --hex-space-20:  80px;    /* Major section separators          */
  --hex-space-24:  96px;    /* Page-level vertical rhythm        */
}
```

### 6.2 Page structure

```
┌──────────────────────────────────────────────┐
│  Nav (sticky, bg transparent → obsidian)     │   --hex-text-xs, Cinetype
│  14px · Cinetype · weight 400 · rose quartz  │
├──────────────────────────────────────────────┤
│                                              │
│  Hero Section                                │   --hex-space-16 vertical
│  H1: PP Formula SemiExtended · 60px · 700    │   padding
│  Subhead: Cinetype · 24px · 300              │
│  CTA: 14px · square corners                  │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  Content Sections                            │   --hex-space-20 between
│  H2: PP Formula · 40px · 800                 │   sections
│  H3: PP Formula · 28px · 800                 │
│  Body: Cinetype 18–24px · 300–400            │
│  Long-form: IBM Plex Sans · 18px · 400       │
│                                              │
├──────────────────────────────────────────────┤
│  Footer                                      │   obsidian bg
│  14px · Cinetype · muted text                │   grid-400 top border
└──────────────────────────────────────────────┘
```

### 6.3 Responsive breakpoint guidance

Hex's marketing site is designed at **1440px** max-width with these observed patterns:

| Breakpoint     | Behavior                                           |
|----------------|----------------------------------------------------|
| ≥ 1440px       | Max-width container, centered                      |
| 1024–1439px    | Fluid grid, same layout                            |
| 768–1023px     | Stack multi-column sections, reduce heading sizes   |
| < 768px        | Single column, H1 drops to ~36–40px                |

---

## 7. Do's and Don'ts

### ✅ DO

- **Use the foreground scale** (`--hex-fg-*`) for layering surfaces. A card on obsidian should use `--hex-fg-200` or `--hex-fg-300`, not an arbitrary gray.
- **Use the alpha scale** (`--hex-fgA-*`) for hover states and overlays. Example: `--hex-fgA-700` for a subtle hover background shift.
- **Keep border-radius tight.** `1px`–`7px` maximum for all components. Inputs at `7px` is the ceiling.
- **Apply the paper texture** to dark surfaces using the pseudo-element mixin. It's what makes Hex feel like Hex.
- **Pair PP Formula with Cinetype.** Headlines in Formula, body in Cinetype. This is the core brand contrast.
- **Use muted rose** (`--hex-color-text-default: #F5C0C0`) as your default text color on dark backgrounds. White (`--hex-color-text-loud`) is reserved for emphasis only.
- **Use IBM Plex Sans** for long-form reading contexts (blog posts, documentation, multi-paragraph descriptions).
- **Use PP Editorial New Ultralight Italic** sparingly for pull-quotes and testimonial callouts (like on the customers page).

### ❌ DON'T

- **Don't use saturated colors.** No `#FF0000`, `#00FF00`, or `#0066FF`. Hex's palette is warm and muted — everything runs through the gemstone filter.
- **Don't use large border-radius.** No `16px`, `20px`, or fully-rounded corners on cards or buttons. This breaks the sharp, editorial aesthetic.
- **Don't set body text to white.** `#FFFFFF` is reserved for headlines and high-emphasis labels. Default body uses `#F5C0C0` (rose quartz).
- **Don't mix font families randomly.** Each family has a specific role (see §3.4). Don't use PP Formula for body text or Cinetype for display headlines.
- **Don't use pure black backgrounds.** The background is `#14141C` (obsidian) — a very dark purple-blue — not `#000000`.
- **Don't skip the texture.** On large dark surfaces, the paper noise overlay is what prevents the UI from feeling flat and screen-like.
- **Don't use heavy drop shadows.** Hex's elevation model is subtle. Prefer border-based separation (`--hex-grid-*`) over heavy box-shadows.
- **Don't use `font-weight: 700` for body text.** Cinetype is used at `300` (light) and `400` (regular). Bold is reserved for headings.

---

## 8. Quick-Reference Variables

Copy this block into any project to get started. All variables in one place:

```css
:root {
  /* ── COLORS ── */
  --hex-black:             #01011B;
  --hex-white:             #FFFFFF;
  --hex-obsidian:          #14141C;
  --hex-rose-quartz:       #F5C0C0;
  --hex-amethyst:          #A477B2;
  --hex-minsk:             #473982;
  --hex-eggplant:          #31263B;
  --hex-jade:              #5CB198;
  --hex-citrine:           #CDA849;
  --hex-opal:              #FBF9F9;
  --hex-violet-topaz:      #5F509D;
  --hex-cement:            #717A94;
  --hex-accent:            #E3B2B3;
  --hex-text-muted-color:  #99797D;
  --hex-success:           #8DC572;
  --hex-error:             #BE6464;
  --hex-warning:           #F0AD4E;
  --hex-info:              #337AB7;

  /* ── FOREGROUND SCALE ── */
  --hex-fg-100: #14141C;  --hex-fg-200: #191820;  --hex-fg-300: #201D25;
  --hex-fg-400: #252128;  --hex-fg-500: #2B252C;  --hex-fg-600: #312A31;
  --hex-fg-700: #3A3138;  --hex-fg-800: #4C3E44;  --hex-fg-900: #6A565B;
  --hex-fg-1000: #786065; --hex-fg-1100: #99797D; --hex-fg-1200: #E3B2B3;

  /* ── FOREGROUND ALPHA ── */
  --hex-fgA-100: rgba(245,192,192,0);       --hex-fgA-200: rgba(245,192,192,0.026);
  --hex-fgA-300: rgba(245,192,192,0.056);   --hex-fgA-400: rgba(245,192,192,0.077);
  --hex-fgA-500: rgba(245,192,192,0.103);   --hex-fgA-600: rgba(245,192,192,0.129);
  --hex-fgA-700: rgba(245,192,192,0.172);   --hex-fgA-800: rgba(245,192,192,0.249);
  --hex-fgA-900: rgba(245,192,192,0.386);   --hex-fgA-1000: rgba(245,192,192,0.446);
  --hex-fgA-1100: rgba(245,192,192,0.592);  --hex-fgA-1200: rgba(245,192,192,0.923);

  /* ── BACKGROUNDS ── */
  --hex-bg-300: #0F0F15;  --hex-bg-400: #111118;  --hex-bg-500: #14141C;

  /* ── GRID / BORDERS ── */
  --hex-grid-200: #252128;  --hex-grid-300: #2B252C;  --hex-grid-400: #312A31;
  --hex-grid-500: #3A3138;  --hex-grid-600: #4C3E44;  --hex-grid-700: #6A565B;
  --hex-grid-1200: #E3B2B3;

  /* ── TYPOGRAPHY ── */
  --hex-font-display:    "PP Formula SemiExtended", ui-sans-serif, system-ui, sans-serif;
  --hex-font-heading:    "PP Formula", ui-sans-serif, system-ui, sans-serif;
  --hex-font-body:       "Cinetype", ui-sans-serif, system-ui, sans-serif;
  --hex-font-paragraph:  "IBM Plex Sans", sans-serif;
  --hex-font-mono:       "Cinetype Mono", ui-monospace, monospace;
  --hex-font-editorial:  "PP Editorial New", serif;

  --hex-text-xs: 14px;  --hex-text-sm: 16px;  --hex-text-base: 18px;
  --hex-text-md: 20px;  --hex-text-lg: 24px;  --hex-text-xl:  28px;
  --hex-text-2xl: 40px; --hex-text-3xl: 60px; --hex-text-4xl: 74px;

  --hex-leading-tight: 1.3;  --hex-leading-snug: 1.4;
  --hex-leading-normal: 1.5; --hex-leading-relaxed: 1.78;

  --hex-tracking-tight: -1.85px;  --hex-tracking-normal: 0;

  --hex-weight-ultralight: 200; --hex-weight-light: 300;
  --hex-weight-regular: 400;    --hex-weight-medium: 500;
  --hex-weight-semibold: 600;   --hex-weight-bold: 700;
  --hex-weight-extrabold: 800;

  /* ── SPACING (4px base) ── */
  --hex-space-1: 4px;   --hex-space-2: 8px;   --hex-space-3: 12px;
  --hex-space-4: 16px;  --hex-space-6: 24px;  --hex-space-8: 32px;
  --hex-space-10: 40px; --hex-space-12: 48px; --hex-space-16: 64px;
  --hex-space-20: 80px; --hex-space-24: 96px;

  /* ── BORDERS ── */
  --hex-radius-none: 0px;   --hex-radius-xs: 1px;   --hex-radius-sm: 2px;
  --hex-radius-md: 3px;     --hex-radius-lg: 7px;   --hex-radius-full: 9999px;

  /* ── SHADOWS ── */
  --hex-shadow-none:     none;
  --hex-shadow-inset:    rgb(255,255,255) 0px 0px 0px 1px inset;
  --hex-shadow-card:     0 1px 3px rgba(0,0,0,0.3);
  --hex-shadow-elevated: 0 4px 16px rgba(0,0,0,0.4);
  --hex-shadow-glow:     0 0 20px rgba(245,192,192,0.15);

  /* ── TEXTURE ── */
  --hex-texture-image:   url('/images/bkg-noise.webp');
  --hex-texture-size:    200px 200px;
  --hex-texture-blend:   normal;
  --hex-texture-opacity: 0.0625;

  /* ── TRANSITIONS ── */
  --hex-transition-fast: 0.15s ease;
  --hex-transition-base: 0.2s ease;
}
```

---

## 9. Complete Component Example

A full pricing card built entirely from Hex tokens — copy-paste ready:

```html
<div class="hex-pricing-card">
  <div class="hex-pricing-card__header">
    <span class="hex-pricing-card__badge">Most popular</span>
    <h3 class="hex-pricing-card__title">Team</h3>
    <p class="hex-pricing-card__price">
      <span class="hex-pricing-card__amount">$75</span>
      <span class="hex-pricing-card__period">per Editor / month</span>
    </p>
  </div>
  <div class="hex-pricing-card__body">
    <p class="hex-pricing-card__description">
      For companies collaborating with data and automating manual work.
    </p>
    <ul class="hex-pricing-card__features">
      <li>Threads agent</li>
      <li>Semantic model agent</li>
      <li>Extended credits</li>
      <li>Unlimited published apps</li>
      <li>Scheduled runs and alerts</li>
    </ul>
  </div>
  <div class="hex-pricing-card__footer">
    <button class="hex-btn-primary hex-pricing-card__cta">Try 14 days free</button>
  </div>
</div>
```

```css
/* ── Pricing Card ── */
.hex-pricing-card {
  background: var(--hex-bg-400);
  border: 1px solid var(--hex-grid-400);
  border-radius: var(--hex-radius-sm);
  padding: var(--hex-space-8) var(--hex-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--hex-space-6);
  max-width: 340px;
  position: relative;
  overflow: hidden;
}

/* Paper texture */
.hex-pricing-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--hex-texture-image);
  background-size: var(--hex-texture-size);
  mix-blend-mode: var(--hex-texture-blend);
  opacity: var(--hex-texture-opacity);
  pointer-events: none;
  z-index: 0;
}

/* All inner content above texture */
.hex-pricing-card > * {
  position: relative;
  z-index: 1;
}

.hex-pricing-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--hex-space-2);
}

.hex-pricing-card__badge {
  font-family: var(--hex-font-mono);
  font-size: 12px;
  font-weight: var(--hex-weight-regular);
  color: var(--hex-jade);
  background: rgba(92, 177, 152, 0.12);
  border-radius: var(--hex-radius-sm);
  padding: var(--hex-space-1) var(--hex-space-2);
  width: fit-content;
}

.hex-pricing-card__title {
  font-family: var(--hex-font-heading);
  font-size: var(--hex-text-xl);
  font-weight: var(--hex-weight-extrabold);
  color: var(--hex-white);
  margin: 0;
  line-height: var(--hex-leading-tight);
}

.hex-pricing-card__price {
  margin: var(--hex-space-2) 0 0;
  display: flex;
  align-items: baseline;
  gap: var(--hex-space-2);
}

.hex-pricing-card__amount {
  font-family: var(--hex-font-display);
  font-size: var(--hex-text-2xl);
  font-weight: var(--hex-weight-bold);
  color: var(--hex-white);
  line-height: 1;
}

.hex-pricing-card__period {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-xs);
  color: var(--hex-text-muted-color);
}

.hex-pricing-card__description {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-sm);
  font-weight: var(--hex-weight-light);
  color: var(--hex-rose-quartz);
  line-height: var(--hex-leading-normal);
  margin: 0;
}

.hex-pricing-card__features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--hex-space-3);
}

.hex-pricing-card__features li {
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-xs);
  font-weight: var(--hex-weight-regular);
  color: var(--hex-accent);
  padding-left: var(--hex-space-4);
  position: relative;
}

.hex-pricing-card__features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--hex-jade);
  font-size: 13px;
}

.hex-pricing-card__footer {
  margin-top: auto;
}

.hex-pricing-card__cta {
  width: 100%;
  font-family: var(--hex-font-body);
  font-size: var(--hex-text-xs);
  font-weight: var(--hex-weight-regular);
  line-height: 1;
  color: var(--hex-obsidian);
  background: var(--hex-rose-quartz);
  border: none;
  border-radius: var(--hex-radius-none);
  padding: var(--hex-space-3) var(--hex-space-6);
  cursor: pointer;
  transition: opacity var(--hex-transition-fast);
}

.hex-pricing-card__cta:hover {
  opacity: 0.85;
}

/* ── Highlight variant (featured card) ── */
.hex-pricing-card--featured {
  border-color: var(--hex-grid-1200);
  box-shadow: var(--hex-shadow-glow);
}
```

---

*This design system was auto-extracted from hex.tech using Firecrawl branding data and in-browser CSS analysis. Token values reflect the live site as of April 2026. Custom fonts (PP Formula, GT Cinetype, PP Editorial New) are licensed typefaces — substitute with system fonts or license them for production use.*
