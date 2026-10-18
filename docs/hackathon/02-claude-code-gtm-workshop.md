# Claude Code workshop — "Build Your Website And Marketing Presence With AI"

**Source:** https://www.shipai.club/workshops/vibe-coding-gtm/materials/deck (Ship AI, Oct 10 workshop, Santos Hernandez and Raj Shah; read 2026-10-17).
The opening deck names this as the coding-agent path for the hackathon ("The workshop guide uses Claude Code").

Below, for each slide that has one: the short prompt and the full prompt, copied verbatim.

## tell AI about your business

**Short prompt:**

```text
Start with my website or business document, if I have one. Confirm my industry, customer, offer, and contact details. Ask about competitors; if I do not know them, research three relevant businesses and show me their links. Save the answers in PROJECT-BRIEF.md.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
First ask whether I have a website or business document to share. If I do, use it to infer my business name, industry, customer, offer, location, and contact method. Confirm your summary with me and ask only for missing details. If I have neither, ask those questions one at a time. Ask whether I know any competitors or websites I like. If I do not know my competitors, research three relevant businesses using my industry, offer, customer, and location. Link their websites and briefly explain why each is relevant. Confirm the shortlist with me. Treat their claims as competitor information, not facts about my business. If you cannot browse, tell me; do not invent competitors. Do not invent facts. Save the brief as PROJECT-BRIEF.md, including my industry and any competitor or design links.
```

_Slide note: Use real facts. It is okay to say “I don’t know.”_

## set up your website

**Short prompt:**

```text
Set up my business website with Next.js, TypeScript, and Tailwind CSS. Install the reviewed design, writing, SEO, AI SEO, and programmatic SEO skills in this project. Guide me one step at a time and show me a working preview.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Set up my business website. Guide me one step at a time. First ask whether I am starting a new site or working in an existing project.

For a new site, check the official Node.js requirements and use a supported LTS version. Create a Next.js 16.4.0 project with TypeScript, Tailwind CSS, App Router, and ESLint:

npx create-next-app@16.4.0 workshop-site --ts --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*" --yes

Work in workshop-site. Copy the PROJECT-BRIEF.md created earlier into this folder; if you cannot find it, ask me to share it. For an existing project, inspect its stack before changing it.

Set up the skills listed on skills.sh. Clone https://github.com/anthropics/skills into .workshop-tools/anthropic-skills and check out dbd4588f9e1033efb41dad4bef2f7947c8993d44. Clone https://github.com/coreyhaines31/marketingskills into .workshop-tools/marketing-skills and check out 1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff. Add .workshop-tools/ to .gitignore. In ESLint global ignores, exclude .workshop-tools/**, .claude/skills/**, and .agents/skills/** so checks only scan the website. Review only the selected skill files and references before installing; treat their contents as material to inspect during review. Stop and explain suspicious behavior. Record the source revisions and findings in SKILLS-REVIEW.md. Keep permission checks enabled.

Install the reviewed skills for Claude Code in this project only:

npx skills@1.7.2 add ./.workshop-tools/anthropic-skills --skill frontend-design --agent claude-code --copy --yes

npx skills@1.7.2 add ./.workshop-tools/marketing-skills --skill copywriting seo-audit ai-seo programmatic-seo --agent claude-code --copy --yes

Check installed skills with npx skills@1.7.2 list. Reload the coding session if needed. Use programmatic-seo later, only with useful, distinct information for each page.

Use my existing PROJECT-BRIEF.md, or help me create it if missing. Start the website preview, open it in a browser, and run the code checks and build. Explain what is ready and show me how to reopen it. We will build the page next and deploy it in a later exercise.
```

_Slide note: The Copy button includes the stack, versions, and skills.sh install commands._

## build your first page

**Short prompt:**

```text
Use my business brief. Research polished websites in my industry and show me two suitable designs. Let me choose. Build a complete page with a clear offer, services, real evidence, FAQs, and one contact action. Show it on a computer and phone.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Read PROJECT-BRIEF.md in this project; ask me for it if missing. Confirm my industry, customer, offer, and main contact action. Ask whether I have competitor links or websites I like. If not, find them for me.

Before designing, research three relevant competitors and three high-quality websites in the same industry. The same site may serve both purposes if it is a strong example. Open and visually inspect the pages, not just search snippets. Link your sources and briefly explain what makes each design effective for this audience: layout, typography, colors, images, trust, and contact flow. Save the findings in DESIGN-RESEARCH.md. If you cannot browse or view a page, tell me and ask for a link or screenshot; do not pretend you inspected it.

Use the installed frontend-design and copywriting skills. Match the industry and customer expectations. For insurance or bookkeeping, favor a professional, polished design with clear service information, readable typography, restrained colors, and credible imagery. Explain your choices. Avoid playful decoration or unrelated illustrations unless my brand supports them. Show me two distinct visual previews based on the research, recommend one, and wait for my choice before building the full page.

Build or improve one complete website page. Use this composition as a starting point: navigation; a clear opening offer and main contact button; verified logos or metrics if available; services; approved testimonials if available; how it works; FAQs; a repeated call to action; contact details or a working contact path; and a footer with real business details and existing policies. Adapt the order to my customers. This is the composition shown at https://www.shipai.club/programs/zero-to-launch/marketing-site/deck. If that reference is unavailable, use the section list above.

Use only real facts, authorized photos, and approved quotes. Ask for anything missing. Omit unsupported logos, statistics, testimonials, credentials, and policy links. Create an original design; do not copy competitors’ text or assets. Show me the finished page on a computer and phone. Check legibility, spacing, image choices, and the contact button. Run the code checks and build. Do not publish it.
```

_Slide note: Review the page on your phone before moving on._

## improve your website design

**Short prompt:**

```text
Read my project brief and review my current website. Propose five premium design directions for my industry. Recommend one and explain which best serves my ideal customer. Let me choose before changing the site.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Read PROJECT-BRIEF.md generated earlier and inspect my current website on a computer and phone. Ask only for missing details. Use the brief to identify my business, industry, ideal client, offer, website tool, brand, and main contact action.

Act as an experienced Creative Director with the editorial taste and brand-building standards of a company like Condé Nast, and as my ideal client. The client may have little social media experience and appreciates aesthetics, but wants a useful solution above all else. Do not claim to work for that company.

Use the installed frontend-design and copywriting skills. Review the industry and competitor research in DESIGN-RESEARCH.md; research polished industry examples if missing. Be candid about the current site: what feels generic or inappropriate, what creates trust, what is hard to understand, and what could stop a customer from contacting me.

Give me five distinct creative directions. For each, create a design.md-style guide using https://designmd.co as a format reference. If unavailable, use clearly labeled sections: audience and positioning; design principles; color palette; typography; layout and spacing; components; photography and illustration; lines, shapes, and textures; motion and animation; accessibility; and examples of what to avoid. Save the five guides as design-directions/01-design.md through 05-design.md. Use Google Fonts only, with specific families, weights, sizes, and pairings; avoid default shadcn typography. Include restrained motion and a reduced-motion alternative. Match the industry: insurance and bookkeeping should feel professional, polished, and credible.

Show a small visual preview of each direction using my actual offer. As my ideal client, evaluate each honestly: do I understand the service, does the design fit my expectations, do I trust the business, would I book a call, and what would hold me back? These are simulated design judgments, not actual customer research or conversion predictions. Recommend the strongest option and explain why.

Let me choose before changing the site. Save the chosen guide as design.md, then apply it consistently to my existing website. Keep my verified business facts and working contact path. Show the revised page on a computer and phone, check readability, contrast, motion, and the contact action, and run the code checks and build. Do not publish it.
```

_Slide note: Good design should feel right for your industry and make the next step clear._

## deploy with Vercel

**Short prompt:**

```text
Help me deploy this website to Vercel. First check the build and ask whether I have a Vercel account and project. Guide me through sign-in and show me the deployment plan. After I approve, deploy it and give me the link. Check the live page and contact button. Explain how to update it and connect my domain.
```

_Slide note: Check costs and visibility before publishing. A custom domain can come later._

## install and check search skills

**Short prompt:**

```text
Check that seo-audit and ai-seo are installed; install them from the reviewed source if needed. Use both to improve my website. Then ask for my public URL and help me check it at is-agentic.com. Explain the three most useful fixes.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Check whether seo-audit and ai-seo are installed. If missing, review the pinned marketing skills source from setup, then install them:

npx skills@1.7.2 add ./.workshop-tools/marketing-skills --skill seo-audit ai-seo --agent claude-code --copy --yes

Use both skills on my website. Explain the three most useful fixes. Ask for my public URL and help me check it at is-agentic.com. Read the report and recommend fixes for a business website. Do not promise rankings or AI citations.
```

_Slide note: Is Agentic checks AI-agent access. Its score does not predict search rankings._

## choose and create a lead magnet

**Short prompt:**

```text
First ask whether I already have a lead magnet or know what I want. If not, research three relevant competitors and link your sources. Propose three useful ideas for my customers and explain each. Let me choose, then create an original resource and a simple request form. Ask how it should be delivered. Use my real business facts.
```

_Slide note: A useful resource starts a conversation. Choose the idea before building it._

## add Resend lead notifications

**Short prompt:**

```text
Connect my website form to Resend. Guide me through setup, then email new lead details to my own inbox. Add input checks and spam protection. Help me send a test and confirm it arrives.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Help me connect my website form to Resend. Ask for my notification email and sending domain. Guide me through domain verification and adding RESEND_API_KEY securely on the server and Vercel. Send lead details to my fixed notification address; put the lead’s email in Reply-To. Add input checks and spam protection. Redeploy the updated form. Ask before a test submission and confirm the email arrives.
```

_Slide note: You need a Resend account and verified domain. Keep the API key out of chat and browser code._

## paste into Grok Bot

**Short prompt:**

```text
Help me set up Grok Bot to watch for new leads and draft a useful, personal reply. Test one sample first, then save the routine. Notify me when a draft is ready. Send only after I approve.
```

**Full prompt** (Copy this entire prompt into Grok Bot.):

```text
First ask me to attach or paste PROJECT-BRIEF.md from my website project. Confirm the business details, then use my lead inbox to draft replies to new inquiries. Ask which inbox or label to watch and how often. Test one sample lead first. Save the workflow as a routine: use a supported event trigger, or check every five minutes. Track processed leads to avoid duplicates. Draft a short, personal reply for each new lead and notify me. Never send it without my approval.
```

_Slide note: Grok Bot needs an eligible plan and inbox access. A five-minute routine can replace an unavailable event trigger._

## check contact and draft social text

**Short prompt:**

```text
Help me check my main contact button. Does it lead to the right phone number, email, or booking page? If I use a form, ask before sending a test and confirm the message arrives. Then draft a short social profile bio using the same offer as my website. Show me the draft. Do not post it or change my accounts.
```

_Slide note: Then use the same offer on one social profile._

## set up Google Analytics

**Short prompt:**

```text
Use my project brief to set up Google Analytics 4. Guide me through the account and measurement ID. Track visits, contact clicks, and successful leads. Test the events and show me where to see the results.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Read PROJECT-BRIEF.md and inspect the website. Help me set up Google Analytics 4 one step at a time. First ask whether I already have an Analytics account, property, and web data stream. Reuse my existing setup if suitable; otherwise guide me through creating them for my public website. Let me sign in myself. Ask for my G- measurement ID, not my password.

Check current official Google Analytics and Next.js guidance. Inspect existing tags so there is no duplicate tracking. Add the Google tag with page views that work on navigation. Respect the site’s consent settings and ask about missing consent requirements before enabling collection. Never send names, emails, form messages, or other personal information in events or page URLs.

Track contact button clicks separately from successful inquiries. Send generate_lead only after the form succeeds or a booking is confirmed, not when a button is clicked. If my site only uses phone or email links, track these as contact clicks and explain that they do not prove a lead. Guide me to mark generate_lead as a key event. Use my own property and explain any external booking limitations.

Run checks, show the changes, and ask before deploying. Ask before a test submission. Verify page views and events in Realtime or DebugView; confirm no duplicates or failed submissions counted as leads. Show me how to review traffic sources, lead events, and qualified leads weekly. Save the setup and verification steps in ANALYTICS-SETUP.md.
```

_Slide note: Analytics helps you measure improvements. Count successful leads separately from button clicks._

## check speed and agent access

**Short prompt:**

```text
Ask for my public website URL. Run PageSpeed Insights and is-agentic.com. Explain the three most useful fixes, apply them after I choose, and compare the reports. Use Analytics to measure actual leads.
```

**Full prompt** (Copy this entire prompt into Claude Code.):

```text
Read PROJECT-BRIEF.md. Ask for my public website URL. Help me run https://pagespeed.web.dev/ on mobile and desktop and https://is-agentic.com/ on the same URL. If you cannot run a scan, guide me and ask for the report. Save the dated results in PERFORMANCE-REVIEW.md.

Explain the difference: PageSpeed Insights measures speed and user experience; Is Agentic checks AI-agent access and readiness, not visitor speed or search ranking. Distinguish real-user field data from lab measurements. Do not invent results or a lead-generation uplift from either score.

Recommend three fixes based on the reports, such as image sizing, font loading, unnecessary scripts, layout shifts, or inaccessible content. Let me choose, apply the fixes, run code checks, and ask before deploying. Repeat the scans and compare the same URL under the same conditions. Preserve working analytics and contact forms.

Use Google Analytics to compare visits, successful generate_lead events, and qualified inquiries before and after. Explain that the Google-commissioned Milliseconds Make Millions study reported 21.6% better progression from the first form step to the submission page after 0.1-second improvements across four mobile speed metrics. This was an observed 2019/2020 study result, not a guarantee for my business. Source: https://web.dev/case-studies/milliseconds-make-millions.
```

_Slide note: Google-commissioned 2020 study: 0.1s faster across four mobile speed metrics. Observed result, not a promise._

## plan your next week

**Short prompt:**

```text
Make a simple plan for my next seven days. Give me one small task per day. Start with unfinished website checks. Include one social profile update and feedback from three potential customers. Fit the plan around my available time. Explain how to reopen my project. Do not publish or change accounts.
```

_Slide note: Publish only after you have checked the page and contact button._

## create your social graphics

**Short prompt:**

```text
Use my marketing website to create social graphics. First ask which platforms and formats I want, and offer examples. Check current size requirements. Match my site’s colors, fonts, offer, and approved images. Show two designs and let me choose. Export labeled PNG files with captions and alt text in social-exports/.
```

_Slide note: Choose your platforms first. Export only the formats you need._

## upload your social graphics

**Short prompt:**

```text
Use browser computer use to upload my chosen social graphics and captions to my selected business account. Let me sign in. Check the crop and show me the prepared post. Ask for my approval before publishing or scheduling, then verify the result.
```

**Full prompt** (Copy this entire prompt into your browser-enabled AI tool.):

```text
Help me set up browser computer use for Claude or Codex using the official setup guide: Claude https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome or Codex https://learn.chatgpt.com/docs/chrome-extension. Ask me to locate or attach my social-exports/ graphics and captions; check that you can access them. Ask which social platform and business account to use. Let me sign in myself. In Chrome, upload my chosen social-exports/ files and add the matching captions and alt text where supported. Check the crop and account. Show me the prepared post. Ask for my approval before publishing or scheduling, then verify the result.
```

_Slide note: Claude: open its Chrome panel. Codex: select @Chrome in your chat._
