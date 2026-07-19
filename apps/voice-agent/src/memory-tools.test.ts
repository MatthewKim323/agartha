import { describe, expect, test } from "bun:test";
import type { GbrainClient } from "@agartha/memory";
import { MEMORY_TOOLS, callMemoryTool, isMemoryTool, slugify } from "./memory-tools.js";

function fake(opts: {
  enabled?: boolean;
  hits?: Array<{ score: number; slug: string; text: string }>;
  saved?: boolean;
  spy?: (call: { fn: string; args: unknown[] }) => void;
}): GbrainClient {
  return {
    enabled: opts.enabled ?? true,
    recall: async (q: string) => {
      opts.spy?.({ fn: "recall", args: [q] });
      return { hits: opts.hits ?? [], ms: 12, cached: false };
    },
    remember: async (slug: string, title: string, content: string) => {
      opts.spy?.({ fn: "remember", args: [slug, title, content] });
      return opts.saved ?? true;
    },
  } as unknown as GbrainClient;
}

const AT = new Date("2026-07-18T22:00:00Z");

describe("tool declarations", () => {
  test("exposes recall and remember", () => {
    expect(MEMORY_TOOLS.map((t) => t.name).sort()).toEqual(["recall", "remember"]);
  });

  test("recall's description tells the model to look rather than guess", () => {
    const d = MEMORY_TOOLS.find((t) => t.name === "recall")!.description;
    expect(d).toContain("Never invent a memory");
  });

  test("isMemoryTool routes only memory names", () => {
    expect(isMemoryTool("recall")).toBe(true);
    expect(isMemoryTool("remember")).toBe(true);
    expect(isMemoryTool("set_goal")).toBe(false);
  });
});

describe("recall", () => {
  test("returns formatted hits", async () => {
    const g = fake({ hits: [{ score: 1, slug: "project/kali", text: "company brain for nonprofits" }] });
    const out = await callMemoryTool(g, "recall", { query: "what is kali" });
    expect(out).toContain("company brain for nonprofits");
    expect(out).toContain("project/kali");
  });

  test("says plainly when it knows nothing, to discourage confabulation", async () => {
    const out = await callMemoryTool(fake({ hits: [] }), "recall", { query: "who is zzz" });
    expect(out).toBe("nothing in memory about that");
  });

  test("passes the query through verbatim", async () => {
    const calls: any[] = [];
    await callMemoryTool(fake({ spy: (c) => calls.push(c) }), "recall", { query: "what am I building" });
    expect(calls[0]).toEqual({ fn: "recall", args: ["what am I building"] });
  });

  test("handles an empty query without calling gbrain", async () => {
    const calls: any[] = [];
    const out = await callMemoryTool(fake({ spy: (c) => calls.push(c) }), "recall", {});
    expect(out).toBe("nothing to look up");
    expect(calls).toHaveLength(0);
  });
});

describe("remember", () => {
  test("saves and confirms", async () => {
    const calls: any[] = [];
    const out = await callMemoryTool(
      fake({ spy: (c) => calls.push(c) }),
      "remember",
      { title: "Likes redstone", content: "matt likes building redstone contraptions" },
      AT,
    );
    expect(out).toBe("saved");
    expect(calls[0].args[0]).toMatch(/^memory\/2026-07-18-likes-redstone$/);
  });

  test("reports failure rather than claiming success", async () => {
    const out = await callMemoryTool(fake({ saved: false }), "remember", { title: "x", content: "y" }, AT);
    expect(out).toBe("couldn't save that");
  });

  test("refuses an empty note", async () => {
    expect(await callMemoryTool(fake({}), "remember", { title: "x" }, AT)).toBe("nothing to save");
  });
});

describe("degradation", () => {
  test("says memory is disconnected rather than pretending", async () => {
    const g = fake({ enabled: false });
    expect(await callMemoryTool(g, "recall", { query: "anything" })).toContain("isn't connected");
  });

  test("unknown tool name is reported, not thrown", async () => {
    expect(await callMemoryTool(fake({}), "nope", {})).toContain("unknown memory tool");
  });
});

describe("slugify", () => {
  test("makes a url-safe slug", () => {
    expect(slugify("Matt's Kali Project!")).toBe("matt-s-kali-project");
  });
  test("falls back for empty input", () => {
    expect(slugify("!!!")).toBe("note");
  });
  test("bounds length", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(48);
  });
});
