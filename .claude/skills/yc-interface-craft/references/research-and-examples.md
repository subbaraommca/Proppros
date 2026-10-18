# Research basis and annotated examples

## Scope and limits

Snapshot: **October 16, 2026, America/Phoenix**. Source: [YC's public directory](https://www.ycombinator.com/companies), its public search index `YCCompany_production`, and the company-owned sites below. The directory itself identified Fall 2026 as current. Future 2027 early-admission listings were excluded. “All” means all public listings returned for these four batches; it cannot include unannounced companies.

| Batch | Public companies | Readable HTML | Sparse/JS shell | Fetch failed | No website |
|---|---:|---:|---:|---:|---:|
| Winter 2026 | 198 | 170 | 24 | 3 | 1 |
| Spring 2026 | 192 | 175 | 12 | 5 | 0 |
| Summer 2026 | 230 | 214 | 16 | 0 | 0 |
| Fall 2026 | 146 | 133 | 8 | 2 | 3 |
| **Total** | **766** | **692** | **60** | **10** | **4** |

The automated pass attempted every listed homepage, followed ordinary redirects, and inspected inline CSS plus up to three linked stylesheets per fetched site. Fetch caps: 3 MB HTML and 1.5 MB per stylesheet; no external JS execution. This provides broad source evidence, not a visual review of 766 sites. Failures remain in the roster. Sparse pages can contain substantial client-rendered designs.

A purposive, non-random sample of **16 sites** received desktop hero screenshot and rendered-DOM inspection, four per batch, chosen for variation in industry, audience, visual medium, and product model. Four also received narrow-screen checks at a verified 390px viewport: Cardboard, Imperfect, Bloomy, and Decent. Five controls across four sites were directly exercised with a confirmed resulting state: Cardboard's prompt preset and mobile menu, Boxes.dev's Terminal tab, Caveman's Product menu, and Melty's pause control. These are focused checks, not complete UX, accessibility, performance, or motion audits.

The font names below are browser computed-style stacks; font-file loading and licenses were not independently verified. Colors are visual descriptions unless an explicit computed value is given. No conversion experiments, private app access, or native mobile app testing occurred. Public product screenshots are marketing evidence only. The app and motion prescriptions elsewhere in this skill are design synthesis.

Do not infer adoption percentages from CSS frequency: unused utilities, font fallbacks, bundled components, and framework defaults contaminate counts. Do not infer visual dominance from the most frequent hex literal. Do not infer accessible motion from the presence of a media query.

## Winter 2026

### Cardboard — output and input share the stage

[Company website](https://cardboard.ai) · [YC profile](https://www.ycombinator.com/companies/cardboard)

**Observed:** A near-black canvas, expressive white serif headline, central prompt composer, and tilted examples of generated video. The computed headline stack begins with Denton; interface controls use Delight and the body stack begins with Geist. The surrounding imagery supplies variety while the interface stays mostly monochrome. The headline changed between observations. Clicking the Launch Video preset populated the composer and enabled the creation action; no generation was submitted. Narrow-screen navigation condenses to a menu, and the content is reorganized vertically.

**Transferable:** When output quality is the differentiator, let examples establish taste and let the first input make the product immediately understandable. A restrained UI can frame rich media.

**Caution:** Entry animation initially produced an incomplete screenshot; wait for the rendered state before judging. Animated headline changes and simultaneous media need readability and reduced-motion checks. Do not assume the editor works from marketing inspection alone.

### Button Computer — contextual film makes hardware legible

[Company website](https://buttoncomputer.com) · [YC profile](https://www.ycombinator.com/companies/button-computer)

**Observed:** White navigation, a broad lifestyle film, left-aligned white copy, a yellow pill CTA, and a press/backing strip directly below. Poppins headings and DM Sans body are declared in computed styles. The page continues into product utility, privacy, purchase information, and FAQs.

**Transferable:** Show where and how a physical product belongs in someone's life. Use a conspicuous, limited action color against natural imagery. Explain practical objections after the emotional introduction.

**Caution:** A film's atmosphere does not replace a clear device view or mechanism. Ensure copy stays readable across frames and provide a usable static poster.

### 21st — the inventory demonstrates the proposition

[Company website](https://21st.dev) · [YC profile](https://www.ycombinator.com/companies/21st)

**Observed:** Dark-to-blue atmospheric field, large left-aligned type, a contrasting italic word, category navigation, and a broad gallery of interface examples. Computed heading/body stacks begin with General Sans; the italic span was not separately measured. The gallery supplies much of the visual variety.

**Transferable:** For a visual library, the inventory is the persuasive asset. A stable surrounding frame lets examples be expressive while maintaining navigation and comprehension.

**Caution:** A marketplace contains many creators' styles; it is not evidence of one coherent brand system. Do not stitch unrelated components together and call that art direction.

### 10x Science — scientific forms and institutional evidence

[Company website](https://10xscience.com) · [YC profile](https://www.ycombinator.com/companies/10x-science)

**Observed:** Predominantly white page, oversized black sans headline, green and violet accents, institutional marks, email access control, and large cropped radial/scientific forms near the hero edges. The heading stack begins with Inter. The composition is centered and emphasizes the scientific category.

**Transferable:** Use domain-specific form and relevant evidence to make abstract capability feel concrete. Controlled accent families can give a restrained scientific page identity.

**Caution:** An oversized technical headline can dominate the viewport. Check comprehension, line breaks, and action visibility; institutional logos are claims requiring legitimate use.

## Spring 2026

### ANORIA — emotional atmosphere before technical detail

[Company website](https://www.anoria.com) · [YC profile](https://www.ycombinator.com/companies/anoria)

**Observed:** Full-viewport landscape film, centered light-weight white type, widely tracked small labels, sparse navigation, early-access capture, and a film control. The heading stack begins with Neue Haas Unica W1G; body uses Epilogue. The photographic palette carries much of the identity.

**Transferable:** An experience-led consumer concept can establish emotional territory through a coherent film, spare type, and a small number of deliberate actions.

**Caution:** The first view offers little mechanism or product evidence. Light text over changing footage needs scrutiny. Use this approach when the business can afford that initial ambiguity, not as a universal startup template.

### Imperfect — collage expresses the brand promise

[Company website](https://imperfect.co) · [YC profile](https://www.ycombinator.com/companies/imperfect)

**Observed:** White space, dark oversized sans, orange action, purple detail, athletic photo cutouts, colored paper-like polygons, and textured scraps. Desktop places the large headline opposite supporting copy, with imagery framing the upper field. The measured heading stack begins with Rink, followed by Inter Display/Inter. At 390px, the runner becomes a strong top-right composition above the stacked headline, copy, and action; no horizontal page overflow was measured.

**Transferable:** Material and composition can embody an accommodating, human promise. An irregular collage can coexist with disciplined typography and a straightforward task.

**Caution:** Match crop, edge treatment, texture scale, and photographic lighting across the asset family. Random colorful scraps would lose the connection to the brand.

### Allowance — a familiar conversation explains new infrastructure

[Company website](https://useallowance.com) · [YC profile](https://www.ycombinator.com/companies/allowance)

**Observed:** Pale green/cream field, near-black rounded-looking type, vivid green emphasis, and a chat-like shopping example opposite the proposition. A QR/message entry point sits in a tinted bottom band with network/backing marks. The computed stack is `ui-rounded`, SF Pro Rounded, and system fallbacks.

**Transferable:** Use a familiar interaction model to introduce an unfamiliar technical category. Make an abstract permission or spending constraint visible through a concrete user request.

**Caution:** A decorative dialogue is not a live feature. Provide a direct action on the same device; do not rely only on a QR code for mobile visitors. Check bright accent text against the pale ground.

### Infera — editorial science with operational detail

[Company website](https://www.infera.bio) · [YC profile](https://www.ycombinator.com/companies/infera)

**Observed:** Warm near-white ground, dark serif display, violet emphasis/action, fine framing marks, small monospaced-looking labels, and faint protocol/command text behind the main content. Computed stacks identify Instrument Serif for the headline and Instrument Sans for body text. The page explicitly describes an early product demo as a prototype capture.

**Transferable:** Pair an editorial voice with concrete technical material. Use actual domain language as a secondary graphic layer while keeping the proposition legible. Be honest about prototype status.

**Caution:** Background command text must remain subordinate. It can become visual noise, and its motion timing was not measured.

## Summer 2026

### Bloomy — an explanatory workflow occupies the hero

[Company website](https://bloomylearning.com) · [YC profile](https://www.ycombinator.com/companies/bloomy)

**Observed:** Pale cyan/blue atmosphere, dark Inter headline, blue-to-teal accents, and a rounded white demo panel. Source nodes connect to a diagnostic engine; the panel includes stages for diagnosis, mastery, and tutoring. At 390px the headline, copy, benefits, and CTA lead the composition, with the demo moved down. No horizontal page overflow was measured.

**Transferable:** A diagram can explain how a service turns inputs into useful outcomes. Stage-based demonstration is useful when it corresponds to a genuine workflow.

**Caution:** The gradient and rounded panels are common devices. Distinction must come from pedagogical meaning and actual product evidence, not from adding more glows. The demo's controls were not exercised.

### Gamgee — molecular form meets personal stakes

[Company website](https://gamgee.io) · [YC profile](https://www.ycombinator.com/companies/gamgee)

**Observed:** Cream background, heavy black Poppins headline, cyan highlight blocks, coral emphasis/action, and a vertical DNA-like helix assembled from dog photos. A personal founder/dog story begins below. Body stack begins with Inter.

**Transferable:** Combine a category-specific structure with human or personal source material. The image can communicate both the science and why it matters.

**Caution:** Medical effectiveness is not established by persuasive design. Keep claims, eligibility, and evidence clear. A distinctive composite illustration requires coherent sourcing and production, not copied assets.

### Agentcard — deliberately maximal commerce imagery

[Company website](https://agentcard.sh) · [YC profile](https://www.ycombinator.com/companies/agentcard)

**Observed:** A saturated electric-blue loading screen resolves into a dense 3D-style scene of wallets, cards, packages, carts, devices, and money. Large white headline type is angled through the scene, with navigation near the bottom. The heading stack begins with Neue Haas Grotesk Display Pro. In the inspected frame, objects overlapped parts of the headline.

**Transferable:** A literal object vocabulary can make an abstract category memorable. A strong chromatic world can carry a recognizable identity.

**Caution:** Treat this as both inspiration and anti-reference: rich spectacle competes with reading, and the initial loader postpones the message. Maintain a protected text/action zone and a static alternative. A clicked Products control was not counted as a confirmed interaction because its result was not established.

### Atomarine — physical scale establishes the category

[Company website](https://atomarine.co) · [YC profile](https://www.ycombinator.com/companies/atomarine)

**Observed:** A large ocean/platform scene, restrained white annotations, huge uppercase text aligned near the lower edge, and a yellow contact action. Computed typography uses Instrument Sans. The page continues into quantified claims and the infrastructure problem.

**Transferable:** For physical infrastructure, an environment and scale cue can explain more than abstract AI motifs. Sparse annotations can connect the visual to an engineering proposition.

**Caution:** A visualization must not imply a deployed installation if it is a concept. Label renders appropriately and substantiate metrics; neither was independently verified here.

## Fall 2026

### Boxes.dev — make the benefit a physical action

[Company website](https://boxes.dev) · [YC profile](https://www.ycombinator.com/companies/boxesdev)

**Observed:** A dark film of a laptop closing, an oversized white outcome-led headline, clear action controls, and a visible workbench screenshot below. The heading uses a system sans stack. Further down, Desktop/Mobile/Terminal/Your agent tabs show surface-specific evidence. Clicking Terminal selected that tab and replaced the panel with terminal content and imagery.

**Transferable:** Show the human consequence of infrastructure: leaving the laptop while work continues. Follow the promise with concrete product surfaces rather than abstract decoration.

**Caution:** Do not let the film hide the software evidence. The displayed mobile and terminal screens are not equivalent to testing those clients.

### Caveman — one motif extends through the identity

[Company website](https://caveman.so) · [YC profile](https://www.ycombinator.com/companies/caveman)

**Observed:** Near-black ground, large light sans headline, a pixel-like mark, and fine constellation figures of a hunter and torch bearer. The computed stack begins with GeistSans. Opening Product revealed a structured menu separating the open-source and cloud offerings, including a command and copy control. No command was executed.

**Transferable:** A brand's name and story can generate a coherent form vocabulary. Keep atmospheric drawing quiet while hierarchy carries the proposition. Product navigation can explain the business model.

**Caution:** Very low-contrast line work can be attractive decoration but is inappropriate for essential information. Dense announcement/navigation layers also compete for attention.

### Melty — actual play is the explanation

[Company website](https://melty.gg) · [YC profile](https://www.ycombinator.com/companies/melty-gg)

**Observed:** Black frame, chunky wordmark, bright blue actions, and a large rounded gameplay region. Source-game icons and a combined title describe the mashup. The headline uses Melty Suisse Semibold; the body stack begins with Inter. Clicking Pause gameplay changed the control to Play gameplay, confirming a user-controlled playback state.

**Transferable:** When the promise is a new kind of output or experience, show it directly. Integrate the main action into the visual hierarchy and provide media controls.

**Caution:** Footage, branding, and game assets have rights constraints. A video is not proof that a demo is interactive; do not imply that visitors have played a working prototype.

### Decent — warmth without sacrificing explicit explanation

[Company website](https://decent.com) · [YC profile](https://www.ycombinator.com/companies/decent-com)

**Observed:** Pale blue/cream ground, dark blue serif display, coral accent/action, readable sans body, a product-explanation film, and a personal founder contact panel. Computed stacks begin with Fraunces Variable and Public Sans Variable. At 390px, the copy, CTA, and founder panel stack into a readable flow; no horizontal page overflow was measured.

**Transferable:** Pair a warm editorial voice with plain language about what the service does and how it is paid. A restrained palette can still feel recognizable.

**Caution:** Insurance and financial claims need evidence independent of design. Brand warmth should not blur eligibility, exclusions, pricing, or responsibility.

## Synthesis, not a house style

1. **Product-native proof** has more strategic value than generic AI decoration: Cardboard, Boxes.dev, Melty, Bloomy.
2. **Material carries meaning** when connected to the promise: Imperfect's collage, Gamgee's photo helix, Infera's protocol field.
3. **Type contrast is a tool**, not an automatic serif-plus-sans recipe: Cardboard/Decent differ from the sans-led hardware and infrastructure sites.
4. **A strong hero must extend into a system.** Specify a related lower-page, product, mobile, and interaction vocabulary.
5. **Expression needs a protected task.** Agentcard's overlap and loading sequence are useful counterexamples to uncritical spectacle.
6. **Marketing and operating surfaces have different jobs.** Carry semantic and graphic identity across them without copying hero density into daily workflows.

These are editorial judgments from a small visual sample, not statistical conclusions or measured conversion effects. Revisit the live references before claiming their current appearance.

For a particular company or category, query the bundled [company-index.json](company-index.json). It contains the full roster, official profile links, homepage scan status, and review coverage. Load only matching records; do not read all 766 into every design task.
