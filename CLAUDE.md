# agartha

Auto-loaded every session in this directory. Read `docs/STATUS.md` next for
what's done and what's next.

## What this is

An AI companion with two months of real memory that plays Minecraft with matt.
You talk to it out loud, it answers in ~1.6s, and its hands are already moving
while it's still talking. It shares a brain with **jabby**, matt's always-on
Discord agent, so it knows who he is.

Built for an AGI Summit hackathon. Track: **Multi-Agent Systems & Coordination**.
Judging: Technical Execution 25%, then Innovation / Impact / Product Experience
at 20% each, Business Potential 15%.

## The one rule that explains every design decision

**Nothing slow is allowed in front of speech.**

| lane | budget | what runs there |
|---|---|---|
| reflex | 66ms (15Hz) | follow, safety, lava, auto-eat. No LLM, ever. |
| conversation | ~1.6s | Gemini Live. Tools dispatch directly. Thinking DISABLED. |
| reflection | seconds, async | memory, telemetry, planning. Never blocks a word. |

If a change would put a network hop, a process spawn, or a thinking budget in
front of speech, it's wrong — that's what this project was built to remove.

## Measured, not claimed

Numbers live in `docs/MEASUREMENTS.md` with methodology. Never state a
performance number that isn't in there.

| | before | now |
|---|---|---|
| tool dispatch | ~10s (CLI spawn per reaction) | **1-15ms** (median 3) |
| memory recall | 1.3-4.0s | **13-69ms** (0ms cached) |
| reflex loop | — | **15Hz**, 67ms/tick |
| voice → first audio | 6.5-13s | **~1.6s** |

## Layout

```
apps/mc-bot        Mineflayer body. Fast/slow loops, 13 skills, MCP on :3001
apps/voice-agent   Gemini Live session, Discord audio, tool dispatch, dashboard
packages/shared    BotControl seam, types, latency tracing
packages/memory    gbrain client (semantic) + InsForge client (episodic)
packages/mcp-server MCP tools over the BotControl surface
migrations/        InsForge SQL
```

## Three memories, three jobs

| store | holds | latency |
|---|---|---|
| local SQLite | spatial world memory (waypoints, chests) | µs |
| **gbrain** (`:3131`) | semantic memory of matt — who he is | ~25ms |
| **InsForge** | episodic — what the agent DID, its own reliability | ~40ms |

**PRIVACY BOUNDARY, non-negotiable:** gbrain holds tens of thousands of matt's
private messages. Nothing from gbrain is ever copied into InsForge. InsForge
stores what the agent did, never the personal corpus. Never demo `recall` on
people publicly — only project facts.

## Gotchas that have already cost hours

- **Aternos sleeps when empty**, and its info proxy on **25565 keeps answering
  status pings** while the server is stopped. Real port is in the SRV record
  (**59754**). Always check with `bun --env-file=.env scripts/mc-status.ts` —
  `nc -z` gives false greens.
- **Gemini's Schema is a SUBSET of JSON Schema.** One bad tool closes the whole
  session with code 1007. Zod emits `exclusiveMinimum`/`const` that it rejects.
  `sanitizeSchema` in `apps/voice-agent/src/mc.ts` handles this — don't bypass it.
- **Gemini's VAD needs to HEAR silence** to know a turn ended. Discord only
  emits frames while someone speaks, so the input clock in `index.ts` sends
  silence continuously. Remove it and the agent goes permanently mute.
- **Thinking must stay off on the voice lane.** Measured: thinking ON produced
  ZERO tool calls — it narrated using a tool instead of calling it.
- **The opus monkey-patch is load-bearing.** Native `@discordjs/opus` is missing
  `silk_NLSF2A` on Node 24 + Apple Silicon and aborts the moment anyone speaks.
- **Crafting is hand-rolled on purpose.** mineflayer's `craft()` silently no-ops
  on 1.20.6 (the 1.20.5 data-component rework). Don't "fix" it with the plugin.
- **The voice agent runs under Node, not Bun** (native audio deps).

## Running it

```bash
./scripts/demo.sh                              # preflight + bot + voice agent
bun --env-file=.env scripts/mc-status.ts       # is the MC server really up?
bun --env-file=.env scripts/gbrain-test.ts     # is memory working?
bun --env-file=.env apps/voice-agent/bench.ts speech.wav --runs 5   # voice latency
bun test && bunx tsc --noEmit -p tsconfig.base.json
```

Dashboard at `localhost:3020` (`DASHBOARD_PORT`), world view at `3010`
(`VIEWER_PORT`).

## Conventions

- **Commit per logical step**, body explains the *why* and cites the measurement.
- **A pre-commit hook blocks credentials** (`.githooks/pre-commit`). If it fires,
  fix the change — don't `--no-verify`.
- **No em dashes** anywhere, including code comments. matt's house rule.
- Never claim a number you didn't measure. `docs/MEASUREMENTS.md` has a
  "what is still unverified" section — keep it honest, it's a differentiator.
- The repo is **public**. `.env`, `.insforge/project.json` stay untracked.
