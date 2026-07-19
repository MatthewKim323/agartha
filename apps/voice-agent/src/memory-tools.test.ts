import { describe, expect, test } from "bun:test";
import type { GbrainClient } from "@agartha/memory";
import { MEMORY_TOOLS, callHistoryTool, callMemoryTool, isMemoryTool, slugify } from "./memory-tools.js";

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
  test("exposes recall, remember, and history", () => {
    expect(MEMORY_TOOLS.map((t) => t.name).sort()).toEqual(["history", "recall", "remember"]);
  });

  test("history is about the agent itself, recall is about matt", () => {
    // Two different memories. Conflating them is how an agent ends up
    // confidently describing a session that never happened.
    const history = MEMORY_TOOLS.find((t) => t.name === "history")!;
    expect(history.description).toContain("your OWN past");
    expect(history.description).toContain("including when it says you're bad at something");
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

describe("history tool", () => {
  const fakeEpisodic = (rows: Record<string, unknown[]>) =>
    ({
      enabled: true,
      toolReliability: async () => rows.reliability ?? [],
      latencyByDay: async () => rows.latency ?? [],
      recentFailures: async () => rows.failures ?? [],
      recentSessions: async () => rows.sessions ?? [],
    }) as never;

  test("reports tool reliability in sayable prose, not a table", async () => {
    const out = await callHistoryTool(
      fakeEpisodic({ reliability: [{ tool: "craft_item", success_rate: 0, calls: 3, avg_ms: 2400 }] }),
      { about: "reliability" },
    );
    expect(out).toContain("craft_item");
    expect(out).toContain("0%");
    expect(out).not.toContain("|"); // no markdown table — this gets spoken
  });

  test("admits it does not know rather than inventing history", async () => {
    expect(await callHistoryTool(fakeEpisodic({}), { about: "reliability" })).toBe(
      "i haven't done enough yet to know",
    );
    expect(await callHistoryTool(fakeEpisodic({}), { about: "sessions" })).toBe(
      "this is our first session together",
    );
  });

  test("reports failures honestly", async () => {
    const out = await callHistoryTool(
      fakeEpisodic({ failures: [{ tool: "craft_item", result: "no materials" }] }),
      { about: "failures" },
    );
    expect(out).toContain("no materials");
  });

  test("says so when no record is being kept", async () => {
    const out = await callHistoryTool({ enabled: false } as never, { about: "sessions" });
    expect(out).toContain("not keeping a record");
  });

  test("defaults to sessions for an unknown topic", async () => {
    const out = await callHistoryTool(
      fakeEpisodic({ sessions: [{ started_at: "2026-07-19T08:00", summary: "chopped wood", tool_calls: 3 }] }),
      { about: "nonsense" },
    );
    expect(out).toContain("chopped wood");
  });
});
