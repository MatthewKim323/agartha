import type { GbrainClient } from "@agartha/memory";
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

export const MEMORY_TOOLS: FunctionDeclaration[] = [RECALL_TOOL, REMEMBER_TOOL];

/** True if this tool name is handled here rather than by the bot. */
export function isMemoryTool(name: string): boolean {
  return name === "recall" || name === "remember";
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
): Promise<string> {
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
