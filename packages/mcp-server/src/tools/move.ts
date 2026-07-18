import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MoveToInput, type BotControl } from "@agartha/shared";
import { ok, fail } from "./_util.js";

export function registerMovementTools(server: McpServer, control: BotControl): void {
  server.tool(
    "move_to",
    "Pathfind to a coordinate. For long hops (>30 blocks) the bot teleports instead.",
    MoveToInput.shape,
    async ({ target, range, sprint }) => {
      try {
        await control.moveTo(target, { range, sprint });
        return ok(`moved toward (${target.x}, ${target.y}, ${target.z})`);
      } catch (e) {
        return fail(`couldn't reach target: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "look_at",
    "Aim the bot's head at a coordinate (used to 'look at' the player or something pointed out).",
    MoveToInput.pick({ target: true }).shape,
    async ({ target }) => {
      try {
        await control.lookAt(target);
        return ok("looking");
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "stop",
    "Cancel current movement / action and stand still.",
    {},
    async () => {
      control.stop();
      return ok("stopped");
    },
  );
}
