import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotControl } from "@agartha/shared";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

/**
 * Build the MCP server the voice agent connects to.
 *
 * The bot lives in apps/mc-bot; it constructs a concrete BotControl against a
 * live Mineflayer instance and passes it in here. This package never imports
 * Mineflayer or the app — it only knows the BotControl interface from shared.
 *
 * The voice agent connects to it at http://localhost:3001/mcp
 */
export function createMcpServer(control: BotControl): McpServer {
  const server = new McpServer({
    name: "itto",
    version: "0.0.0",
  });

  // Tools = things the agent can DO (move, mine, place, chat, run a skill...).
  registerTools(server, control);

  // Resources = things the agent can READ (the live world state snapshot).
  registerResources(server, control);

  return server;
}
