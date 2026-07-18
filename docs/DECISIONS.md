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
