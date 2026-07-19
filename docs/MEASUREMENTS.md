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

## Memory as a callable tool

Asked "yo what am i building at kali labs again" over a live session:

```
-> recall({"query":"what is matt building at kali"})   first tool @ 345ms
said: "you mentioned building jabby and the kali platform, which seems
       like a lot at once btw. is there one in particular?"
```

It called gbrain rather than guessing, and rewrote the question into a better
query itself. This is only affordable because retrieval is ~25ms warm; the
predecessor's 1.3-4.0s is why it could only ever use memory as a pre-pass.

## Thinking budget on the conversation lane

Same prompt ("can you chop a tree for me"), same session, only difference is
the thinking budget:

| | thinking on (default) | thinkingBudget 0 |
|---|---|---|
| first audio | 2342ms | **1343ms** |
| tool calls | **zero** | set_goal + speak @ 1501ms |
| spoken output | markdown reasoning read aloud | "aight, getting some wood for you" |

With thinking on, the model narrated using set_goal instead of calling it. On
this lane thinking does not add reasoning, it replaces acting. Deep reasoning
belongs in the reflection lane, which is off the speech path and can afford it.

## Voice

Measured 2026-07-19 with `apps/voice-agent/bench.ts`, which streams a real WAV
through the exact Live pipeline the Discord agent uses, paced in 20ms chunks
like a mic. The bot was live on jabisonucsb.aternos.me:59754, so all 22 tools
were declared and tool calls hit the real MCP server.

Input: `say -v Samantha`, 3367ms of speech, "yo what's good bro can you go chop
down that tree for me". **Everything below is measured from END OF SPEECH.**

5 runs, 1000ms trailing silence:

| | predecessor | agartha |
|---|---|---|
| first audio out | 6901-13011ms | **p50 1828ms**, p95 1883ms (1745-1883) |
| first tool call | n/a (10s cooldown, CLI spawn) | **p50 1763ms**, p95 1883ms |
| turns that called a tool | — | **5/5** |

The predecessor numbers are from its own logs:

```
first sentence @ 6901ms   replied @ 7244ms
first sentence @ 7099ms   replied @ 7447ms
first sentence @ 10599ms  replied @ 11102ms
first sentence @ 13011ms  replied @ 13418ms
```

So 6.5-13s becomes ~1.8s. **The 600ms target was not met** and is not reachable
on this architecture: see the decomposition below.

### The tool call arrives BEFORE the first audio

p50 first-tool 1763ms against p50 first-audio 1828ms. In 3 of 5 runs the
`set_goal` landed first. That is the whole design claim, and it is the number
to show: the hands start moving before the mouth does. `set_goal` returns in
1ms, so the bot is pathing while the model is still generating its reply.

### Where the 1.8s actually goes

Trailing silence was varied to separate VAD endpointing from model time:

| trailing silence | first audio (p50) | turns that closed |
|---|---|---|
| 300ms | **never** | 0/3 |
| 600ms | 1835ms | 3/3 |
| 1000ms | 1828ms | 5/5 |
| 2000ms | 1884ms | 3/3 |

Two things fall out of this:

1. **Gemini's VAD needs more than 300ms of silence** to call a turn over. At
   300ms it never responded at all and the transcript truncated mid-word
   ("...can you go cho"). This is the same failure mode as the permanently-mute
   bug, and it is why the input clock in `index.ts` is load-bearing.
2. **Past ~600ms, more silence buys nothing.** First-audio is flat at ~1.8s
   whether we send 600ms or 2000ms. So endpointing costs somewhere in
   300-600ms, and the remaining ~1.2-1.5s is Gemini Live's own
   speech-to-first-audio time, which is not ours to optimize.

That is the honest ceiling: with a hosted realtime model in the loop, sub-600ms
is not available. Getting under it would mean local VAD plus a local TTS
first-syllable, which is a different project.

Across all 14 runs, 11 closed the turn and 10 of those 11 called `set_goal`.
One 600ms run produced audio but no tool call. n is small; see the tool-call
reliability gap below.

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
| voice-to-first-audio | measured: p50 1828ms, 5 runs |
| voice-to-first-tool-call | measured: p50 1763ms, 5/5 runs |
| the tool call beats the audio out | measured (3 of 5 runs) |
| ~~voice-to-first-audio under 600ms~~ | **not met, and not reachable** — 1.2-1.5s of the 1.8s is Gemini Live itself |
| ~~voice-to-action under 1s~~ | **not met** — 1763ms p50 |
| the same numbers hold over Discord audio | **UNVERIFIED** — bench streams a WAV straight in, it does not go through Discord's opus decode or the receiver's frame timing |

### Combat, building and mining (added 2026-07-19)

All of the below is logic-tested and typechecked, and **none of it has run
against a live server**. Listing it honestly rather than letting the test count
imply more than it proves.

| Claim | Status |
|---|---|
| entity classification (hostile/passive/player) is correct | tested against minecraft-data shapes |
| the owner cannot be attacked under any query | tested (4 query forms) |
| every generated structure is emitted in a buildable order | tested (property test over all 6 shapes) |
| skill enum rejects invented names | tested |
| registry and schema cannot drift | asserted at import + tested |
| confusable skills cross-reference each other | tested (caught 6 gaps) |
| **the bot actually kills a cow** | **UNVERIFIED — never run in-world** |
| **a `room` build completes on real terrain** | **UNVERIFIED** |
| **placement reach/sneak/tick pacing hold on a real server** | **UNVERIFIED** |
| **`digTunnel` doesn't walk into lava** | **UNVERIFIED — lava guard is untested code** |
| **the voice model picks the right skill more often now** | **UNVERIFIED — needs a live eval** |

The last one is the important caveat. The enum makes a *wrong name* impossible;
it does not make the *right choice* certain. Proving the choice improved needs
an eval against the live model on real utterances, which is the RunType work.

Mineflayer behaviours the implementation depends on, verified against the 4.37
source rather than assumed:

- `placeBlock` does **no** reach check — an out-of-range attempt costs a silent
  5000ms timeout, so range is enforced before the call (server limit is 4.5;
  we use 4.0 for margin).
- `blockAt` returns an air *block*, not `null`. `null` means the chunk is
  unloaded. The old `placeBlock` null check could therefore never fire.
- `placeBlock` null-dereferences on an unloaded destination before doing
  anything, so the destination is checked first.
- Placing against a chest/furnace/door opens its UI unless sneaking, and
  mineflayer does not sneak for you (`generic_place.js` still has the TODO).
- `grass` is `short_grass` since 1.20.3; the replaceable set carries both.

The original stack — memory, dispatch, the reflex loop, one end-to-end goal —
is measured. Two gaps remain, and they are different in kind: the voice loop has
never carried audio, and the combat/build/mine work above has never touched a
live server. The first is a latency question, the second is a correctness one.

## Reproducing

```bash
bun test                                  # 211 tests
bunx tsc --noEmit -p tsconfig.base.json   # zero errors
```

The gbrain numbers came from a scratch script driving `GbrainClient` against
:3131. Note that gbrain caches its token table at boot, so a token created after
the server started returns 500 until it restarts.
