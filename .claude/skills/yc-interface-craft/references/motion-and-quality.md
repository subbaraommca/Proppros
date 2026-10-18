# Motion and craft verification

## Motion has a sentence

Every significant animation should finish: “When ___ happens, ___ changes so the user understands ___.” Useful jobs include continuity, grouping, causality, orientation, feedback, and product demonstration. Remove motion with no meaningful job unless it is explicitly part of an experience-led brief.

Use one recognizable motion behavior per concept: assemble, resolve, reveal, compress, trace, connect. Vary scale and pacing without introducing unrelated physics. Do not apply every effect to every element.

### Motion specification

| Field | What to define |
|---|---|
| Trigger | User action, data update, first entry, or explicit playback |
| Start and end | Concrete states, including the information change |
| Path | Translation, scale, opacity, mask, layout, or native transition |
| Timing | Duration/easing or spring parameters with rationale |
| Interruptibility | What happens on reversal, repeated input, navigation, failure |
| Loop | Whether it repeats, when it stops, and whether it can pause |
| Access | Keyboard/touch equivalent and screen-reader announcement if needed |
| Reduced motion | Static final state, instant update, or brief nonspatial fade |
| Performance | Asset size, rendering work, offscreen suspension, fallback |

Starting suggestions, not measured YC norms: feedback 100–180ms; component transitions 180–280ms; larger scene changes 280–450ms. Use platform conventions where available. Test responsiveness; avoid waiting for a flourish before accepting the next action. Reserve overshoot for appropriate playful moments, not financial confirmation or medical status.

## Separate three motion layers

1. **Functional:** selection, disclosure, drag/drop, validation, pending/success/error. These must preserve state and focus.
2. **Explanatory:** a controlled demonstration of a real workflow or output. Let people pause or inspect it; label simulated data.
3. **Atmospheric:** ambient objects, film, grain, or a hero scene. Protect text and action areas. Prefer fewer simultaneous movements and stop work offscreen.

A library name in HTML is only a clue. Keyframes in CSS may be unused. A screenshot cannot establish timing, hover, scroll behavior, reduced-motion behavior, or frame rate. Test a visible trigger and the resulting state before attributing an interaction to a reference.

## Build for control and resilience

Support reduced-motion preferences for nonessential spatial animation. Ensure scroll-revealed content remains visible if JavaScript or animation fails. Keep ambient video muted by default and provide appropriate playback controls. Do not hijack scrolling. Give custom controls native semantics and visible focus.

Prefer transform/opacity for simple movement; do not force them when the task requires meaningful layout change. Avoid speculative performance claims. Profile costly canvas/WebGL, giant video, blur, and filters when used. Provide a static fallback with the same information and composition.

Standards sources: [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) is Level AAA; distinguish that from AA conformance. [WCAG target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies 24×24 CSS px or defined exceptions; larger touch targets are often preferable. Neither a media query nor a single target measurement proves full accessibility. For native implementation, consult [Apple motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion) and the target platform's current guidance.

## A bounded verification pass

Review representative desktop and narrow/mobile screens together, plus the actual requested native device classes where available. Check:
- Can a first-time user identify the product and the main action?
- Does the composition retain a focal point, a clear reading order, and intentional density?
- Do type, spacing, icons, images, and effects follow the selected rules?
- Does the main task work with keyboard and touch, including error and recovery?
- Are focus, contrast, zoom/reflow, labels, and motion controls usable?
- Do assets load without blocking the message or causing disruptive movement?
- Does the layout handle real content, long labels, and empty/loading/error states?

Fix material issues in one consolidated pass, then confirm the affected paths. Stop when the requested outcome is met; do not run endless cosmetic rounds. Record what was actually checked, on which surface and size, and what remains untested.

## Common false signs of craft

- A beautiful loader that delays the product proposition.
- Animation that leaves the headline obscured or invisible on a slow load.
- Gradient accents repeated so often that no action stands out.
- Hero illustration with no related visual language below the fold.
- Marketing typography applied unchanged to dense operational data.
- Semantic states conveyed by decorative colors alone.
- A polished happy path with no pending, error, interruption, or recovery behavior.
- Borrowed logos, testimonials, or figures added to make the concept look believable.
