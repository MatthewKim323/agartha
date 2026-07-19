import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * collect_drops() — walk to and pick up nearby dropped item entities. Handy
 * after a fight or a mining run when loot is scattered on the ground.
 */
export const collectDrops: Skill = {
  name: "collect_drops",
  description:
    "Pick up loose items lying on the ground nearby. USE THIS for 'grab that stuff', 'pick those up'. " +
    "It only collects what's already dropped in the world — to take something out of a chest use " +
    "fetch_item, and to hand something over use give_item.",
  async run(ctx, args) {
    const radius = typeof args?.radius === "number" ? args.radius : 12;
    return runWithTask(ctx, async () => {
      const n = await ctx.control.collectNearbyDrops({ radius });
      return n > 0 ? `picked up ${n} dropped items` : "nothing on the ground nearby";
    });
  },
};
