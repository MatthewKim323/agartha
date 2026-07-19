# agartha

A Minecraft companion that talks back in about the time a person would, acts while it's still talking, and remembers you between sessions because it shares a brain with [jabby](https://github.com/MatthewKim323).

Not an assistant that happens to be in a block game. A duo partner that happens to have hands.

## Why this exists

The pieces already existed and were individually good. They were just wired together through a process spawn.

The predecessor project could do all of this, and took **6.5 to 13 seconds** to say a word. Its memory retrieval timed out on 28 of its last 40 attempts. Its voice layer could talk but had zero tools loaded, so it couldn't act. Its action layer could act but pushed speech into a queue that nothing drained. Two working halves that couldn't reach each other.

agartha is the rewrite that removes the CLI spawn from the hot path.

## Architecture

Three lanes, strictly separated. Nothing slow is ever allowed in front of speech.

| Lane | Budget | What runs there |
|---|---|---|
| **Reflex** | 66ms (15Hz) | Follow, safety, lava, auto-eat. No LLM, ever. |
| **Conversation + action** | ~400ms | Native speech-to-speech. Function calls dispatch straight to the bot. |
| **Reflection** | seconds, async | Memory retrieval, fact writeback, deep reasoning. Never blocks a word. |

```
Discord VC ──► Gemini Live session (persistent, native VAD + barge-in)
                     │ function calls, ~1-5ms localhost
                     ▼
               itto-mc MCP :3001  ──►  Mineflayer body
                                        fast loop 15Hz
                                        goal runner (non-blocking)

   gbrain :3131  ◄── speculative prefetch, hidden behind speech
```

The seam between brain and body is one typed interface (`BotControl`) exposed over MCP. The body never knows who's driving it.

### The core idea

A goal kicked off by voice returns *immediately* and reports completion later. So "aight, otw" lands while the bot is already pathing, and "got the wood" arrives when it's actually done. That's the natural version of the filler-audio trick every voice-agent post recommends, except it falls out of the architecture instead of being bolted on.

## Status

Early. Building in dependency order, one commit per step. See `docs/ARCHITECTURE.md` for the full plan and `docs/DECISIONS.md` for what was chosen and why.

The demo gate was "say 'come chop that tree' and have audio start under 600ms with the bot pathing under a second." Measured 2026-07-19: first audio 1828ms p50, first tool call 1763ms p50, 5/5 turns dispatched. The 600ms half was missed and is not reachable with a hosted realtime model in the loop; the tool call beating the audio out is the part that mattered. Full breakdown in `docs/MEASUREMENTS.md`.

## Lineage

- **itto** (`silaswu4/itto`) — the Mineflayer body, a UCSB hackathon build. The `BotControl` seam, the two-loop split, the skill library, and the hand-rolled 3x3 crafting that works around a mineflayer no-op on 1.20.6 all came from there and are kept largely intact.
- **jabby** — identity and long-term memory. agartha builds its persona from jabby's actual prompt files rather than keeping its own copy, and reads and writes the same gbrain.

## Prior art worth reading

[Voyager](https://voyager.minedojo.org/) for the skill-library idea, [mindcraft](https://github.com/mindcraft-bots/mindcraft) for the LLM+Mineflayer baseline. agartha differs from both in that it treats latency as the primary design constraint rather than capability.
