import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * mine_down(steps?) — dig a staircase downward to go mining (for stone, ores,
 * caves). Descends in the direction the bot is facing so the player can follow.
 * Stops at lava/bedrock.
 */
export const mineDown: Skill = {
  name: "mine_down",
  description:
    "Dig a staircase DOWNWARD to reach the ore layer. { steps } (default 12). USE THIS for 'dig down', " +
    "'let's go mining', 'find a cave'. To clear a vein you can already see, use mine_vein. To dig " +
    "sideways once you're down there, use tunnel.",
  async run(ctx, args) {
    const steps = typeof args?.steps === "number" ? args.steps : 12;
    return runWithTask(ctx, async () => {
      const hasPick = ctx.control.getState().inventory.some((i) => /pickaxe$/.test(i.name));
      const dug = await ctx.control.mineStaircase(steps);
      if (dug === 0) return "couldn't dig down here (bedrock or lava?)";
      const note = hasPick ? "" : " (no pickaxe though, so the stone won't drop)";
      return `dug a staircase down (${dug} blocks)${note}`;
    });
  },
};
