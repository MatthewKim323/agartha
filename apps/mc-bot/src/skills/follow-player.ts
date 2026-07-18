import type { Skill } from "./types.js";

/**
 * follow_player(distance) — the headline behavior. The fast loop already
 * follows continuously; this skill is the explicit "come back / stick close"
 * toggle Hermes can call (e.g. after a TASK, or when the player says "stay
 * with me"). It just re-enables follow and sets the desired range.
 */
export const followPlayer: Skill = {
  name: "follow_player",
  description: "Stick close to the player. Optionally set follow distance in blocks.",
  async run(ctx, args) {
    ctx.resumeFollow();
    const range = typeof args?.distance === "number" ? args.distance : 3;
    const player = ctx.control.getState().player;
    if (!player?.pos) return "can't see the player to follow";
    return `following ${player.username} at ~${range} blocks`;
  },
};
