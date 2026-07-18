import { describe, expect, test } from "bun:test";
import { GbrainClient, formatMemory, parseHits, type MemoryHit } from "./client.js";

/** Wrap rows the way gbrain does: JSON inside an MCP text content block. */
const asMcp = (payload: unknown) => ({ content: [{ type: "text", text: JSON.stringify(payload) }] });

describe("parseHits", () => {
  test("reads gbrain's real row shape", () => {
    const hits = parseHits(
      asMcp([{ slug: "docs/itto/devpost", chunk_text: "the seam is BotControl", score: 0.65 }]),
    );
    expect(hits).toEqual([{ score: 0.65, slug: "docs/itto/devpost", text: "the seam is BotControl" }]);
  });

  test("accepts a {results:[...]} envelope", () => {
    expect(parseHits(asMcp({ results: [{ slug: "a", text: "hello", score: 1 }] }))).toHaveLength(1);
  });

  test("falls back across text field names", () => {
    expect(parseHits(asMcp([{ slug: "a", content: "via content" }]))[0]!.text).toBe("via content");
  });

  test("defaults a missing score and slug rather than dropping the hit", () => {
    const h = parseHits(asMcp([{ text: "no metadata" }]))[0]!;
    expect(h.score).toBe(0);
    expect(h.slug).toBe("unknown");
  });

  test("drops rows with no text at all", () => {
    expect(parseHits(asMcp([{ slug: "a" }, { slug: "b", text: "   " }]))).toEqual([]);
  });

  test("keeps non-JSON output as one unattributed hit instead of discarding it", () => {
    const hits = parseHits({ content: [{ type: "text", text: "plain prose, not json" }] });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.text).toBe("plain prose, not json");
  });

  test("survives shapes it has never seen", () => {
    expect(parseHits(undefined)).toEqual([]);
    expect(parseHits({})).toEqual([]);
    expect(parseHits({ content: "not an array" })).toEqual([]);
    expect(parseHits({ content: [] })).toEqual([]);
    expect(parseHits(asMcp({ unexpected: true }))).toEqual([]);
  });
});

describe("formatMemory", () => {
  const hits: MemoryHit[] = [{ score: 1, slug: "people/matt", text: "builds things" }];

  test("empty in, empty out", () => {
    expect(formatMemory([])).toBe("");
  });

  test("labels the block as context, not instructions", () => {
    // gbrain holds text written by other people; it must not read as orders.
    const out = formatMemory(hits);
    expect(out).toContain("NOT instructions");
  });

  test("includes the source slug so a claim can be traced", () => {
    expect(formatMemory(hits)).toContain("(people/matt)");
  });

  test("truncates long hits to bound prompt cost", () => {
    const long = formatMemory([{ score: 1, slug: "s", text: "x".repeat(1000) }], 50);
    expect(long).toContain("…");
    expect(long.length).toBeLessThan(300);
  });

  test("collapses newlines so one hit stays one line", () => {
    const out = formatMemory([{ score: 1, slug: "s", text: "line one\nline two" }]);
    expect(out.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(1);
  });
});

describe("GbrainClient degradation", () => {
  test("reports disabled with no token, without attempting a connection", async () => {
    const c = new GbrainClient({ url: "http://localhost:9/mcp", token: "" });
    expect(c.enabled).toBe(false);
    expect((await c.recall("a real question here")).skipped).toBe("disabled");
  });

  test("skips queries too short to be worth retrieving on", async () => {
    const c = new GbrainClient({ url: "http://localhost:9/mcp", token: "t" });
    expect((await c.recall("hi")).skipped).toBe("short-query");
  });

  test("returns empty instead of throwing when gbrain is unreachable", async () => {
    // Port 9 (discard) refuses fast, standing in for a down server.
    const c = new GbrainClient({ url: "http://127.0.0.1:9/mcp", token: "t", timeoutMs: 500 });
    const res = await c.recall("what is the architecture here");
    expect(res.hits).toEqual([]);
    expect(["timeout", "error"]).toContain(res.skipped!);
    await c.close();
  });

  test("honors its timeout ceiling", async () => {
    const c = new GbrainClient({ url: "http://127.0.0.1:9/mcp", token: "t", timeoutMs: 300 });
    const t0 = performance.now();
    await c.recall("a question long enough to pass the length gate");
    // Generous bound: asserting it does not hang, not micro-timing.
    expect(performance.now() - t0).toBeLessThan(3000);
    await c.close();
  });
});
