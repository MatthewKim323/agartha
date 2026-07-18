import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

const WOOD_TOOLS = ["wooden_pickaxe", "wooden_axe", "wooden_sword", "wooden_shovel"];

/**
 * craft(item, count?) — craft anything, prerequisites and all. Converts the
 * bot's logs into planks and sticks as needed and places a crafting table when
 * the recipe requires one. So "craft a wooden_pickaxe" works straight from logs.
 */
export const craft: Skill = {
  name: "craft",
  description: "Craft an item (e.g. 'wooden_pickaxe','crafting_table','stick','chest'). Auto-makes planks/sticks from logs and places a table if needed.",
  async run(ctx, args) {
    const item = String(args?.item ?? args?.name ?? "");
    if (!item) return "craft needs an item name";
    const count = typeof args?.count === "number" ? args.count : 1;
    return runWithTask(ctx, async () => {
      try {
        await ctx.control.craftSmart(item, count);
        return `crafted ${count} ${item}`;
      } catch (e) {
        return `couldn't craft ${item}: ${(e as Error).message}`;
      }
    });
  },
};

/**
 * make_tools() — craft a full set of wooden tools from the bot's logs and leave
 * a crafting table placed. The "set me up" skill.
 */
export const makeTools: Skill = {
  name: "make_tools",
  description: "Craft a full set of wooden tools (pickaxe, axe, sword, shovel) from logs and place a crafting table.",
  async run(ctx) {
    return runWithTask(ctx, async () => {
      const hasLogs = ctx.control
        .getState()
        .inventory.some((i) => /(_log|_wood|_stem|_hyphae)$/.test(i.name));
      if (!hasLogs) return "no wood to work with — get some logs first";

      // crafting a table (smart) also places it down
      try {
        await ctx.control.craftSmart("crafting_table", 1);
      } catch {
        /* a tool craft will place one anyway */
      }

      const made: string[] = [];
      for (const tool of WOOD_TOOLS) {
        try {
          await ctx.control.craftSmart(tool, 1);
          made.push(tool.replace("wooden_", ""));
        } catch {
          /* ran out of materials — report what we got */
        }
      }
      return made.length ? `made a crafting table + ${made.join(", ")}` : "couldn't craft the tools (not enough wood?)";
    });
  },
};
