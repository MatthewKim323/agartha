import { SKILL_NAMES, isSkillName } from "@agartha/shared";
import type { FunctionDeclaration } from "./mc.js";

/**
 * The reflection lane: deep planning on RunType, deliberately off the speech
 * path.
 *
 * The naive integration would be "run the agent on RunType". That is wrong
 * here and worth saying out loud: the headline number of this project is 3ms
 * tool dispatch, achieved by deleting a process hop. Routing speech through a
 * managed cloud runtime re-adds a network round trip to the exact thing the
 * project exists to remove.
 *
 * But that argument only covers the conversation lane. The architecture always
 * had three, and the third one was empty:
 *
 *   reflex        15Hz, local, no LLM              must be local
 *   conversation  Gemini Live, ~1.8s, no thinking  must be local and fast
 *   reflection    seconds, async                   <- this
 *
 * We measured that turning thinking ON in the conversation lane made it worse:
 * 2342ms to first audio and ZERO tool calls, because the model narrated using
 * a tool instead of calling it. Thinking there does not add reasoning, it
 * replaces acting. So deep reasoning has to live somewhere that is not in
 * front of speech, and a measured 7.9s round trip (docs/MEASUREMENTS.md) is
 * proof it could never have lived here.
 *
 * RunType exposes the agent as an MCP surface, and this project already speaks
 * MCP everywhere, so the planner is not a bolted-on integration: it is one more
 * tool beside `set_goal` and `recall`, just a much slower one.
 */

export interface PlanStep {
  skill: string;
  args?: Record<string, unknown>;
  why?: string;
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  risks: string[];
  /** Steps the planner returned that name a skill that does not exist. */
  dropped: string[];
  ms: number;
}

export interface PlannerConfig {
  /** Full MCP surface URL, e.g. .../products/<id>/surfaces/<id>/mcp */
  url?: string;
  /** Surface API key (`mcp_` prefix). */
  key?: string;
  /** Named tool on the surface. */
  tool?: string;
  timeoutMs?: number;
}

/**
 * The tool as the voice model sees it.
 *
 * The description does the load-bearing work of keeping this OFF the fast path:
 * the model is told plainly that this one is slow, that it returns nothing
 * useful immediately, and that it should keep talking. Without that it waits
 * in silence for a tool response that takes eight seconds.
 */
export const PLAN_TOOL: FunctionDeclaration = {
  name: "plan",
  description:
    "Think hard about a genuinely multi-step goal — 'build me a house', 'set up an iron farm', " +
    "'what should we do next', anything needing several skills in the right order. This runs a " +
    "bigger model that actually reasons, so it takes several SECONDS. It returns immediately with " +
    "an acknowledgement, NOT the plan: say something natural like 'lemme think about that for a sec' " +
    "and carry on talking. The plan arrives on its own shortly and you'll be told about it then. " +
    "Do NOT call this for a single obvious action — use set_goal for 'chop that tree'.",
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "STRING",
        description: "What matt wants, in natural language. e.g. 'build us a base before it gets dark'",
      },
    },
    required: ["goal"],
  },
};

interface JsonRpcResult {
  result?: { content?: Array<{ type?: string; text?: string }> };
  error?: { message?: string };
}

/**
 * Pull the JSON object out of a model's text response.
 *
 * The agent is instructed to return bare JSON, and does. But a planner that
 * returns nothing because it wrapped its answer in a markdown fence one time
 * out of thirty is a bad trade for four lines of tolerance.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validate a planner response into a Plan, discarding steps that name a skill
 * that does not exist.
 *
 * The local voice model is structurally prevented from inventing skill names
 * because `run_skill` takes an enum. The remote planner has no such constraint
 * — it is a prompt, and prompts drift. So the same discipline is enforced here
 * on the way back in: an invented skill is dropped and reported, never handed
 * to the goal runner to fail with "unknown skill" after the agent has already
 * said "on it" out loud.
 */
export function parsePlan(raw: unknown, ms: number): Plan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const stepsIn = Array.isArray(obj.steps) ? obj.steps : [];
  const risks = Array.isArray(obj.risks) ? obj.risks.filter((r): r is string => typeof r === "string") : [];

  const steps: PlanStep[] = [];
  const dropped: string[] = [];
  for (const s of stepsIn) {
    if (!s || typeof s !== "object") continue;
    const step = s as Record<string, unknown>;
    const skill = typeof step.skill === "string" ? step.skill : "";
    if (!isSkillName(skill)) {
      if (skill) dropped.push(skill);
      continue;
    }
    steps.push({
      skill,
      args: step.args && typeof step.args === "object" ? (step.args as Record<string, unknown>) : undefined,
      why: typeof step.why === "string" ? step.why : undefined,
    });
  }

  if (!summary && steps.length === 0) return null;
  return { summary, steps, risks, dropped, ms };
}

/** Render a plan as something the voice model can actually say out loud. */
export function speakablePlan(plan: Plan): string {
  const lines = [plan.summary || "got a plan"];
  if (plan.steps.length > 0) {
    lines.push(`steps: ${plan.steps.map((s) => s.skill).join(" -> ")}`);
  }
  if (plan.risks.length > 0) {
    lines.push(`worth mentioning: ${plan.risks.slice(0, 2).join("; ")}`);
  }
  if (plan.dropped.length > 0) {
    // Surfaced rather than swallowed: if the planner keeps asking for a skill
    // that does not exist, that is a real signal about a gap in the skill set.
    lines.push(`(ignored ${plan.dropped.length} step(s) naming skills you don't have: ${plan.dropped.join(", ")})`);
  }
  return lines.join("\n");
}

export class Planner {
  private readonly url: string;
  private readonly key: string;
  private readonly tool: string;
  private readonly timeoutMs: number;
  private id = 0;

  constructor(cfg: PlannerConfig) {
    this.url = cfg.url ?? "";
    this.key = cfg.key ?? "";
    this.tool = cfg.tool ?? "plan";
    this.timeoutMs = cfg.timeoutMs ?? 30_000;
  }

  /** False when unconfigured. The agent talks and acts fine without a planner. */
  get enabled(): boolean {
    return this.url.length > 0 && this.key.length > 0;
  }

  /**
   * Ask for a plan. Seconds-scale by design.
   *
   * Never throws: a planner failure should make the agent say it couldn't work
   * it out, not end the turn. Callers are expected NOT to await this in front
   * of speech.
   */
  async plan(goal: string, context: string): Promise<Plan | null> {
    if (!this.enabled || !goal.trim()) return null;
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++this.id,
          method: "tools/call",
          params: {
            name: this.tool,
            arguments: { input: `goal: ${goal.trim()}\n\n${context}` },
          },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const body = (await res.json()) as JsonRpcResult;
      const text = body.result?.content?.find((c) => typeof c.text === "string")?.text;
      if (!text) return null;
      return parsePlan(extractJson(text), Date.now() - started);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The skill vocabulary the planner is held to, for prompts and tests. */
export const PLANNABLE_SKILLS = SKILL_NAMES;
