# Measurements

Only numbers that were actually observed. Anything not measured says so.

The point of this file is that neither predecessor project had one. Claims like
"14s -> ~5s" appeared in commit messages for paths the logs showed running at
7-13s. If a number here is wrong, it should be wrong in a way you can reproduce.

## Memory retrieval

Measured 2026-07-18 against the live `gbrain serve --http` on :3131, via
`GbrainClient`, limit 4, detail low.

| | predecessor | agartha |
|---|---|---|
| cold (incl. handshake) | 3980ms | **64ms** |
| warm, uncached | 1290-2640ms | **13-69ms** (median 25) |
| repeat query | no cache, full cost | **0ms** |

Method: predecessor numbers are three consecutive `gbrain query` CLI runs plus
one cold run. agartha numbers are five distinct queries over one persistent MCP
connection, then the same five again for the cache path.

The difference is almost entirely process cold-start. The predecessor spawned
the `gbrain` binary per query; this holds one connection open.

### Retrieval reliability

The predecessor's prefetch timed out on **28 of its last 40 attempts** against a
2500ms budget (`~/.jabby/launchd.out.log`). One entry recorded 157,746ms, which
means its kill escalation was not reliably reaping the child process.

## Tool dispatch

Measured 2026-07-18 against the live bot on jabisonucsb.aternos.me:59754,
Minecraft 1.20.6, over MCP on localhost.

| | predecessor | agartha |
|---|---|---|
| connect + handshake | per call | **15ms**, paid once at startup |
| read tool | full `claude -p` cold start | **1-15ms** (median 3) |
| `chat` | " | **3ms** |
| `set_goal` | " | **1ms** |

The predecessor spawned a full agent CLI per reaction, behind a 10s cooldown.
This is the single biggest change in the project, and it is the number that
matters most: once the model emits a function call, the bot moves in about
three milliseconds.

`set_goal` returning in 1ms is the non-blocking goal runner working as
designed. It returns immediately and reports completion later, which is what
makes "aight, otw" possible while the bot is already pathing.

### End-to-end action, verified in-world

`set_goal {intent: {kind: "skill", name: "chop_tree"}, label: "get wood"}`

```
state: IDLE -> TASK          goal: get wood [active]
inventory: oak_log x3  ->  oak_log x6, birch_log x4
```

The full chain works against a real server: MCP call, goal runner, skill
execution, blocks actually mined.

## Reflex loop

Holds **15Hz (67ms/tick)** with the bot connected, the MCP server serving, and
the slow loop running. Confirmed from a live boot, not inferred.

## Voice

**Not measured.** No `GEMINI_API_KEY` has been issued, so the Live session has
never run. The pipeline is written and unit-tested but has never carried audio.

For reference, the predecessor's voice path, from its own logs:

```
first sentence @ 6901ms   replied @ 7244ms
first sentence @ 7099ms   replied @ 7447ms
first sentence @ 10599ms  replied @ 11102ms
first sentence @ 13011ms  replied @ 13418ms
```

6.5s to 13s to first audio. The target is under 600ms. That gap is the project.

## What is still unverified

| Claim | Status |
|---|---|
| gbrain retrieval is ~25ms warm | measured |
| the cache eliminates repeat cost | measured |
| tool dispatch is ~3ms | measured against the live bot |
| a goal executes end to end in-world | verified (wood actually chopped) |
| fast loop holds 15Hz with the stack up | measured (67ms/tick) |
| MCP auth rejects bad tokens | tested (6 cases incl. prefix) |
| turn queue never drops input | tested (regression test) |
| audio conversion is correct | tested (integer ratios, frame sizes) |
| persona loads jabby's real files | verified, all 4 files, 16k chars |
| a Gemini Live session opens | verified (socket only) |
| **voice-to-first-audio under 600ms** | **UNVERIFIED — audio has never flowed** |
| **voice-to-action under 1s** | **UNVERIFIED — needs a Discord call** |

Everything except the voice loop itself is now measured. The remaining gap is
narrow and specific: audio in both directions, a tool call round-tripping from
speech, and the latency of that path.

## Reproducing

```bash
bun test                                  # 123 tests
bunx tsc --noEmit -p tsconfig.base.json   # zero errors
```

The gbrain numbers came from a scratch script driving `GbrainClient` against
:3131. Note that gbrain caches its token table at boot, so a token created after
the server started returns 500 until it restarts.
