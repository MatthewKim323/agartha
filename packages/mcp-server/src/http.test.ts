import { describe, expect, test, afterAll } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serveHttp } from "./http.js";

/**
 * These tools are full control of the bot, so the auth gate gets a test.
 * We drive real HTTP against a real listener rather than calling the predicate
 * directly — the thing worth verifying is that no request reaches the transport
 * unauthenticated, not that a boolean function returns false.
 */

const makeServer = () => new McpServer({ name: "test", version: "0.0.0" });

// Port 0 lets the OS pick a free one so parallel runs can't collide.
async function listen(opts: { token?: string }) {
  const port = 3100 + Math.floor(performance.now() % 400);
  const srv = await serveHttp(makeServer, { host: "127.0.0.1", port, token: opts.token });
  return { srv, base: `http://127.0.0.1:${port}` };
}

const initBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" } },
});

const post = (base: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: initBody,
  });

const started: Array<{ close: () => Promise<void> }> = [];
afterAll(async () => {
  for (const s of started) await s.close();
});

describe("mcp http auth", () => {
  test("rejects a request with no token when one is configured", async () => {
    const { srv, base } = await listen({ token: "correct-horse" });
    started.push(srv);
    const res = await post(base);
    expect(res.status).toBe(401);
  });

  test("rejects a wrong token", async () => {
    const { srv, base } = await listen({ token: "correct-horse" });
    started.push(srv);
    const res = await post(base, { authorization: "Bearer wrong-horse" });
    expect(res.status).toBe(401);
  });

  test("rejects a token that is a prefix of the real one", async () => {
    const { srv, base } = await listen({ token: "correct-horse" });
    started.push(srv);
    const res = await post(base, { authorization: "Bearer correct" });
    expect(res.status).toBe(401);
  });

  test("accepts the correct token", async () => {
    const { srv, base } = await listen({ token: "correct-horse" });
    started.push(srv);
    const res = await post(base, { authorization: "Bearer correct-horse" });
    expect(res.status).not.toBe(401);
  });

  test("stays open when no token is configured (loopback default)", async () => {
    const { srv, base } = await listen({});
    started.push(srv);
    const res = await post(base);
    expect(res.status).not.toBe(401);
  });

  test("health is reachable without a token", async () => {
    const { srv, base } = await listen({ token: "correct-horse" });
    started.push(srv);
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
