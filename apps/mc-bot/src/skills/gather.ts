import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";
import { connectedComponent } from "./_geometry.js";
import { countResource, resolveResource } from "./_mining.js";

/**
 * gather(resource, count) — mine until the inventory actually has N of a thing.
 *
 * The gap this fills: every existing mining skill is a single action.
 * `mine_vein` clears one vein and stops, so "get me 32 iron" meant the model
 * had to call it repeatedly and count for itself — which over voice it does not
 * reliably do. This is the goal-shaped version: it has a finish condition and
 * it re-checks against the inventory rather than assuming.
 *
 * Counting is against the DROP, not the block (see _mining.ts): mining
 * `iron_ore` yields `raw_iron`, so counting ore in the inventory counts zero
 * forever and the loop never terminates early.
 */
export const gather: Skill = {
  name: "gather",
  description:
    "Mine until we HAVE a specific amount of something: { resource: 'iron'|'coal'|'diamond'|'wood'|" +
    "'stone', count: 32 }. USE THIS when a quantity is mentioned ('get me 32 iron', 'we need more " +
    "coal'). For clearing one vein you can already see, use mine_vein. For a single tree, chop_tree.",
  async run(ctx, args) {
    const raw = typeof args?.resource === "string" ? args.resource : "any_ore";
    const block = resolveResource(raw);
    const want = typeof args?.count === "number" ? Math.max(1, Math.min(args.count, 128)) : 16;
    const searchRange = typeof args?.maxDistance === "number" ? args.maxDistance : 48;

    return runWithTask(ctx, async () => {
      const startCount = countResource(ctx.control.getState().inventory, block);
      const target = startCount + want;
      let veins = 0;
      let barren = 0;

      // Bounded: each pass is a whole vein, so 24 is a long session, not a
      // runaway. The goal runner can cancel this at any point.
      for (let pass = 0; pass < 24; pass++) {
        const have = countResource(ctx.control.getState().inventory, block);
        if (have >= target) break;

        const seeds = await ctx.control.findBlocks({ name: block, maxDistance: searchRange, count: 64 });
        if (seeds.length === 0) {
          barren++;
          break;
        }

        const vein = connectedComponent(seeds, seeds[0]!, 32);
        const mined = await ctx.control.mineMany(vein);
        if (mined === 0) {
          // Found blocks but couldn't reach any of them — behind lava, in an
          // unloaded chunk, whatever. Stop rather than spin on the same vein.
          barren++;
          break;
        }
        veins++;
        await ctx.control.sweepColumns(vein);
        await ctx.control.collectNearbyDrops({ radius: 6 });
      }

      const got = countResource(ctx.control.getState().inventory, block) - startCount;
      const what = raw.toLowerCase();

      if (got <= 0) {
        return barren > 0
          ? `couldn't find any ${what} around here — might need to dig down first`
          : `didn't manage to get any ${what}`;
      }
      if (got >= want) return `got you ${got} ${what}`;
      return `got ${got} ${what} out of ${want}, ran out of ${what} nearby`;
    });
  },
};
