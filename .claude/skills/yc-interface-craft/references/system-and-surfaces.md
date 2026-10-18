# From concept to a working system

This is professional design synthesis informed by the website sample. It is not a claim that these exact rules were used by YC companies or that their private apps were inspected.

## Typography is a system of roles

Choose display type for the emotional thesis and functional type for sustained reading and interaction. One family with purposeful widths/weights can be stronger than a fashionable pairing. Do not add a serif word merely because references do it.

Specify display, page heading, section heading, body, supporting text, label, control, and data roles. Include size, weight, line height, tracking, width/measure, case, and fallback. Tune optical size where supported; inspect real glyphs and numerals. Check long names, multiline buttons, punctuation, currency, multilingual strings, and 200% text zoom.

For a web starting point, body text around 16–18px and 1.45–1.65 line-height often works, but context wins. Compact operational UIs need deliberate hierarchy rather than universally enlarged type. Keep reading measure comfortable, often 45–75 characters. Scale display type with clamps and intentional line breaks; never shrink an entire desktop screenshot onto a phone. These are starting ranges, not findings from the corpus.

Confirm font availability, embedding license, weight coverage, language coverage, and fallback metrics. CSS identifying a family does not prove that its font file loaded. Avoid excessive font payload and layout shifts.

## Color, surfaces, and geometry

Derive color from positioning, subject matter, and meaning. Assign stable semantic roles before creating components. Separate brand accent from success/warning/error and selection colors. Make hierarchy survive grayscale and color-vision differences. Check text, icons, focus, and chart series on their actual surfaces.

Define a restrained surface hierarchy: canvas, section, component, overlay. Borders and elevation should express grouping or depth. Give each radius family a job; a dramatic outer silhouette can coexist with precise controls. Align optical weight across icons, strokes, borders, and type. Avoid mixing thin line icons, chunky emoji, soft 3D objects, and arbitrary glass treatment without a deliberate grammar.

Use a spacing progression appropriate to the product. Define interior padding separately from between-component gaps and between-section rhythm. A repeated grid is a scaffold, not a reason to make every section the same card layout.

## Illustration, photography, and texture

Choose the image's job first: explain a workflow, establish a human context, make a physical object credible, show output quality, or build recall.

For illustration, specify:
- Subjects and actions tied to the product; what must never appear.
- Shape construction, silhouette, proportion, perspective, and camera.
- Stroke/edge behavior, detail density, materials, lighting, shadows, and palette roles.
- Composition and cropping rules; relationship to text and UI.
- Variations for hero, feature, onboarding, empty state, and small icon; reduced detail at smaller scales.

A collage system needs consistent cut edges, shadows, paper/print character, photographic treatment, and a limited family of scraps. A line system needs repeatable stroke and corner rules. A 3D system needs consistent lens, lighting, material, and scale. A mascot needs silhouette and expression consistency across poses, not just one charming image.

Use texture as a material cue: paper for human annotation, grain for photographic atmosphere, machining marks for engineered physicality. Keep it subordinate to legibility; specify opacity, scale, and regions. Avoid animated full-screen noise unless it has a clear purpose and budget. Do not apply texture indiscriminately to data tables or text.

## Marketing website: help someone decide

Establish category, differentiated outcome, and main action quickly. Make the first strong visual explain or prove the proposition. Sequence a narrative: outcome → mechanism → evidence → objections → action, adjusted to buying context. Different sections should have different compositional jobs.

A single memorable moment can carry the identity. Keep the CTA discoverable and evidence near the claim it supports. Distinguish actual product UI from a conceptual visualization and actual product film from a rendering. Do not manufacture traction or causal conversion claims.

## Web app: help someone act

Bring the brand through typography, semantic color, precise iconography, spatial rhythm, and a few signature moments. Optimize the working surface for repeated tasks and comparison.

Model the actual task, information hierarchy, density, navigation, selection, editing, and status. Favor stable columns and readable data over decorative cards. Make primary and destructive actions distinct. Define default, hover, focus, pressed, selected, disabled, loading, success, validation, empty, and error states only where relevant.

For agentic interfaces, show proposed vs running vs completed work, scope, progress, evidence, interruption, recovery, and undo where feasible. Do not animate a simulated completion as if real work happened. Preserve user's input through failures and navigation. Specify focus restoration for dialogs and actionable recovery in error states.

## Native mobile app: preserve platform behavior

Ask which platform when it affects implementation; otherwise provide platform-neutral concepts with the assumption stated. Use native navigation, safe areas, keyboard behavior, text scaling, back gestures, sheets, and accessible controls. Translate the brand into material and interaction details instead of imposing a web hero.

Prioritize a reachable main action, short task sequences, appropriate density, offline/retry states, and permission timing. Avoid hover dependencies. Add haptics only for meaningful events with platform defaults and user preferences respected. Keep status understandable without color, sound, or haptics.

Verify current Apple/Android guidance when implementing; browser mobile emulation is not native-device testing. Public mobile screenshots on a marketing site are not evidence of the native app's actual behavior.

## Cross-surface token example

```text
color.canvas / surface / text.primary / text.secondary
color.action / action.hover / selection / focus
color.status.success / warning / error / info
type.display / title / body / label / data
space.control / component / group / section
radius.control / container / feature
motion.feedback / transition / narrative
```

Resolve values from the chosen direction. Marketing may use a display role that the app never needs. Share semantic meaning and character, not identical component sizes everywhere.
