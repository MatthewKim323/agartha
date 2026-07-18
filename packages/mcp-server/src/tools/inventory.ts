import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DropItemInput, EquipInput, type BotControl } from "@agartha/shared";
import { ok, fail } from "./_util.js";

export function registerInventoryTools(server: McpServer, control: BotControl): void {
  server.tool(
    "equip",
    "Equip an item (defaults to hand).",
    EquipInput.shape,
    async ({ name, destination }) => {
      try {
        await control.equip(name, destination);
        return ok(`equipped ${name}`);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "drop_item",
    "Drop an item to the ground (e.g. handing something to the player).",
    DropItemInput.shape,
    async ({ name, count }) => {
      try {
        await control.dropItem(name, count);
        return ok(`dropped ${count ?? "all"} ${name}`);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "inventory_report",
    "List everything currently in the bot's inventory.",
    {},
    async () => {
      const inv = control.getState().inventory;
      return ok(inv.length ? inv.map((i) => `${i.name} x${i.count}`).join(", ") : "empty", inv);
    },
  );
}
