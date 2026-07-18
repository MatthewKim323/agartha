import type { Skill } from "./types.js";

/**
 * inventory_report() — summarize what the bot is carrying. Pure read, no
 * movement, so no TASK suspension needed.
 */
export const inventoryReport: Skill = {
  name: "inventory_report",
  description: "Summarize what the bot currently has in its inventory.",
  async run(ctx) {
    const inv = ctx.control.getState().inventory;
    if (inv.length === 0) return "i'm carrying nothing";
    return inv.map((i) => `${i.name} x${i.count}`).join(", ");
  },
};
