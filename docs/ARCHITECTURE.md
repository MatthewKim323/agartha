# Architecture

## The problem, measured

Numbers pulled from the predecessor's daemon logs, not estimated:

| Symptom | Measured | Cause |
|---|---|---|
| Time to first audio | **6.5s - 13s** | brain was a cold `claude -p` process spawn per turn |
| Memory retrieval | **28 of 40 attempts timed out** at 2500ms | prefetch spawned a fresh `gbrain` binary each call; cold start dominated |
| One hung retrieval | **157,746ms** | kill escalation didn't reliably reap the child |
| Voice replies | ~4s slower than necessary | no `ANTHROPIC_API_KEY`, so it fell through to the CLI path |

And two structural disconnections:

- The voice brain ran with `--strict-mcp-config` and **zero MCP servers loaded**. It could talk but could not act.
- The action brain pushed speech into a 20-item in-memory outbox that **nothing ever drained**. It could act but could not talk.

Plus identity fragmented across **five drifting copies** of the persona, none of which was the canonical one (the canonical `SYSTEM_PROMPT` was exported and never imported by anything).

## The fix

Delete the process spawn. One long-lived session whose function declarations are bound directly to the MCP tool surface.

```
                 ┌─────────────────────────────────────────────┐
                 │  apps/voice-agent                           │
Discord VC ──────┤                                             │
   mic 48k/2ch   │  transport: ported verbatim from itto       │
                 │     opus-patch, 20ms clock, silence pad     │
                 │                    │                        │
                 │                    ▼                        │
                 │  ┌──────────────────────────────────────┐   │
                 │  │  Gemini Live session (persistent)    │   │
                 │  │  native VAD · barge-in · S2S         │   │
                 │  │  fn decls ──┐                        │   │
                 │  └─────────────┼────────────────────────┘   │
                 │                │ ~1-5ms localhost           │
                 │  persona: jabby's prompts/ (single source)  │
                 │  context injector (async, never blocks)     │
                 └────────────────┼────────────────────────────┘
                                  │ MCP
                    ┌─────────────▼──────────────┐
                    │  itto-mc :3001/mcp         │
                    │  set_goal, run_skill, chat │
                    │  find_blocks, remember_…   │
                    └─────────────┬──────────────┘
                                  ▼
                    apps/mc-bot — fast loop 15Hz, goal runner
                                  ▼
                            Minecraft world
```

## Latency discipline

Three rules that everything else follows from:

1. **No LLM in the reflex loop.** Ever. Follow, safety, lava, and eating run at 15Hz in plain code. This is what makes the bot feel alive while the model is still thinking.
2. **Nothing slow in front of speech.** Retrieval is speculative and hides *behind* the previous turn. If it isn't ready, we speak without it. A blocking `await` on memory is the single most common way voice agents get slow, and the predecessor did exactly that.
3. **Actions acknowledge immediately and report later.** The goal runner returns on the first tick and pings on completion.

### gbrain without the 4-second tax

1. **Don't spawn the binary.** Talk MCP JSON-RPC to the already-running `localhost:3131/mcp`, which owns the PGLite lock. Kills the cold start that dominates.
2. **LRU cache** on normalized query. There was previously no caching at all; identical queries paid full price every time.
3. **Speculative prefetch.** Fire on the partial transcript, in parallel with generation, and inject for the *next* turn.

gbrain is single-writer PGLite behind a crash-loop-healing shell wrapper. Writes go through `:3131` only. A second `serve` process risks the WAL corruption that wrapper exists to repair.

## Identity

The session prompt is built at startup from jabby's real files: `IDENTITY.md` + `USER.md` + `SOUL.md` + `MINECRAFT_IDENTITY.md`. There is no local copy to drift.

`speak` means voiced in the call. `chat` means in-game text. That distinction is load-bearing and inherited deliberately.

## Known constraints

- **Gemini Live tool control is weaker than GPT-realtime's.** No reliable `tool_choice="none"`, and dynamic tool updates need a session restart ([livekit/agents#6002](https://github.com/livekit/agents/issues/6002)). Fine here: the tool set is static at startup. Don't try to hot-swap tools mid-session.
- **The Discord audio transport must be ported verbatim.** The opus monkey-patch exists because native `@discordjs/opus` is missing `silk_NLSF2A` on Node 24 + Apple Silicon and SIGABRTs the instant anyone speaks. `@discordjs/voice` is pinned to exactly 0.19.2 for DAVE support. The 20ms silence-clocked feed exists because without it the stream underruns and every utterance after the first gets dropped. Rewriting this code re-earns all of those bugs.
- **The voice bridge runs under Node, not Bun**, for the native audio deps.

## Measurement

Neither predecessor project has a single recorded latency number. itto has aspirational targets in its docs and no instrumentation; the other has Prometheus histograms and no recorded results.

So instrumentation lands *before* the rewrite (task 6), and every performance claim in this repo cites a measured number or is marked as arithmetic. The p50/p99 table is the artifact that proves the project.
