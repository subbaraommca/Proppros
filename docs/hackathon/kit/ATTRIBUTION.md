# Source and attribution

These files come from the **Ship AI workshop kit** (https://www.shipai.club/hackathon-product-team/ship-ai-product-team.zip). The kit was downloaded 2026-10-17 and its SHA-256 `fde9899a28b3f620a6f6ab9bb34ffadcbd23272d6ad8ce26e9cc588aab3004c6` matched the official kit-archives.json.

- `roles/`, `templates/`, `marketing-handoff.md`, `owner-language.md`: Ship AI role sources, kept unchanged as reference. The Proppros agents in `.claude/agents/` are generic adaptations of these roles.
- `.claude/skills/`: a selected subset of the kit's skills, copied unchanged with their upstream licenses in `.claude/skills/_licenses/`. Sources: Anthropic frontend-design, Emil Kowalski's skills, Corey Haines' marketingskills and the user-supplied YC Interface Craft skill. `sources.json` lists the exact revisions and hashes.
- **Review (2026-10-17):** we scanned the selected skills for shell commands, keys and instruction-override text. The only matches were documentation examples of public APIs (ad-creative, social) and a note that warns against prompt injection (lead-magnets). No skill runs anything on install.
