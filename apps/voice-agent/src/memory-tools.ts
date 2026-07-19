import type { EpisodicMemory, GbrainClient } from "@agartha/memory";
import { formatMemory } from "@agartha/memory";
import type { FunctionDeclaration } from "./mc.js";

/**
 * Memory as callable tools, not just ambient context.
 *
 * The speculative prefetch handles "what is probably relevant right now", but
 * it is always one turn stale and it is a guess. When someone asks a direct
 * question about their own life, the agent has to actually go and look, and
 * saying "hmm, let me see" without a lookup behind it is just stalling.
 *
 * This is affordable specifically because the gbrain client is fast: 13-69ms
 * warm, 0ms cached (docs/MEASUREMENTS.md). At that cost a lookup fits inside a
 * conversational turn. The predecessor could not do this — its retrieval took
 * 1.3-4.0s, which is why it only ever used retrieval as a pre-pass.
 */

export const RECALL_TOOL: FunctionDeclaration = {
  name: "recall",
  description:
    "Look something up in your long-term memory about matt: people, past conversations, projects, " +
    "what he's building, what he likes, things that happened. Call this whenever he asks about " +
    "something from his life, or refers to a person, project, or event you don't already have in " +
    "front of you. It is fast, so prefer calling it over guessing. Never invent a memory.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "STRING",
        description: "What to look up, in natural language. e.g. 'what is matt building at kali'",
      },
    },
    required: ["query"],
  },
};

export const REMEMBER_TOOL: FunctionDeclaration = {
  name: "remember",
  description:
    "Save something to long-term memory that should outlive this session: a fact about matt, a " +
    "preference, a decision, something that happened. Only for things genuinely worth keeping. " +
    "Do not use this for what is happening in the Minecraft world right now.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "STRING", description: "Short title for the memory" },
      content: { type: "STRING", description: "What to remember, in a sentence or two" },
    },
    required: ["title", "content"],
  },
};

/**
 * Self-knowledge. Distinct from `recall`, which is memory about matt — this is
 * memory about the agent's own behaviour, answered from recorded telemetry
 * rather than from a prompt instructing it to reflect.
 */
export const HISTORY_TOOL: FunctionDeclaration = {
  name: "history",
  description:
    "Look up your OWN past: what you did in previous sessions, which of your tools actually work, " +
    "how fast you've been, and what you've failed at. Use this when asked how things went last " +
    "time, whether you're good at something, or what went wrong. Answer honestly from what comes " +
    "back, including when it says you're bad at something.",
  parameters: {
    type: "object",
    properties: {
      about: {
        type: "STRING",
        description:
          "What to look up: 'sessions' (what happened recently), 'reliability' (which tools " +
          "work and how often), 'latency' (how fast you've been), 'failures' (what went wrong).",
        enum: ["sessions", "reliability", "latency", "failures"],
      },
    },
    required: ["about"],
  },
};

export const MEMORY_TOOLS: FunctionDeclaration[] = [RECALL_TOOL, REMEMBER_TOOL, HISTORY_TOOL];

/** True if this tool name is handled here rather than by the bot. */
export function isMemoryTool(name: string): boolean {
  return name === "recall" || name === "remember" || name === "history";
}

/**
 * Render episodic rows as short prose. The model is about to speak this, so it
 * has to be sayable — no tables, no JSON.
 */
export async function callHistoryTool(
  episodic: EpisodicMemory,
  args: Record<string, unknown>,
): Promise<string> {
  if (!episodic.enabled) return "i'm not keeping a record right now";
  const about = String(args.about ?? "sessions");

  if (about === "reliability") {
    const rows = await episodic.toolReliability();
    if (rows.length === 0) return "i haven't done enough yet to know";
    return rows
      .slice(0, 6)
      .map((r) => `${r.tool}: ${r.success_rate}% of ${r.calls} tries, about ${r.avg_ms}ms`)
      .join("; ");
  }

  if (about === "latency") {
    const rows = await episodic.latencyByDay(5);
    if (rows.length === 0) return "no timing history yet";
    return rows.map((r) => `${String(r.day).slice(0, 10)}: median ${r.p50_ms}ms over ${r.n} turns`).join("; ");
  }

  if (about === "failures") {
    const rows = await episodic.recentFailures(5);
    if (rows.length === 0) return "nothing's failed recently";
    return rows.map((r) => `${r.tool}: ${r.result}`).join("; ");
  }

  const rows = await episodic.recentSessions(4);
  if (rows.length === 0) return "this is our first session together";
  return rows
    .map((s) => {
      const when = String(s.started_at ?? "").slice(0, 16).replace("T", " ");
      return `${when}: ${s.summary ?? "no summary"} (${s.tool_calls} actions)`;
    })
    .join("; ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Dispatch a memory tool. Returns a short string for the model, and never
 * throws: a memory failure should make the agent say it doesn't remember, not
 * end the turn.
 */
export async function callMemoryTool(
  gbrain: GbrainClient,
  name: string,
  args: Record<string, unknown>,
  now = new Date(),
  episodic?: EpisodicMemory,
): Promise<string> {
  if (name === "history") {
    if (!episodic) return "i'm not keeping a record right now";
    return callHistoryTool(episodic, args);
  }
  if (!gbrain.enabled) return "my memory isn't connected right now";

  if (name === "recall") {
    const query = String(args.query ?? "").trim();
    if (!query) return "nothing to look up";
    const res = await gbrain.recall(query);
    if (res.hits.length === 0) {
      // Say so plainly. An empty result invites confabulation otherwise.
      return "nothing in memory about that";
    }
    return formatMemory(res.hits);
  }

  if (name === "remember") {
    const title = String(args.title ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!content) return "nothing to save";
    const slug = `memory/${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${slugify(title || content)}`;
    const ok = await gbrain.remember(slug, title || "note", content);
    return ok ? "saved" : "couldn't save that";
  }

  return `unknown memory tool ${name}`;
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "note"
  );
}
