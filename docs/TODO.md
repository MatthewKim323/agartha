# TODO

Machine-readable task list. The in-session task list dies on restart; this
doesn't.

**New session: read this file and recreate these as tasks before starting work.**
Copy each subject + description into TaskCreate, then apply the `blocked by`
links.

Update this file when something lands. It is the source of truth between
sessions, so a stale entry here is worse than no entry.

---

## OPEN

### 1. Verify the voice numbers over real Discord audio
**id:** measure-voice-discord · **priority:** medium · **blocked by:** nothing

The bench numbers are in (`docs/MEASUREMENTS.md`, 2026-07-19: 1828ms p50 first
audio, 1763ms p50 first tool, 5/5 dispatch) but the bench streams a WAV straight
into the Live session. It does not go through Discord's opus decode, the
receiver's frame timing, or the playback path back out.

Instrument the same two timestamps in `apps/voice-agent/src/index.ts` and log
them during a real call, so the demo claim is measured on the path the demo
actually uses. Expect it to be slower, not faster. If it is much slower, that
gap is a real bug and worth finding before the demo.

### 2. Fix crafting latency
**id:** fix-crafting · **priority:** high · **blocked by:** nothing

`controller.ts:craftAtTable` sleeps blindly: `settle(300)` + `settle(150)` per
item, times `count`, plus two window clicks per ingredient. Crafting 4 sticks is
~2s of pure sleeping.

Two fixes: replace blind sleeps with waits on the window-update event (capped at
the current values), and drop the redundant per-item loop — shift-clicking a
crafting output already produces the maximum the materials allow.

Do NOT swap in `mineflayer-collectblock`/`tool` while doing this. And crafting
itself must stay hand-rolled: mineflayer's `craft()` silently no-ops on 1.20.6.

Good story for the writeup: the agent surfaced this weakness itself via
`tool_reliability` (0% success, 2400ms avg) and we fixed what it reported.

### 3. Record the demo video and rehearse
**id:** demo-video · **priority:** high · **blocked by:** fix-crafting

Product Experience is 20% and the demo IS the product. Run:

1. "yo chop that tree" → speaks + acts, show the inventory change
2. "what am I building at kali" → recall, ~345ms
3. "how'd we do last time?" → answers from its OWN episodic history
4. let a world event fire → it speaks FIRST, unprompted
5. show the dashboard: four lanes, real timings, failures in red

**NEVER demo `recall` on people** — gbrain holds tens of thousands of matt's
private messages. Project facts only. Rehearse until it runs clean twice.

### 4. Wire RunType as the reasoning lane
**id:** runtype-plan · **priority:** medium · **blocked by:** matt

Needs a RunType API key, or restart Claude Code so the runtype MCP tools load
(it shows Connected, but servers added mid-session don't expose tools until
restart). `api.runtype.com/v1` 401s without a key.

Design is in `docs/RUNTYPE_PLAN.md`. Short version: RunType deploys agents as
MCP surfaces, agartha already speaks MCP, so a RunType agent becomes a `plan`
tool beside `set_goal` and `recall`. It fills the reflection lane, which must
stay off the speech path — measured: thinking on the voice lane produced ZERO
tool calls.

### 5. Multi-tenant — and fix the RLS gap
**id:** multi-tenant · **priority:** medium · **blocked by:** nothing

Biggest lever on Impact & Usefulness (20%): right now the honest answer to "who
besides matt can use this" is nobody.

**This also closes a real security gap.** RLS is enabled with correct policies on
all four InsForge tables, but the agent writes with an admin client that bypasses
them, so isolation is currently theatre. Set `user_id` on every write and move to
a user-scoped client.

Keep the privacy boundary absolute: per-user isolation, and gbrain's personal
corpus never crosses into shared storage.

### 6. Tool-call reliability evals
**id:** reliability-evals · **priority:** medium · **blocked by:** runtype-plan

We know latency; we do NOT know whether "chop that tree" produces `set_goal`
every time or only sometimes. That matters more than latency for Technical
Execution.

RunType Evals take "test cases captured from production traces" — we already emit
exactly that. Also formalizes the thinking-on/thinking-off comparison found by
hand.

### 7. Deploy landing page and dashboard
**id:** deploy · **priority:** low · **blocked by:** demo-video

InsForge hosting. Landing copy and positioning are in `docs/LANDING_BRIEF.md`,
including verified stats and an explicit do-not-claim list.

---

## RECENTLY DONE (don't redo)

- **Voice latency measured** (2026-07-19): 1828ms p50 first audio, 1763ms p50
  first tool, 5/5 dispatch, and the tool call beats the audio out in 3 of 5
  runs. Also proved Gemini's VAD needs >300ms of trailing silence (at 300ms the
  turn never closes) and that past ~600ms extra silence buys nothing. The 600ms
  first-audio target is dead: ~1.2-1.5s of the 1.8s is Gemini Live itself.
- Voice loop confirmed working live by matt (user-confirmed, not yet instrumented)
- Proactive presence — 8 world triggers reach the voice agent, it speaks first
- Episodic memory on InsForge + `history()` self-query tool
- Live coordination dashboard, four lanes (`DASHBOARD_PORT=3020`)
- Schema sanitizer for Gemini's JSON-Schema subset (fixed close-1007)
- Continuous input clock (fixed the permanently-mute bug)
- gbrain client, 1.3-4.0s → 25ms, plus `recall`/`remember` as tools
- Pre-commit hook blocking credentials
- Persona built from jabby's real prompt files

Full history: `git log --oneline`. Every commit explains its own why.
