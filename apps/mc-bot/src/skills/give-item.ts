import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * give_item(name, count?) — hand an item to the player: walk over to them, face
 * them, and drop it so they can grab it. For "give me your pickaxe / pass me
 * some cobble".
 */
export const giveItem: Skill = {
  name: "give_item",
  description: "Give the player an item from the bot's inventory (walks to them and drops it). args: { name, count? }.",
  async run(ctx, args) {
    const name = String(args?.name ?? "");
    if (!name) return "give_item needs an item name";
    const count = typeof args?.count === "number" ? args.count : undefined;

    const has = ctx.control.getState().inventory.some((i) => i.name === name);
    if (!has) return `i don't have any ${name}`;

    return runWithTask(ctx, async () => {
      const player = ctx.control.getState().player;
      if (player?.pos) {
        await ctx.control.moveTo(player.pos, { range: 2 });
        await ctx.control.lookAt(player.pos);
      }
      try {
        await ctx.control.dropItem(name, count);
        return `tossed you ${count ? `${count} ` : ""}${name}`;
      } catch (e) {
        return `couldn't give ${name}: ${(e as Error).message}`;
      }
    });
  },
};
