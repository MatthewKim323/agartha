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

## Reflex loop

**Not re-measured.** The 15Hz fast loop is carried over unmodified, so it has
not regressed by change. What is untested is whether it *holds* 15Hz with the
voice agent competing for CPU on the same machine, which needs a live server.

## What is still unverified

| Claim | Status |
|---|---|
| gbrain retrieval is ~25ms warm | measured |
| the cache eliminates repeat cost | measured |
| MCP auth rejects bad tokens | tested (6 cases incl. prefix) |
| turn queue never drops input | tested (regression test) |
| audio conversion is correct | tested (integer ratios, frame sizes) |
| persona loads jabby's real files | verified, all 4 files, 16k chars |
| voice-to-first-audio under 600ms | **UNVERIFIED — no API key** |
| voice-to-action under 1s | **UNVERIFIED — no API key, no live server** |
| fast loop holds 15Hz under load | **UNVERIFIED — needs a live server** |

## Reproducing

```bash
bun test                                  # 123 tests
bunx tsc --noEmit -p tsconfig.base.json   # zero errors
```

The gbrain numbers came from a scratch script driving `GbrainClient` against
:3131. Note that gbrain caches its token table at boot, so a token created after
the server started returns 500 until it restarts.
