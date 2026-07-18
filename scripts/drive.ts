/**
 * drive.ts — a tiny MCP client to exercise the bot's tools/skills by hand, no
 * brain needed. Great for verifying the body on a local server.
 *
 *   bun run drive list                          # list tools + resources
 *   bun run drive read agartha://state/current     # read a resource
 *   bun run drive find_blocks '{"name":"any_log"}'
 *   bun run drive run_skill chop_tree
 *   bun run drive run_skill mine_vein '{"ore":"iron_ore"}'
 *   bun run drive set_goal '{"intent":{"kind":"skill","name":"chop_tree"},"label":"get wood"}'
 *
 * Endpoint defaults to http://localhost:3001/mcp (override with AGARTHA_MCP_URL).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.AGARTHA_MCP_URL ?? process.env.ITTO_MCP_URL ?? "http://localhost:3001/mcp";
const [, , cmd, ...rest] = process.argv;

/**
 * callTool's return is a union (content blocks OR a legacy toolResult), so we
 * take it loosely and narrow here rather than asserting one arm of the union.
 */
function printToolResult(res: unknown): void {
  const content = (res as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  for (const c of content) {
    const block = c as { type?: string; text?: string };
    if (block.type === "text" && block.text) console.log(block.text);
  }
}

async function main() {
  const client = new Client({ name: "agartha-drive", version: "0.0.0" }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(ENDPOINT)));

  try {
    if (!cmd || cmd === "list") {
      const tools = await client.listTools();
      console.log("tools:\n  " + tools.tools.map((t) => t.name).join("\n  "));
      const res = await client.listResources();
      console.log("resources:\n  " + res.resources.map((r) => r.uri).join("\n  "));
    } else if (cmd === "read") {
      const uri = rest[0];
      if (!uri) throw new Error("usage: drive read <uri>");
      const r = await client.readResource({ uri });
      console.log(r.contents.map((c) => ("text" in c ? c.text : "")).join("\n"));
    } else if (cmd === "run_skill") {
      const name = rest[0];
      if (!name) throw new Error("usage: drive run_skill <name> [jsonArgs]");
      const args = rest[1] ? JSON.parse(rest[1]) : undefined;
      printToolResult(await client.callTool({ name: "run_skill", arguments: { name, args } }, undefined, { timeout: 240000 }));
    } else {
      // generic: drive <tool> '<jsonArgs>'
      const args = rest[0] ? JSON.parse(rest[0]) : {};
      printToolResult(await client.callTool({ name: cmd, arguments: args }, undefined, { timeout: 240000 }));
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("drive error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
