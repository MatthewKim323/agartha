import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CraftItemInput, type BotControl } from "@agartha/shared";
import { ok, fail } from "./_util.js";

/**
 * Crafting tools. The controller handles finding/using a crafting table when
 * the recipe needs one, so this stays a thin primitive.
 */
export function registerCraftingTools(server: McpServer, control: BotControl): void {
  server.tool(
    "craft_item",
    "Craft an item by name. Smart: auto-converts logs→planks and planks→sticks as needed, and finds or places a crafting table when the recipe needs one. So you can craft tools straight from logs.",
    CraftItemInput.shape,
    async ({ item, count }) => {
      try {
        await control.craftSmart(item, count);
        return ok(`crafted ${count ?? 1} ${item}`);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
