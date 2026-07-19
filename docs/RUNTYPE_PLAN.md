# RunType integration plan

## The problem with the obvious integration

The naive move is "run the agent on RunType." That's wrong here and we should
say so out loud: agartha's headline number is 3ms tool dispatch, achieved by
deleting a process hop. Routing the speech path through any managed cloud
runtime re-adds network latency to the exact thing the project exists to remove.

But that argument only applies to the **conversation lane**. It says nothing
about the other two, and one of them is a RunType-shaped hole we already
identified and left empty.

## The angle: RunType is the reasoning lane

The architecture has always been three lanes:

```
reflex        15Hz, local, no LLM                    (must be local)
conversation  Gemini Live, ~1.6s, thinking DISABLED  (must be local + fast)
reflection    seconds, async, off the speech path    ← this one is empty
```

We measured that enabling thinking on the conversation lane made it *worse*:
2342ms to first audio and **zero tool calls**, because the model narrated using
a tool instead of calling it. Thinking there doesn't add reasoning, it replaces
acting.

So deep reasoning has to live somewhere else. **That somewhere is RunType.**

RunType deploys agents as **MCP surfaces**, and agartha's voice model already
calls every capability over MCP. So a RunType agent is not an integration we
bolt on — it's one more tool in the same list as `set_goal` and `recall`.

```
voice model
  ├─ set_goal        → local MCP  → mineflayer      (3ms)
  ├─ recall          → local MCP  → gbrain          (25ms)
  └─ think / plan    → RunType MCP surface          (seconds, and that's fine)
        └─ RunType agent: big model, Marathon mode, multi-step plan
```

While that runs, the voice model says "hmm, lemme think about that" — which is
honest filler, because something is genuinely thinking.

This is exactly the capability matt asked for ("we need it to reason tool calls
in the background") and it is the architecturally correct place for it.

## Five concrete integrations, ranked by strength

### 1. `plan` tool — RunType agent as the reasoning lane (strongest)

A RunType agent exposed over MCP, called by the voice model for anything
genuinely multi-step: "build me a house", "set up an iron farm", "what should we
do next."

- Uses a deep-reasoning model with a real thinking budget — the opposite of the
  voice lane, deliberately.
- Returns a plan the goal runner executes as a sequence of skills.
- Latency is irrelevant because it's off the speech path *by design*, and we can
  prove we designed it that way.

**Why it's not forced:** the lane already existed and was empty. We can show the
measurement that says why it must be separate.

### 2. Evals on production traces (hits the track language directly)

RunType Evals validate outputs using "test cases captured from production
traces." We already emit exactly that: every utterance produces a trace with
stage timings, and `bench.ts` streams real speech through the pipeline.

Evals we genuinely want:
- **tool-call reliability** — does "chop that tree" produce `set_goal` every
  time, or only sometimes? We currently do not know, and it matters more than
  latency.
- **model comparison** — we found thinking-on produced 0 tool calls. That is
  literally an eval result we discovered by hand. Formalizing it as a RunType
  eval is honest reuse.
- **prompt regression** — the persona comes from jabby's files, which change.
  An eval catches the day an identity edit breaks tool-calling.

This is the single most *defensible* use, because we have the data already and
the track description explicitly names evaluation work.

### 3. Model routing per lane

We have a measured, documented need for different models in different lanes:
non-thinking for conversation, deep-reasoning for planning, cheap for
extraction. RunType does model routing as a first-class feature. Our
`MEASUREMENTS.md` is the justification.

### 4. Marathon mode — the companion that keeps going (best demo moment)

RunType agents support long-running "Marathon" operations. A companion that
keeps working while you're offline, then tells you what it did when you come
back, is a genuinely striking demo and it maps to a real feature rather than a
trick.

> "I kept mining while you were asleep. Got you 30 iron."

For the loneliness pitch this is strong: presence that persists rather than a
chat that only exists while you're typing.

### 5. Multi-surface companion (product expansion)

RunType surfaces include Slack, SMS, email, web chat, and MCP. The companion
stops being Minecraft-only and follows you: same identity, same memory, in game
and out. That is the *generality* claim made concrete, and it's the natural
answer to "isn't this just a Minecraft bot."

## What this needs

- A RunType account and API key (`https://api.runtype.com/v1`, bearer auth).
- `npx -y @runtypelabs/cli@latest onboard` to wire the MCP connection.

## Sequencing

1. `plan` tool over MCP — the reasoning lane, and the honest core of the story.
2. Evals from existing traces — cheapest credibility, uses data we already have.
3. Marathon demo — highest wow per unit of work.
4. Model routing + multi-surface if time remains.

## The pitch, in one paragraph

> We measured where a managed runtime helps and where it hurts. Speech and
> action are local because we can prove the hop costs us: 3ms dispatch versus a
> network round trip. Reasoning, planning, long-running work, and evaluation run
> on RunType, because those are seconds-scale by nature and it's a better
> runtime for them than our laptop. The split isn't a compromise, it's the
> measurement.

That answer is stronger than "we used RunType for everything," and it's true.
