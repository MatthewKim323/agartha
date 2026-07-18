import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChatInput, type BotControl } from "@agartha/shared";
import { ok, fail } from "./_util.js";

/**
 * "Social" tools — the bot communicating. Voice replies are handled by
 * Hermes' Discord plugin directly; this is the in-game text-chat path
 * (useful when not in a call, or for /commands).
 */
export function registerSocialTools(server: McpServer, control: BotControl): void {
  server.tool(
    "chat",
    "Send a message in Minecraft text chat.",
    ChatInput.shape,
    async ({ message }) => {
      try {
        await control.chat(message);
        return ok("sent");
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
