import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MineBlockInput, PlaceBlockInput, type BotControl } from "@agartha/shared";
import { ok, fail } from "./_util.js";

export function registerWorldTools(server: McpServer, control: BotControl): void {
  server.tool(
    "mine_block",
    "Mine the block at a coordinate (auto-equips the best tool).",
    MineBlockInput.shape,
    async ({ pos }) => {
      try {
        await control.mineBlock(pos);
        return ok(`mined block at (${pos.x}, ${pos.y}, ${pos.z})`);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "place_block",
    "Place an inventory item as a block at a coordinate.",
    PlaceBlockInput.shape,
    async ({ pos, item }) => {
      try {
        await control.placeBlock(pos, item);
        return ok(`placed ${item} at (${pos.x}, ${pos.y}, ${pos.z})`);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
