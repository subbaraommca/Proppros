# Bespoke Design System

> **Neobrutalism-rooted, editorial design language for bespoke product configurators.**
> Built for any coding agent — paste this file into context and start building.

---

## 1. Core Principles

### Design Philosophy
Bespoke follows a **Neobrutalist Editorial** aesthetic — heavy borders, flat bold color, noise texture, and confident typography. Every surface feels printed, tactile, and intentional.

### The Five Rules

1. **Stroke is structure.** Every interactive or container element gets a visible border. No invisible boxes.
2. **Color is categorical.** Each accent color maps to a meaning — blue for primary/active, pink for accent/danger, yellow for material/highlight. They are never decorative-only.
3. **Noise is texture.** A full-viewport SVG noise overlay (`mix-blend-mode: multiply`) sits on top of everything at low opacity. This is non-negotiable — it unifies the entire visual language.
4. **Glass is hierarchy.** Panels that float over the canvas use `backdrop-filter: blur()` with a semi-transparent cream background. This separates control surfaces from content.
5. **Brutal but usable.** Heavy strokes and bold shapes, but pill-radius buttons, generous spacing, and clear typographic hierarchy keep things approachable.

---

## 2. Color Palette

### Semantic Color Tokens

```css
:root {
  /* --- Surface --- */
  --c-cream:       #f4ecd8;   /* Primary background, card fills, button faces        */
  --c-bg:          #f0e6cf;   /* Page/body background — slightly darker than cream    */

  /* --- Ink --- */
  --c-ink:         #0b0b0b;   /* Text, borders, heavy strokes, dark fills             */

  /* --- Accents --- */
  --c-blue:        #1a4ee8;   /* Active states, selected segments, primary action      */
  --c-pink:        #f43b86;   /* Accent, tags, danger/exit, pulsing status indicators  */
  --c-yellow:      #ffb71b;   /* Material swatches, highlight, secondary tags          */
}
```

### Usage Rules

| Token        | Use For                                                  | Never Use For                     |
|--------------|----------------------------------------------------------|-----------------------------------|
| `--c-cream`  | Panel backgrounds, button faces, slider thumbs           | Body background (use `--c-bg`)    |
| `--c-bg`     | Page `body` background only                              | Component fills                   |
| `--c-ink`    | All text, all borders, art lines, dark fills             | Tinted backgrounds                |
| `--c-blue`   | Active/selected segment, primary CTA hover highlight     | Body text                         |
| `--c-pink`   | Status dots, exit/danger actions, accent tags            | Large background fills            |
| `--c-yellow` | Material swatches, highlight tags, warm accents          | Text color (low contrast on cream)|

### Transparency Variants
When layering panels over canvas content, use these alpha values:

```css
/* Frosted glass panel */
background: rgba(244, 236, 216, 0.6);   /* 60% cream — sidebar panels     */
background: rgba(244, 236, 216, 0.7);   /* 70% cream — floating overlays  */
background: rgba(255, 255, 255, 0.2);   /* 20% white — inset containers   */
background: rgba(255, 255, 255, 0.4);   /* 40% white — option cards       */
```

---

## 3. Typography

### Font Stack

```css
:root {
  --font-main: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

**Space Grotesk** is the only typeface. Import it from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
```

### Type Scale

| Role              | Size         | Weight | Letter Spacing | Transform     | Example Usage                   |
|-------------------|-------------|--------|----------------|---------------|---------------------------------|
| Display Title     | `5rem`      | 700    | `-0.04em`      | none          | Onboarding headlines            |
| Page Title (h1)   | `2.5rem`    | 700    | `-0.04em`      | none          | Gallery page header             |
| Panel Title (h1)  | `1.5rem`    | 700    | `-0.03em`      | none          | Sidebar/overlay branding        |
| Section Head (h2) | `1rem`      | 700    | `0.05em`       | `uppercase`   | Control group labels            |
| Section Head (h2) | `0.85rem`   | 700    | `0.05em`       | `uppercase`   | Compact control group labels    |
| Body              | `0.875rem`  | 400    | normal         | none          | Default paragraph text          |
| Label             | `0.75rem`   | 500    | normal         | `lowercase`   | Input labels, meta text         |
| Micro Label       | `0.7rem`    | 700    | normal         | `uppercase`   | Segment buttons, slider headers |
| Tag               | `0.65rem`   | 700    | normal         | `uppercase`   | Category pills                  |
| Watermark         | `0.75rem`   | 700    | `0.2em`        | `uppercase`   | Fixed position system labels    |
| Status Badge      | `0.75rem`   | 700    | `0.1em`        | `uppercase`   | Top-left status indicators      |

### Key Patterns
- **Branding rows** always pair an `h1` with a `label-text` subtitle underneath, separated by a `--stroke-medium` bottom border.
- **Section headings** inside control groups are always uppercase with `0.05em` tracking.
- **Watermarks** are fixed-position, uppercase, wide-tracked labels anchored to corners.

---

## 4. Borders & Shadows

### Stroke Tokens

```css
:root {
  --stroke-heavy:  3px solid var(--c-ink);   /* Cards, panels, primary shapes, outer containers  */
  --stroke-medium: 2px solid var(--c-ink);   /* Inputs, swatches, segment dividers, inner borders */
}
```

### When to Use Which

| Element                        | Stroke          |
|--------------------------------|-----------------|
| Panel outer border             | `--stroke-heavy`  |
| Card outer border              | `--stroke-heavy`  |
| Shape outlines (art elements)  | `--stroke-heavy`  |
| Tool/action buttons            | `--stroke-heavy`  |
| Segmented control outer        | `--stroke-medium` |
| Segment dividers               | `--stroke-medium` |
| Swatch borders                 | `--stroke-medium` |
| Slider track (art line)        | `--stroke-medium` |
| Branding row bottom border     | `--stroke-medium` |
| Blueprint dashed lines         | `1px dashed var(--c-ink)` |

### Radius Tokens

```css
:root {
  --radius-sm:   4px;    /* Option cards, swatches, texture buttons     */
  --radius-pill: 999px;  /* CTAs, segmented controls, tags, toolbar     */
}
```

**Rule:** Interactive buttons and navigation elements use `--radius-pill`. Content containers and swatches use `--radius-sm` or no radius at all (sharp corners).

### Shadows

Shadows are used sparingly and only on elevated panels:

```css
/* Floating overlay panel */
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);    /* Standard panel       */
box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);    /* Wide configurator    */
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);     /* Floating toolbar     */

/* Card hover state — neobrutalist offset shadow */
box-shadow: 12px 12px 0px var(--c-ink);          /* Hard offset, no blur */
```

**The card hover shadow is key to the brand.** It's a hard black offset with zero blur — classic neobrutalism.

---

## 5. Component Examples

### Segmented Control

```css
.segmented-control {
  display: flex;
  border: var(--stroke-medium);
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.2);
}

.segment-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px 4px;
  font-family: var(--font-main);
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
}

.segment-btn.active {
  background-color: var(--c-blue);
  color: white;
}

.segment-btn:not(:last-child) {
  border-right: var(--stroke-medium);
}
```

### Range Slider

```css
input[type="range"] {
  -webkit-appearance: none;
  background: transparent;
  width: 100%;
}

input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--c-ink);
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 20px;
  width: 12px;
  background: var(--c-cream);
  border: var(--stroke-medium);
  margin-top: -8px;
  cursor: ew-resize;
}
```

### Swatch Grid

```css
.swatch-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.swatch {
  aspect-ratio: 1;
  border: var(--stroke-medium);
  border-radius: 4px;
  cursor: pointer;
}

.swatch.active {
  box-shadow: 0 0 0 2px var(--c-blue);
}
```

### Tag / Pill

```css
.tag {
  display: inline-block;
  padding: 2px 10px;
  border: var(--stroke-medium);
  border-radius: var(--radius-pill);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  background: transparent;
}

/* Semantic variants */
.tag-primary  { background-color: var(--c-blue);   color: white;         }
.tag-accent   { background-color: var(--c-pink);   color: white;         }
.tag-highlight { background-color: var(--c-yellow); color: var(--c-ink); }
```

### Primary Button (CTA)

```css
.btn-primary {
  background: var(--c-ink);
  color: var(--c-cream);
  border: none;
  padding: 1rem 2rem;
  font-family: var(--font-main);
  font-weight: 700;
  font-size: 0.85rem;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: transform 0.2s ease;
}

.btn-primary:hover {
  transform: scale(1.05);
}
```

### Icon / Tool Button

```css
.tool-btn {
  width: 50px;
  height: 50px;
  border: var(--stroke-heavy);
  background: var(--c-cream);
  border-radius: 50%;
  font-family: var(--font-main);
  font-weight: 700;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.tool-btn:hover {
  background: var(--c-ink);
  color: var(--c-cream);
}
```

### Project Card

```css
.project-card {
  background: rgba(244, 236, 216, 0.4);
  backdrop-filter: blur(8px);
  border: var(--stroke-heavy);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-card:hover {
  transform: translateY(-8px);
  box-shadow: 12px 12px 0px var(--c-ink);
}

.card-preview {
  height: 240px;
  background: #e8dfc7;
  border-bottom: var(--stroke-medium);
  position: relative;
  overflow: hidden;
}

.card-info {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

---

## 6. Layout Patterns

### Spacing Scale

```css
:root {
  --space-1: 0.5rem;   /*  8px — tight gaps (swatch grid, inline spacing)    */
  --space-2: 1rem;     /* 16px — card padding, control group gaps             */
  --space-3: 1.5rem;   /* 24px — section gaps, panel internal spacing         */
  --space-4: 2rem;     /* 32px — page padding, major section separation       */
}
```

### Pattern A — Sidebar + Canvas (Materials View)

```
┌──────────────┬──────────────────────────────────┐
│              │                                  │
│   Sidebar    │          Main Canvas             │
│   340px      │          1fr                     │
│   fixed      │                                  │
│              │        [Preview Stage]           │
│  • Controls  │                                  │
│  • Swatches  │                                  │
│  • CTA       │                                  │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

```css
.view-container {
  display: grid;
  grid-template-columns: 340px 1fr;
  height: 100vh;
}
```

### Pattern B — Floating Overlay + Canvas (Configurator)

```
┌─────────────────────────────────────────────────┐
│ ┌────────────────┐                              │
│ │ Overlay Panel  │        Full Canvas           │
│ │ 340–580px      │        (shapes, lines)       │
│ │ position:abs   │                              │
│ │ top:40 left:40 │                              │
│ │                │                              │
│ └────────────────┘                              │
│                                     [⟳] [+] [-] │
└─────────────────────────────────────────────────┘
```

```css
.overlay-controls {
  position: absolute;
  top: 40px;
  left: 40px;
  width: 340px;              /* or up to 580px for wide variant */
  max-height: calc(100vh - 80px);
  background: rgba(244, 236, 216, 0.6);
  backdrop-filter: blur(16px);
  border: var(--stroke-heavy);
  padding: var(--space-4);
  z-index: 50;
  overflow-y: auto;
}
```

### Pattern C — Centered Onboarding

```
┌─────────────────────────────────────────────────┐
│  Logo                                           │
│                                                 │
│              ┌─────────────────┐                │
│              │  Select a base  │                │
│              │  to begin.      │                │
│              │                 │                │
│              │ [Opt] [Opt] [Opt]│               │
│              │                 │                │
│              │  [ Start → ]   │                │
│              └─────────────────┘                │
│                                                 │
│  watermark                                      │
└─────────────────────────────────────────────────┘
```

```css
.onboarding-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
```

### Pattern D — Floating Bottom Toolbar (Presentation)

```css
.floating-toolbar {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(244, 236, 216, 0.7);
  backdrop-filter: blur(20px);
  border: var(--stroke-heavy);
  border-radius: var(--radius-pill);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 200;
}
```

### Pattern E — Project Grid (Gallery)

```css
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}
```

---

## 7. Do's and Don'ts

### DO ✓

- **DO** apply the noise overlay on every page. It's a brand signature.
- **DO** use `--stroke-heavy` on every card, panel, and outer container border.
- **DO** use `backdrop-filter: blur()` on any panel that floats over canvas content.
- **DO** use pill radius (`999px`) on all buttons and navigation elements.
- **DO** use hard offset shadows (`12px 12px 0px`) for card hover states — no blur.
- **DO** keep watermark labels in fixed corners (bottom-left or bottom-right).
- **DO** use the branding row pattern (h1 + label-text + bottom border) in every panel.
- **DO** make all shapes use `border: var(--stroke-heavy)` — even decorative blobs.
- **DO** pair slider controls with a header showing label + current value.
- **DO** use `cubic-bezier(0.16, 1, 0.3, 1)` or `cubic-bezier(0.23, 1, 0.32, 1)` for shape/blob transitions.

### DON'T ✗

- **DON'T** use drop shadows with blur on cards — only hard offset or panel elevation shadows.
- **DON'T** use rounded corners on cards or panels — those stay sharp (0 radius).
- **DON'T** add a second typeface. Space Grotesk handles everything.
- **DON'T** use `--c-yellow` as text color — it fails contrast on cream backgrounds.
- **DON'T** omit borders from interactive elements. If it's clickable, it has a stroke.
- **DON'T** use gradients. All fills are flat solid colors.
- **DON'T** make the noise overlay interactive (`pointer-events: none` always).
- **DON'T** use `overflow: auto` on the body — pages are either `overflow: hidden` (single-viewport apps) or `overflow-x: hidden` (scrollable galleries).
- **DON'T** put content above `z-index: 100` unless it's a toolbar or modal — the noise overlay lives at `z-index: 100`.
- **DON'T** skip the glass effect on floating panels. A solid cream panel without `backdrop-filter` breaks the layered depth model.

---

## 8. Quick-Reference Variables

Copy this entire block into the `:root` of any new page:

```css
:root {
  /* Colors */
  --c-cream:       #f4ecd8;
  --c-bg:          #f0e6cf;
  --c-ink:         #0b0b0b;
  --c-blue:        #1a4ee8;
  --c-pink:        #f43b86;
  --c-yellow:      #ffb71b;

  /* Borders */
  --stroke-heavy:  3px solid var(--c-ink);
  --stroke-medium: 2px solid var(--c-ink);

  /* Radius */
  --radius-sm:     4px;
  --radius-pill:   999px;

  /* Typography */
  --font-main:     'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Spacing */
  --space-1:       0.5rem;
  --space-2:       1rem;
  --space-3:       1.5rem;
  --space-4:       2rem;
}
```

### Noise Overlay (required on every page)

```css
body::before {
  content: "";
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  z-index: 100;
  opacity: 0.3;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}
```

### Reset (required on every page)

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-main);
  background-color: var(--c-bg);
  color: var(--c-ink);
}
```

---

## 9. Complete Component Example

A fully styled settings panel demonstrating all system patterns working together:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bespoke — Settings Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --c-cream:       #f4ecd8;
      --c-bg:          #f0e6cf;
      --c-ink:         #0b0b0b;
      --c-blue:        #1a4ee8;
      --c-pink:        #f43b86;
      --c-yellow:      #ffb71b;
      --stroke-heavy:  3px solid var(--c-ink);
      --stroke-medium: 2px solid var(--c-ink);
      --radius-sm:     4px;
      --radius-pill:   999px;
      --font-main:     'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      --space-1:       0.5rem;
      --space-2:       1rem;
      --space-3:       1.5rem;
      --space-4:       2rem;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-main);
      background-color: var(--c-bg);
      color: var(--c-ink);
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Noise overlay */
    body::before {
      content: "";
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 100;
      opacity: 0.3;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
      mix-blend-mode: multiply;
    }

    /* Panel */
    .settings-panel {
      width: 380px;
      background: rgba(244, 236, 216, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: var(--stroke-heavy);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }

    /* Branding row */
    .branding-row {
      border-bottom: var(--stroke-medium);
      padding-bottom: var(--space-2);
    }
    .branding-row h1 {
      font-size: 1.5rem;
      letter-spacing: -0.03em;
    }
    .branding-row .subtitle {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: lowercase;
      opacity: 0.8;
    }

    /* Control groups */
    .control-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .control-group h2 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }

    /* Segmented control */
    .segmented-control {
      display: flex;
      border: var(--stroke-medium);
      border-radius: var(--radius-pill);
      overflow: hidden;
      background: rgba(255, 255, 255, 0.2);
    }
    .segment-btn {
      flex: 1;
      background: transparent;
      border: none;
      padding: 10px 4px;
      font-family: var(--font-main);
      font-weight: 700;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .segment-btn.active {
      background-color: var(--c-blue);
      color: white;
    }
    .segment-btn:not(:last-child) {
      border-right: var(--stroke-medium);
    }

    /* Slider */
    .slider-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      font-weight: 700;
    }
    input[type="range"] {
      -webkit-appearance: none;
      background: transparent;
      width: 100%;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      height: 4px;
      background: var(--c-ink);
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 20px;
      width: 12px;
      background: var(--c-cream);
      border: var(--stroke-medium);
      margin-top: -8px;
      cursor: ew-resize;
    }

    /* Swatch grid */
    .swatch-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    .swatch {
      aspect-ratio: 1;
      border: var(--stroke-medium);
      border-radius: 4px;
      cursor: pointer;
    }
    .swatch.active {
      box-shadow: 0 0 0 2px var(--c-blue);
    }

    /* Tags */
    .tag-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .tag {
      display: inline-block;
      padding: 2px 10px;
      border: var(--stroke-medium);
      border-radius: var(--radius-pill);
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tag-primary  { background: var(--c-blue);   color: white; }
    .tag-accent   { background: var(--c-pink);   color: white; }
    .tag-highlight { background: var(--c-yellow); color: var(--c-ink); }

    /* CTA */
    .btn-primary {
      background: var(--c-ink);
      color: var(--c-cream);
      border: none;
      padding: 1rem;
      font-family: var(--font-main);
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: var(--radius-pill);
      transition: transform 0.2s ease;
    }
    .btn-primary:hover {
      transform: scale(1.05);
    }

    /* Status indicator */
    .status {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.6;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--c-pink);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%   { opacity: 1; }
      50%  { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* Watermark */
    .watermark {
      position: fixed;
      bottom: 40px;
      left: 40px;
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
    }
  </style>
</head>
<body>

  <div class="settings-panel">
    <!-- Branding -->
    <div class="branding-row">
      <h1>Bespoke</h1>
      <div class="subtitle">settings / design system demo</div>
    </div>

    <!-- Status -->
    <div class="status">
      <span class="status-dot"></span>
      System Active
    </div>

    <!-- Segmented Control -->
    <div class="control-group">
      <h2>View Mode</h2>
      <div class="segmented-control">
        <button class="segment-btn active">Design</button>
        <button class="segment-btn">Preview</button>
        <button class="segment-btn">Export</button>
      </div>
    </div>

    <!-- Sliders -->
    <div class="control-group">
      <h2>Dimensions</h2>
      <div class="slider-item">
        <div class="slider-header"><span>Width</span><span>120cm</span></div>
        <input type="range" min="40" max="300" value="120">
      </div>
      <div class="slider-item">
        <div class="slider-header"><span>Height</span><span>185cm</span></div>
        <input type="range" min="40" max="240" value="185">
      </div>
    </div>

    <!-- Swatches -->
    <div class="control-group">
      <h2>Material</h2>
      <div class="swatch-grid">
        <div class="swatch active" style="background: var(--c-yellow);"></div>
        <div class="swatch" style="background: var(--c-ink);"></div>
        <div class="swatch" style="background: var(--c-pink);"></div>
        <div class="swatch" style="background: white;"></div>
        <div class="swatch" style="background: var(--c-blue);"></div>
      </div>
    </div>

    <!-- Tags -->
    <div class="control-group">
      <h2>Categories</h2>
      <div class="tag-row">
        <span class="tag tag-primary">Shelving</span>
        <span class="tag tag-accent">Cabinet</span>
        <span class="tag tag-highlight">Plinth</span>
      </div>
    </div>

    <!-- CTA -->
    <button class="btn-primary">Apply Changes</button>
  </div>

  <div class="watermark">Bespoke Design System / v1.0</div>

</body>
</html>
```

---

*Bespoke Design System v1.0 — Extracted from 6 variant explorations.*
*For questions, refer to the original HTML source files.*
