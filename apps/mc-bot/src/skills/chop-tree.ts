import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * chop_tree() — find the nearest tree, fell the whole thing (trunk + branches,
 * mining upward as the column clears), and pick up the logs. The headline
 * "do a real thing" skill.
 */
export const chopTree: Skill = {
  name: "chop_tree",
  description: "Get WOOD: chop down the nearest tree(s) and collect the logs. THIS is the skill for 'get wood', 'chop a tree', 'get me logs'. (For ore use mine_vein.)",
  async run(ctx) {
    return runWithTask(ctx, async () => {
      const logs = await ctx.control.findBlocks({ name: "any_log", maxDistance: 32, count: 8 });
      if (logs.length === 0) return "no trees nearby";
      const base = logs[0]!;
      const mined = await ctx.control.fellTree(base);
      // grab the drops: walk a 3x3 around the trunk (logs scatter for tall/branchy
      // trees) so vanilla pickup collects them, plus a best-effort entity grab.
      const sweep = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) sweep.push({ x: base.x + dx, y: base.y, z: base.z + dz });
      await ctx.control.sweepColumns(sweep);
      await ctx.control.collectNearbyDrops({ radius: 8 });
      return mined > 0 ? `chopped ${mined} logs` : "couldn't reach that tree";
    });
  },
};
