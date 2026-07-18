# Seed skills (Hermes markdown)

CONTEXT.md: *"Skills are stored as MD files in Hermes' state dir, not our repo."*

So why is this folder here? These are **templates** — the starting markdown
skill files we hand to Hermes on first run. Hermes copies them into its own
state dir and then evolves them (its self-improvement loop rewrites and adds
to them as we play).

Each one corresponds to an executable seed skill in
`apps/mc-bot/src/skills/`. The markdown describes *when* and *how* Hermes should
use the matching `run_skill` tool; the TypeScript is the actual mechanics.

> Don't treat these as the source of truth at runtime — once copied into Hermes,
> Hermes owns them. Update here only to change what a *fresh* install starts with.

Files to add (one per seed skill):

- `follow_player.md`
- `assist_mining.md`
- `combat_assist.md`
- `fetch_item.md`
- `scout_ahead.md`
- `build_helper.md`
- `inventory_report.md`
