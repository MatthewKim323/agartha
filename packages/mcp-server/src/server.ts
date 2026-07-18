import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotControl } from "@agartha/shared";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

/**
 * Build the MCP server that Hermes connects to.
 *
 * The bot lives in apps/mc-bot; it constructs a concrete BotControl against a
 * live Mineflayer instance and passes it in here. This package never imports
 * Mineflayer or the app — it only knows the BotControl interface from shared.
 *
 * Hermes registers it via: `hermes mcp add itto http://localhost:3001`
 */
export function createMcpServer(control: BotControl): McpServer {
  const server = new McpServer({
    name: "itto",
    version: "0.0.0",
  });

  // Tools = things Hermes can DO (move, mine, place, chat, run a skill...).
  registerTools(server, control);

  // Resources = things Hermes can READ (the live world state snapshot).
  registerResources(server, control);

  return server;
}
