import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Serve MCP over Streamable HTTP so the brain (a separate process, possibly a
 * separate machine) can reach it at http://host:port/mcp.
 *
 * One transport AND one McpServer instance per session — an McpServer can only
 * bind a single transport, so every session (brain, voice bridge, dev driver)
 * gets its own via the `makeServer` factory. Sessions are keyed by the
 * Mcp-Session-Id header.
 *
 * SECURITY: these tools are full control of the bot — movement, mining, block
 * placement, chat. The default bind is loopback. If you widen `host` to expose
 * it on a network, set `token` too, or anyone who can reach the port owns the
 * bot.
 */
export async function serveHttp(
  makeServer: () => McpServer,
  opts: { host: string; port: number; token?: string },
): Promise<{ close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  /** Constant-time bearer check. No token configured = open (loopback default). */
  function authorized(req: express.Request): boolean {
    if (!opts.token) return true;
    const header = req.header("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    const a = Buffer.from(presented);
    const b = Buffer.from(opts.token);
    // timingSafeEqual throws on length mismatch, so compare lengths first —
    // length is not the secret here, the value is.
    return a.length === b.length && timingSafeEqual(a, b);
  }

  if (!opts.token && opts.host !== "127.0.0.1" && opts.host !== "localhost") {
    // eslint-disable-next-line no-console
    console.warn(
      `[mcp] WARNING: bound to ${opts.host} with no MCP_AUTH_TOKEN — ` +
        `anyone who can reach port ${opts.port} has full control of the bot.`,
    );
  }

  app.all("/mcp", async (req, res) => {
    if (!authorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const sessionId = req.header("mcp-session-id");
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });
        transport.onclose = () => {
          if (transport!.sessionId) transports.delete(transport!.sessionId);
        };
        // Fresh server per session — an McpServer binds exactly one transport.
        await makeServer().connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      // Never let a bad request take down the bot process.
      // eslint-disable-next-line no-console
      console.error("[mcp] request error:", (e as Error).message);
      if (!res.headersSent) res.status(500).json({ error: (e as Error).message });
    }
  });

  // Unauthenticated on purpose: liveness only, leaks nothing.
  app.get("/health", (_req, res) => res.json({ ok: true, name: "agartha-mcp" }));

  return new Promise((resolve) => {
    const httpServer = app.listen(opts.port, opts.host, () => {
      // eslint-disable-next-line no-console
      console.log(`[mcp] listening on http://${opts.host}:${opts.port}/mcp`);
      resolve({
        close: () => new Promise<void>((r) => httpServer.close(() => r())),
      });
    });
  });
}
