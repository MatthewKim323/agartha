# Status

Living handoff. Update it when something lands or unblocks. The in-session task
list does not survive a restart — this file does.

Last updated: 2026-07-19, after proactive presence shipped.

## Done (28)

**Foundation**
- Repo bootstrapped, `.gitignore` before any source, pre-commit hook blocking credentials
- Mineflayer body ported from itto, namespaced `@agartha/*`, 1.20.6
- MCP control surface bound to loopback + optional bearer auth (was `0.0.0.0`, no auth)
- Latency tracing landed *before* optimization, so improvements are provable

**Voice**
- Gemini Live session, persistent, native VAD and barge-in
- 22 bot tools + 3 memory tools bound as function declarations
- Schema sanitizer for Gemini's JSON-Schema subset (fixed close-1007)
- Continuous input clock (fixed the permanently-mute bug)
- Thinking disabled on the voice lane (measured: ON produced zero tool calls)
- Coalescing turn queue — no dropped input, with a regression test
- Persona built from jabby's real `prompts/`, not a local copy

**Memory**
- gbrain client over `:3131`, persistent MCP, LRU cache — 1.3-4.0s → 25ms
- `recall` / `remember` as callable tools, not just ambient prefetch
- Speculative prefetch, never awaited in front of speech
- Episodic memory on InsForge: sessions, utterances, tool_calls, traces + 2 views
- `history()` — the agent queries its OWN past: reliability, latency, failures
- Post-call reflection writing session summaries back to gbrain

**Presence**
- **Proactive nudges**: 8 world triggers reach the voice agent, so it speaks first
- Live coordination dashboard, four lanes with real timings (`DASHBOARD_PORT`)
- Optional prismarine world view (`VIEWER_PORT`) — untested against a live server
- LaunchAgent daemon with config preflight

**Verified live**
- Bot connects, chops a real tree (`oak_log x3 → x6, birch_log x4`)
- Tool dispatch 1-15ms, `set_goal` 1ms, reflex holds 15Hz
- `recall` answered a real question about matt at 345ms
- Voice loop confirmed working by matt in a real Discord call

## Blocked on matt

| # | what | why |
|---|---|---|
| 27 | RunType `plan` lane | Needs an API key, or restart Claude Code so the runtype MCP tools load (shows Connected, but mid-session servers don't expose tools until restart). Design in `docs/RUNTYPE_PLAN.md`. |

## Next, in priority order

1. **Fill in real voice numbers** — `docs/MEASUREMENTS.md` still says voice is
   UNVERIFIED. It works now. Run `apps/voice-agent/bench.ts --runs 5` and record
   p50/p95. Highest value per minute: Technical Execution is 25% of the score.
2. **Crafting latency** — ~450ms of blind `settle()` sleeps × item count in
   `controller.ts:craftAtTable`. Replace with event-driven waits; drop the
   redundant per-item loop (shift-clicking the output crafts the max already).
   Good story: the agent flagged this itself via `tool_reliability` at 0% / 2400ms.
3. **Demo video + rehearsal** — Product Experience is 20% and the demo is the
   product. Script in task 30. Never demo `recall` on people.
4. **Multi-tenant** — biggest Impact lever. Also closes a real gap: RLS is
   enabled but writes use an admin client that bypasses it, so isolation is
   currently theatre. Fix `user_id` on write.
5. **RunType evals** — tool-call reliability across repeated phrasings. We do not
   currently know whether "chop that tree" works every time.
6. **Deploy** landing page + dashboard on InsForge hosting.

## Known gaps, stated honestly

- **RLS is theatre right now.** Policies exist and are correct, but the agent
  writes with an admin client that bypasses them. Single-user today; must be
  fixed before anyone else touches it.
- **prismarine-viewer has never rendered a frame** — the server slept before it
  could be tested.
- **Tool-call reliability is unmeasured.** Latency is known; whether the model
  calls the right tool *every* time is not.
- Crafting works but is slow, and it's the one thing that visibly drags on stage.

## Context to reload in a new session

1. This file plus `CLAUDE.md` (auto-loaded).
2. `docs/MEASUREMENTS.md` — every number, plus what's unverified.
3. `docs/DECISIONS.md` — what was chosen and what was deliberately rejected.
4. `docs/RUNTYPE_PLAN.md`, `docs/INSFORGE_PLAN.md` — sponsor integration designs.
5. `docs/LANDING_BRIEF.md` — positioning, verified stats, claims we can defend.
6. `npx @insforge/cli memory list` — durable project decisions.
7. `git log --oneline` — 30ish commits, each explaining its own why.
