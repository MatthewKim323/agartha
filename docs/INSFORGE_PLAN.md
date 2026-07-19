# InsForge integration plan

## The idea in one line

**gbrain is what the agent knows. InsForge is what the agent has done.**

Semantic memory and episodic memory are different things, and right now agartha
only has the first one.

## Why this isn't a bolt-on

Two real holes exist in the current build, and both are InsForge-shaped:

1. **Traces go to stdout and die.** Task 6 built per-utterance tracing with
   stage timings. It prints a JSON line and that's it. `MEASUREMENTS.md` is a
   file typed by hand. The agent produces telemetry about itself and then throws
   it away.
2. **The agent has no episodic memory.** It knows *about* matt (gbrain) but it
   has no queryable record of what it has actually done. Ask it "how often do
   you fail at chopping trees" and it cannot answer, because nothing persists.

## The AGI angle that is real

Give the agent a Postgres store of its own history, and then give it a **tool to
query that store**. It gains self-knowledge grounded in data rather than vibes:

- *"what did we build last session?"* → episodic recall
- *"how often does chop_tree actually fail?"* → its own success rate
- *"am I getting slower?"* → its own latency trend
- *"what do I usually get wrong?"* → failure patterns it can adapt to

This is metacognition backed by real telemetry, not a prompt that says "reflect
on yourself." The agent observes itself, stores it, queries it, and changes
behaviour. That is a defensible step toward generality and it is genuinely
uncommon in hackathon builds.

InsForge is the right home for it: Postgres with auto-generated REST via
PostgREST, so there is no data layer to write.

## The five uses, ranked

### 1. Episodic memory + self-query (the AGI story)

Tables:

```
sessions     id, started_at, ended_at, world, player, summary
utterances   id, session_id, heard, said, latency_ms, trace_id
tool_calls   id, session_id, tool, args, result, ok, duration_ms, at
traces       id, session_id, stage timings (jsonb), outcome
```

New agent tool `history(query)` backed by these. Because PostgREST auto-exposes
every table, this is config plus a thin client, not a backend build.

**Demo moment:** ask it "how'd we do last time?" and it answers from its own
recorded history rather than a hallucination.

### 2. Live coordination dashboard (multi-agent track: "make coordination visible")

InsForge has **realtime** (database changes + pub/sub). Every lane writes its
activity; the dashboard subscribes and renders the three lanes live:

```
reflex   ████ 15Hz  67ms/tick
voice    ─── listening ─── heard "chop that tree" ─── speaking
action   ──────────────── set_goal(chop_tree) 3ms ─── chopping ─── done
memory   ──── recall("kali") 25ms ────
```

That single view answers "make coordination visible" and turns an invisible
terminal demo into something a judge can watch. Hosted on InsForge too.

### 3. Multi-tenant: anyone can have a companion (Impact & Usefulness, 20%)

Right now this is matt-only, hardcoded to one gbrain and one Discord. InsForge
auth + per-user rows turns it into something other people can actually use:
sign in, link your Discord, your companion accumulates *your* history.

This is the single biggest lever on the Impact score, and it's the honest answer
to "who besides you would use this."

### 4. Model gateway = per-lane model routing

We have a measured need for different models per lane (non-thinking for voice,
deep reasoning for planning). InsForge's gateway is OpenAI-compatible across
providers with keys held server-side, so routing becomes a model string instead
of key management in every process.

### 5. Storage + hosting

S3-compatible storage for session audio and world snapshots; hosting for the
landing page and dashboard. Unglamorous, but it removes a deploy problem.

## Division of labour (say this out loud to judges)

| store | holds | latency | why |
|---|---|---|---|
| local SQLite | spatial world memory | µs | high-volume, only meaningful in-world |
| gbrain | semantic memory of matt | 25ms | existing, personal, private |
| InsForge | episodic + telemetry + multi-user | ~100ms | queryable history, shared, hostable |

Three stores with three different jobs is a *design*, not sprawl — and the
latency column is why each lives where it does.

## Privacy line, non-negotiable

gbrain holds tens of thousands of matt's private messages. **Nothing from gbrain
gets copied into InsForge.** InsForge stores what the agent *did* (tools, timings,
outcomes, session summaries), never the personal corpus. If multi-tenant ships,
that boundary is the whole security model.

## Setup

```bash
npx @insforge/cli login
npx @insforge/cli link --project-id dd8981e3-72bb-497e-90b0-98029baf1127
```

The CLI drops an `.agents/` folder with SDK docs and API patterns, and there's an
MCP server so the schema can be created from a coding agent directly rather than
clicked into a dashboard.
