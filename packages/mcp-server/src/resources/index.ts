import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatStateForPrompt, type BotControl } from "@agartha/shared";

/**
 * Resources Hermes/Claude can read on demand. The big one is the live world
 * snapshot. We expose it two ways: raw JSON (for tools/programmatic use) and a
 * pre-formatted text block (token-cheap, drop straight into a prompt).
 */
export function registerResources(server: McpServer, control: BotControl): void {
  server.resource(
    "game-state",
    "agartha://state/current",
    { description: "Live compact snapshot of the Minecraft world around the bot (JSON).", mimeType: "application/json" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(control.getState(), null, 2),
        },
      ],
    }),
  );

  server.resource(
    "game-state-text",
    "agartha://state/current.txt",
    { description: "Live world snapshot formatted as a compact text block for prompting.", mimeType: "text/plain" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: formatStateForPrompt(control.getState()),
        },
      ],
    }),
  );
}
