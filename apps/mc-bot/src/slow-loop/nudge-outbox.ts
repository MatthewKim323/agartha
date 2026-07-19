import type { GameState } from "@agartha/shared";
import { formatStateForPrompt } from "@agartha/shared";
import type { NudgeSink } from "./index.js";

/**
 * Nudges the voice agent can pick up.
 *
 * The slow loop has always had real triggers — a creeper closing in, the player
 * in trouble, a tool about to break, night falling — but they routed to a
 * spawned CLI brain that no longer exists in the hot path. So the agent could
 * only ever ANSWER. It never spoke first.
 *
 * That is the difference between a chatbot and a companion. A friend playing
 * with you says "yo, creeper behind you" without being asked.
 *
 * The voice agent drains this over MCP and hands it to the model as context,
 * NOT as a command. The persona already says "mostly quiet, only speak when it
 * actually matters", so the model still decides whether the moment is worth
 * saying anything about. Surfacing an opportunity is not the same as ordering
 * it to talk.
 */

export interface Nudge {
  reason: string;
  state: string;
  at: number;
}

const queue: Nudge[] = [];
const MAX = 10;

export function pushNudge(reason: string, state: GameState): void {
  queue.push({ reason, state: formatStateForPrompt(state), at: Date.now() });
  // Keep only the freshest. A backlog of stale world events is worse than
  // nothing: reacting to a creeper from 40 seconds ago is noise.
  while (queue.length > MAX) queue.shift();
}

/** Take everything queued, dropping anything too old to still be true. */
export function drainNudges(maxAgeMs = 15_000): Nudge[] {
  const now = Date.now();
  const all = queue.splice(0, queue.length);
  return all.filter((n) => now - n.at <= maxAgeMs);
}

/** Sink that feeds the voice agent instead of spawning a brain process. */
export const voiceNudgeSink: NudgeSink = {
  nudge(reason, state) {
    pushNudge(reason, state);
  },
};
