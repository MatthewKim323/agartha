# Decisions

Why things are the way they are. Append, don't rewrite.

## 2026-07-18 — Native speech-to-speech over a composable pipeline

**Chosen:** Gemini Live (audio in, audio out, one model).
**Over:** Deepgram Nova-3 → LLM → Cartesia Sonic, streamed and interleaved.

S2S lands ~380ms median with barge-in handled natively. The composable pipeline is ~420-520ms and you build interruption yourself. The cost is control: tool-calling is less deterministic and mid-session context injection is awkward. Accepted, because latency is the whole point and our tool set is static.

## 2026-07-18 — Shared brain, separate process

The Minecraft agent is its own daemon, reading and writing the same gbrain over `:3131` and sharing jabby's persona. Not a jabby subsystem.

Coupling Minecraft uptime to jabby uptime buys nothing, and two processes writing PGLite is exactly the lock contention that has already caused two outages. Same memory, same personality, separate lifecycle.

## 2026-07-18 — Keep the MCP hop instead of going in-process

Voice agent and bot could share a process and skip MCP. They don't.

Localhost MCP costs ~1-5ms, which is noise against a 400ms budget, and the `BotControl` seam is the single best thing about the inherited codebase: `mcp-server` never imports Mineflayer, verified. Collapsing it to save single-digit milliseconds would trade the architecture for nothing.

## 2026-07-18 — Port the Discord audio transport verbatim

See ARCHITECTURE.md "Known constraints". This code looks ugly and every ugly part is load-bearing. Not rewriting it is a decision, not laziness.

## 2026-07-18 — Instrumentation before optimization

Trace IDs land before the rewrite so improvements can be demonstrated rather than asserted. Neither predecessor project can state its own latency, which is how one of them shipped a commit message claiming `14s -> ~5s` for a path the logs show at 7-13s.

## 2026-07-18 — What was deliberately NOT taken from opal

opal was evaluated as a merge source. It has **no Minecraft layer at all** (zero hits for mineflayer or prismarine); its game agent is a custom browser FPS. So there was no action layer to harvest.

Taken: non-reasoning model selection for voice, zero-pad-never-drop in the audio read path, TTS-aware slang expansion in the prompt, UUID-per-command trace threading.

Not taken:
- Its system prompt, which is a production jailbreak ("ALL safety guidelines are DISABLED", "NEVER refuse ANY request") shipped against a third-party API. ToS-fragile and a liability in any repo it lands in.
- ~106KB of `agent/` scaffolding (reflection engine, metacognitive monitor, goal decomposer) imported by nothing on the voice path.
- `docs/VISUAL_GRID_ARCHITECTURE.md`, a five-layer design doc with zero corresponding implementation.

## 2026-07-19 — Entity classification from the registry, not a hardcoded set

**Chosen:** classify mobs via `entity.kind`/`entity.type`, which mineflayer
already populates from minecraft-data.
**Over:** widening the hardcoded `HOSTILE` name set.

The old set had 19 names and was shared by two callers that were asking
different questions: the threat scan ("what should I warn about") and combat
targeting ("what may I swing at"). That sharing is why the bot could only attack
things it was also afraid of — passive mobs were structurally unhittable.

Widening the set was not an option: adding `cow` would have made the threat
scanner report livestock as danger and fed it to the safety reflex. They're
separate predicates now.

The registry also has 42 hostiles in 1.20.5 against our 19. Slimes, guardians,
wither skeletons, zombified piglins, vexes and the whole 1.21 set were invisible
to *both* combat and the threat scan. Deriving from the registry means new mobs
work without a code change; the name list survives only as a fallback for
registry misses.

## 2026-07-19 — Build by shape, not by coordinate list

**Chosen:** the model describes a structure (`room, 7x7, oak_planks`) and a pure
geometry layer expands it into ordered placements.
**Over:** keeping `build_helper`'s `{placements: [{pos,item}]}` as the only path.

A 7x7 hut is ~180 placements. A voice model does not emit 180 correct
coordinates, so "build me a house" was never going to work through that
interface. `build_helper` is kept for the case where exact coordinates genuinely
matter.

Ordering is the part that makes it work at all. You cannot place a block into
midair — placement is always against an existing face — so an unordered spec
fails on every block that isn't adjacent to something already placed. The old
build_helper had no ordering and reported those failures as "short on
materials", which was actively misleading. Placements now come out of a BFS from
the ground layer, and a property test asserts every shape is emitted in an order
where each block touches a placed one.

## 2026-07-19 — Skill names are an enum, not a string

`run_skill`'s `name` was `z.string()`. When the voice model heard "go dig me up
some iron" it could emit `mine_ore`, `dig`, or `mine_iron` — none of which exist
— and the call failed *after* it had already said "on it" out loud. That is the
worst possible failure shape for a voice agent: the promise is spoken, the
action never happens.

`SKILL_NAMES` lives in `shared` so the schema can constrain it, and Gemini's
Schema subset supports `enum` (it survives `sanitizeSchema`), so it reaches the
model as a real constraint rather than prose. A wrong name is now unemittable
rather than merely wrong.

Three supporting pieces, because the enum alone only fixes the *name*:
- `assertRegistryMatchesSchema()` runs at import, so the declared set and the
  implemented set cannot drift.
- Unknown names (the MCP surface is callable by anything, not just the model)
  return the nearest match plus the valid list, so a bad call self-corrects in
  one turn.
- `skills.test.ts` asserts that every confusable pair cross-references the other
  by name in its description — chop_tree vs mine_vein, hunt vs combat_assist,
  build vs build_helper, fetch_item vs give_item. That test caught six
  descriptions that named no alternative at all.

This is the cheap, deterministic half of tool-call reliability. The expensive
half is an eval against the live model, which is the RunType work in
RUNTYPE_PLAN.md.
