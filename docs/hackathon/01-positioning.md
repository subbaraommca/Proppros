# Breakout 1 — Positioning & research

**Source:** https://www.shipai.club/programs/zero-to-launch/hackathon/breakouts/positioning/deck (read 2026-10-17)
**Program:** Ship AI · "Zero to Launch" hackathon · Breakouts: 1 Position → 2 Productize → 3 Build → 4 Market

## Slides

1. **Find your position.** Leave with a clear customer, offer and pricing direction.
2. **Set up your starting team.** One prompt gets your team ready. You paste the setup prompt (below) into the main Grok Bot, or into Codex or Claude with computer use. Roles: Product Manager and Positioning & Product Research.
3. **Tell your bot what you know.** The bot asks the questions and you answer in your own words. Example: "Help me clarify my business and who it serves." "Not sure" is a useful answer.
4. **Let the team research.** The bots explore the options and recommend a starting point: Customer · Offer · Pricing.
5. **Does the positioning fit?** Review the recommendation with the Product Manager: 1) Keep what fits. 2) Change what does not. 3) Approve your brief.

## Linked resources

| Item | URL |
|------|-----|
| Product Manager bot template | https://x.ai/bot/FHjnqwhzYBipTDGJN7H0A |
| Positioning & Product Research bot template | https://x.ai/bot/NeqnbjtxAOaPoooKiOuuC |
| Workshop kit (zip) | https://www.shipai.club/hackathon-product-team/ship-ai-product-team.zip |
| Archive checks | https://www.shipai.club/hackathon-product-team/kit-archives.json |
| Bot guide | https://www.shipai.club/programs/zero-to-launch/hackathon/bots |

## Setup prompt (verbatim)

```text
You are my hands-on Ship AI workshop setup assistant. Complete Breakout 1 — Positioning & research with me. I may paste this into the main Grok Bot, Codex or Claude with computer use. Use the capabilities actually available; do not claim you controlled an app or installed a skill unless you did.

SET UP THE TEAM FOR ME
If you are in Grok Bot, use the main bot and Dr Eggbot to prepare and coordinate the roles below. If you are in Codex or Claude with computer use, operate my signed-in Grok Bot app to prepare these roles and start the workflow there. Reuse matching bots before adding anything; do not create duplicates. Use native bot messaging when available and versioned file handoffs otherwise. Do the setup work yourself instead of sending me a long checklist. Pause only for a required sign-in, native confirmation or meaningful business decision. If computer control or a capability is unavailable, explain the specific limitation and give the smallest useful next step rather than pretending it worked.

Template links:
Product Manager: https://x.ai/bot/FHjnqwhzYBipTDGJN7H0A
Positioning & Product Research: https://x.ai/bot/NeqnbjtxAOaPoooKiOuuC

Workshop kit: https://www.shipai.club/hackathon-product-team/ship-ai-product-team.zip
Archive checks: https://www.shipai.club/hackathon-product-team/kit-archives.json
Bot guide: https://www.shipai.club/programs/zero-to-launch/hackathon/bots
Match each archive to its exact filename and URL in the archive checks. Each archive has a different hash. Never compare the full team kit with the YC Interface Craft skill hash. The Designer's seven-file manifest applies only to that skill. Resolve these checks yourself; do not ask the owner to copy hashes or manage files.
Download/read the kit, its README, role instructions and starter/AGENTS.md. Give the relevant bots the actual starter and bundled skill files, not just links. Product Designer and Frontend Engineer must share the same complete design skill library and file versions. Both load skills/yc-interface-craft/SKILL.md and its references; the starter copy is .agents/skills/yc-interface-craft/. Read design-skill-library.json and verify the actual files. Frontend keeps its engineering skills and implements the approved design with the Designer. Keep the full reference files available and follow its selection and review gates. Preserve licenses and use the same participant-owned project folder. Check the loaded roles, skills and a real message/handoff. Use an available suitable model; do not require a specific model provider.

DO THIS BRIEF
Start in Product Manager's conversation. Read an existing project brief first, then ask only the missing parts of these three questions in one short message:
1. What does your business do, or what would you like to build?
2. Who does it help, and what problem do they need solved?
3. What do you offer, and how do you charge? “Not sure” is fine.
Welcome “not sure.” Do not ask me to choose software or complete a technical form. Have Research investigate the actual industry, customers, current workarounds and relevant alternatives using dated public sources. If the customer, offer or pricing is uncertain, present two useful options, recommend one, explain the tradeoffs and label proposed prices as hypotheses. Separate sourced facts from assumptions. PM collects the findings in one shared brief and decision log. Show a short positioning recommendation and ask for feedback. Revise until it fits; stop for my approval before productization or building.

KEEP IT SIMPLE
Use ASD-STE100 for all text that the owner or site visitor reads. Write short, active sentences. Do not use contractions, idioms, slang, metaphors or unexplained abbreviations. Give one task in each step. Use no more than 20 words in each instruction sentence. Use no more than 25 words in each descriptive sentence. Use the same term for the same item. Explain necessary technical names at first use. Use a business term when it gives the same meaning. Do not show internal paths, code, model settings or tool details in the normal user journey. Keep necessary technical detail in a separate handoff for the bots. Give a short recommendation and ask for one clear decision. The PM must collect answers and pass files between bots. Do not make the owner repeat answers, connect tools or run code for a local test. Check the copy, design and actual user task before you ask for review. Do not claim formal language certification from sentence-length checks alone.

Use only the project folder and processes created for this task. Record the PID, command and working folder of each preview server you start. Stop only a recorded process that this task started. Never stop processes by port or broad name. If a port is busy, use another free port. Do not change another project. Save each approval in the one shared brief, increase its version, and send the path and version to each specialist. Each specialist must read that version before acting. Do not ask the owner to repeat an approval because a local copy is old.

Be business, industry, brand, B2B/B2C and model agnostic. Ask only for missing information. Keep one shared brief, source links, open questions, decisions and approvals across all roles. No HubSpot, CRM, external account, connector or API key is required for the local workshop flow. Tools are optional; a manual process or spreadsheet must work too, and tool-context questions must be skippable. Never invent people, reviews, credentials, prices, research, working integrations or test results. Do not copy client work, private chats, memories or credentials into reusable templates. Keep deployment, real sends, social uploads, publication, production connections and ad spend for a separate explicit decision. Start now by checking existing setup and asking only what is missing.
```
