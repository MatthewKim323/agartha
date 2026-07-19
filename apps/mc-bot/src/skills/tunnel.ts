import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * tunnel(length) — dig a straight 1x2 corridor, torching as it goes.
 *
 * `mine_down` gets you underground; nothing got you ACROSS. Strip mining is the
 * actual way ore gets found, and doing it by hand through mine_vein means the
 * model has to find blocks it can't see yet.
 *
 * The torches matter and aren't decoration: an unlit corridor spawns mobs
 * behind you, which is how an unattended mining goal turns into a death. Placed
 * every 8 blocks, which is the vanilla spacing that keeps light level above the
 * spawn threshold.
 */
export const tunnel: Skill = {
  name: "tunnel",
  description:
    "Dig a straight 1x2 corridor forward (strip mining), placing torches as it goes. " +
    "{ length: 32 }. USE THIS for 'dig a tunnel', 'strip mine', 'dig forward'. To go DOWN to " +
    "reach the ore layer first, use mine_down. To clear one visible vein, use mine_vein.",
  async run(ctx, args) {
    const length = typeof args?.length === "number" ? Math.max(1, Math.min(args.length, 128)) : 32;
    const torchEvery = typeof args?.torchEvery === "number" ? args.torchEvery : 8;

    return runWithTask(ctx, async () => {
      const inv = ctx.control.getState().inventory;
      const hasPick = inv.some((i) => /pickaxe$/.test(i.name));
      const torches = inv.filter((i) => i.name === "torch").reduce((a, i) => a + i.count, 0);

      const dug = await ctx.control.digTunnel(length, { torchEvery: torches > 0 ? torchEvery : 0 });
      await ctx.control.collectNearbyDrops({ radius: 6 });

      if (dug === 0) return "couldn't start a tunnel here — solid bedrock or blocked";

      const notes: string[] = [];
      if (!hasPick) notes.push("no pickaxe though so the stone isn't dropping");
      if (torches === 0) notes.push("no torches, so it's dark back there");
      const tail = notes.length > 0 ? ` (${notes.join(", ")})` : "";
      return `dug ${dug} blocks of tunnel${tail}`;
    });
  },
};
